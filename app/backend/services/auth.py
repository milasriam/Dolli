import hashlib
import logging
import os
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

from core.auth import create_access_token
from core.config import settings
from core.database import db_manager
from core.passwords import hash_password, verify_password
from models.auth import OIDCState, User
from models.password_reset import PasswordResetToken
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


def as_utc_aware(dt: datetime) -> datetime:
    """Normalize ORM datetimes to UTC-aware for comparisons.

    Some drivers (e.g. MySQL) return naive datetimes for TIMESTAMP columns; comparing them
    to ``datetime.now(timezone.utc)`` raises TypeError and becomes HTTP 500.
    """
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_user_by_email_lower(self, email: str) -> Optional[User]:
        em = email.strip().lower()
        if not em:
            return None
        # Same email can exist on a legacy local row and a Google row; avoid MultipleResultsFound.
        result = await self.db.execute(
            select(User)
            .where(func.lower(User.email) == em)
            .order_by(
                (User.password_hash.isnot(None)).desc(),
                User.last_login.desc().nullslast(),
            )
            .limit(1)
        )
        return result.scalars().first()

    async def register_with_password(self, email: str, password: str) -> User:
        """Create a local email/password user. Raises ValueError for validation / duplicate email."""
        em = email.strip().lower()
        if len(password) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(password) > 128:
            raise ValueError("Password is too long")
        existing = await self.get_user_by_email_lower(em)
        if existing:
            raise ValueError("An account with this email already exists")
        uid = f"local-{uuid.uuid4().hex}"
        display = em.split("@", 1)[0] if "@" in em else em
        user = User(
            id=uid,
            email=em,
            name=display or None,
            role="user",
            last_login=datetime.now(timezone.utc),
            password_hash=hash_password(password),
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def verify_email_password(self, email: str, password: str) -> Optional[User]:
        """Return user if email matches a row with password_hash and password verifies."""
        user = await self.get_user_by_email_lower(email)
        if not user:
            return None
        ph = getattr(user, "password_hash", None)
        if not ph or not verify_password(password, ph):
            return None
        user.last_login = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def get_or_create_user(self, platform_sub: str, email: str, name: Optional[str] = None) -> User:
        """Get existing user or create new one."""
        start_time = time.time()
        logger.debug(f"[DB_OP] Starting get_or_create_user - platform_sub: {platform_sub}")
        # Try to find existing user
        result = await self.db.execute(select(User).where(User.id == platform_sub))
        user = result.scalar_one_or_none()
        logger.debug(f"[DB_OP] User lookup completed in {time.time() - start_time:.4f}s - found: {user is not None}")

        if user:
            # Update user info if needed
            user.email = email
            user.name = name
            user.last_login = datetime.now(timezone.utc)
        else:
            # Create new user
            user = User(id=platform_sub, email=email, name=name, last_login=datetime.now(timezone.utc))
            self.db.add(user)

        start_time_commit = time.time()
        logger.debug("[DB_OP] Starting user commit/refresh")
        await self.db.commit()
        await self.db.refresh(user)
        logger.debug(f"[DB_OP] User commit/refresh completed in {time.time() - start_time_commit:.4f}s")
        return user

    async def issue_app_token(
        self,
        user: User,
    ) -> Tuple[str, datetime, Dict[str, Any]]:
        """Generate application JWT token for the authenticated user."""
        try:
            expires_minutes = int(getattr(settings, "jwt_expire_minutes", 60))
        except (TypeError, ValueError):
            logger.warning("Invalid JWT_EXPIRE_MINUTES value; fallback to 60 minutes")
            expires_minutes = 60
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)

        claims: Dict[str, Any] = {
            "sub": user.id,
            "email": user.email,
            "role": user.role,
            "account_type": getattr(user, "account_type", None) or "individual",
            "organization_verified": bool(getattr(user, "organization_verified", False)),
        }

        if user.name:
            claims["name"] = user.name
        if user.last_login:
            claims["last_login"] = user.last_login.isoformat()
        on = getattr(user, "organization_display_name", None)
        if on:
            claims["organization_display_name"] = on
        fee = getattr(user, "platform_fee_bps", None)
        if fee is not None:
            try:
                claims["platform_fee_bps"] = int(fee)
            except (TypeError, ValueError):
                pass
        claims["nsfw_filter_enabled"] = bool(getattr(user, "nsfw_filter_enabled", True))
        token = create_access_token(claims, expires_minutes=expires_minutes)

        return token, expires_at, claims

    async def store_oidc_state(
        self, state: str, nonce: str, code_verifier: str, link_user_id: Optional[str] = None
    ):
        """Store OIDC state in database. When link_user_id is set, OAuth completes as a social link for that user."""
        # Clean up expired states first
        await self.db.execute(delete(OIDCState).where(OIDCState.expires_at < datetime.now(timezone.utc)))

        expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)  # 10 minute expiry

        oidc_state = OIDCState(
            state=state,
            nonce=nonce,
            code_verifier=code_verifier,
            expires_at=expires_at,
            link_user_id=link_user_id,
        )

        self.db.add(oidc_state)
        await self.db.commit()

    async def get_and_delete_oidc_state(self, state: str) -> Optional[dict]:
        """Get and delete OIDC state from database."""
        # Clean up expired states first
        await self.db.execute(delete(OIDCState).where(OIDCState.expires_at < datetime.now(timezone.utc)))

        # Find and validate state
        result = await self.db.execute(select(OIDCState).where(OIDCState.state == state))
        oidc_state = result.scalar_one_or_none()

        if not oidc_state:
            return None

        # Extract data before deleting
        state_data = {
            "nonce": oidc_state.nonce,
            "code_verifier": oidc_state.code_verifier,
            "link_user_id": getattr(oidc_state, "link_user_id", None),
        }

        # Delete the used state (one-time use)
        await self.db.delete(oidc_state)
        await self.db.commit()

        return state_data

    async def _tiktok_claimed_by_other(self, open_id: str, self_user_id: str) -> bool:
        tok_id = f"tiktok:{open_id}"
        r = await self.db.execute(
            select(User.id)
            .where(or_(User.id == tok_id, User.tiktok_linked_open_id == open_id), User.id != self_user_id)
            .limit(1)
        )
        return r.scalar_one_or_none() is not None

    async def attach_tiktok_to_user(self, user: User, platform_sub: str, display_name: str) -> None:
        """Bind TikTok open_id to an existing user row. Raises ValueError on conflict or invalid sub."""
        if not platform_sub.startswith("tiktok:"):
            raise ValueError("Invalid TikTok account")
        open_id = platform_sub[7:]
        if not open_id:
            raise ValueError("Invalid TikTok account")
        if str(user.id) == platform_sub:
            user.last_login = datetime.now(timezone.utc)
            if display_name and display_name.strip():
                user.name = display_name.strip()
            await self.db.commit()
            await self.db.refresh(user)
            return
        if await self._tiktok_claimed_by_other(open_id, str(user.id)):
            raise ValueError("This TikTok account is already linked to another Dolli profile.")
        user.tiktok_linked_open_id = open_id
        user.tiktok_linked_display_name = (display_name or "").strip() or None
        user.last_login = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(user)

    async def _meta_claimed_by_other(self, fb_id: str, self_user_id: str) -> bool:
        meta_id = f"meta:{fb_id}"
        r = await self.db.execute(
            select(User.id)
            .where(or_(User.id == meta_id, User.meta_linked_user_id == fb_id), User.id != self_user_id)
            .limit(1)
        )
        return r.scalar_one_or_none() is not None

    async def attach_meta_to_user(self, user: User, platform_sub: str, display_name: str) -> None:
        if not platform_sub.startswith("meta:"):
            raise ValueError("Invalid Facebook account")
        fb_id = platform_sub[5:]
        if not fb_id:
            raise ValueError("Invalid Facebook account")
        if str(user.id) == platform_sub:
            user.last_login = datetime.now(timezone.utc)
            if display_name and display_name.strip():
                user.name = display_name.strip()
            await self.db.commit()
            await self.db.refresh(user)
            return
        if await self._meta_claimed_by_other(fb_id, str(user.id)):
            raise ValueError("This Facebook account is already linked to another Dolli profile.")
        user.meta_linked_user_id = fb_id
        user.meta_linked_display_name = (display_name or "").strip() or None
        user.last_login = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(user)

    async def unlink_tiktok_from_user(self, user_id: str) -> None:
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise ValueError("User not found")
        if str(user.id).startswith("tiktok:"):
            raise ValueError("This account was created with TikTok sign-in; TikTok cannot be disconnected here.")
        user.tiktok_linked_open_id = None
        user.tiktok_linked_display_name = None
        await self.db.commit()
        await self.db.refresh(user)

    async def unlink_meta_from_user(self, user_id: str) -> None:
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise ValueError("User not found")
        if str(user.id).startswith("meta:"):
            raise ValueError("This account was created with Facebook sign-in; Facebook cannot be disconnected here.")
        user.meta_linked_user_id = None
        user.meta_linked_display_name = None
        await self.db.commit()
        await self.db.refresh(user)

    async def change_password(self, user_id: str, current_password: str, new_password: str) -> None:
        if len(new_password) < 8:
            raise ValueError("New password must be at least 8 characters")
        if len(new_password) > 128:
            raise ValueError("New password is too long")
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise ValueError("User not found")
        ph = getattr(user, "password_hash", None)
        if not ph:
            raise ValueError("Password sign-in is not enabled for this account")
        if not verify_password(current_password, ph):
            raise ValueError("Current password is incorrect")
        user.password_hash = hash_password(new_password)
        await self.db.commit()

    async def reset_password_with_token(self, token: str, new_password: str) -> User:
        if len(new_password) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(new_password) > 128:
            raise ValueError("Password is too long")
        raw = (token or "").strip()
        if len(raw) < 10:
            raise ValueError("Invalid or expired reset link")
        token_hash = hashlib.sha256(raw.encode("utf-8")).hexdigest()
        result = await self.db.execute(select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash))
        row = result.scalar_one_or_none()
        now = datetime.now(timezone.utc)
        if not row or as_utc_aware(row.expires_at) < now:
            if row:
                await self.db.delete(row)
                await self.db.commit()
            raise ValueError("Invalid or expired reset link")
        ures = await self.db.execute(select(User).where(User.id == row.user_id))
        user = ures.scalar_one_or_none()
        await self.db.delete(row)
        if not user:
            await self.db.commit()
            raise ValueError("Invalid or expired reset link")
        user.password_hash = hash_password(new_password)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def create_password_reset_token_raw(self, user_id: str) -> Optional[str]:
        """Create a one-time reset token. Works for OAuth-only users (no password_hash) so they can add a password."""
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            return None
        await self.db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id == user_id))
        raw = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw.encode("utf-8")).hexdigest()
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        self.db.add(PasswordResetToken(token_hash=token_hash, user_id=user_id, expires_at=expires_at))
        await self.db.commit()
        return raw


async def initialize_admin_user():
    """Initialize admin user if not exists"""
    if "MGX_IGNORE_INIT_ADMIN" in os.environ:
        logger.info("Ignore initialize admin")
        return

    from services.database import initialize_database

    # Ensure database is initialized first
    await initialize_database()

    admin_user_id = getattr(settings, "admin_user_id", "")
    admin_user_email = getattr(settings, "admin_user_email", "")

    if not admin_user_id or not admin_user_email:
        logger.warning("Admin user ID or email not configured, skipping admin initialization")
        return

    async with db_manager.async_session_maker() as db:
        # Check if admin user already exists
        result = await db.execute(select(User).where(User.id == admin_user_id))
        user = result.scalar_one_or_none()

        if user:
            # Update existing user to admin if not already
            if user.role != "admin":
                user.role = "admin"
                user.email = admin_user_email  # Update email too
                await db.commit()
                logger.debug(f"Updated user {admin_user_id} to admin role")
            else:
                logger.debug(f"Admin user {admin_user_id} already exists")
        else:
            # Create new admin user
            admin_user = User(id=admin_user_id, email=admin_user_email, role="admin")
            db.add(admin_user)
            await db.commit()
            logger.debug(f"Created admin user: {admin_user_id} with email: {admin_user_email}")
