import hashlib
import logging
from datetime import datetime
from typing import Optional

from core.auth import AccessTokenError, decode_access_token
from core.database import get_db
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from models.auth import User as UserRow
from schemas.auth import UserResponse
from services.curated_user_badges import curated_badge_for_email
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer(auto_error=False)


async def get_bearer_token(
    request: Request, credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)
) -> str:
    """Extract bearer token from Authorization header."""
    if credentials and credentials.scheme.lower() == "bearer":
        return credentials.credentials

    logger.debug("Authentication required for request %s %s", request.method, request.url.path)
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication credentials were not provided")


def _row_to_user_response(row: UserRow) -> UserResponse:
    return UserResponse(
        id=row.id,
        email=row.email or "",
        name=row.name,
        role=row.role or "user",
        last_login=row.last_login,
        account_type=getattr(row, "account_type", None) or "individual",
        organization_verified=bool(getattr(row, "organization_verified", False)),
        organization_display_name=getattr(row, "organization_display_name", None),
        platform_fee_bps=getattr(row, "platform_fee_bps", None),
        nsfw_filter_enabled=bool(getattr(row, "nsfw_filter_enabled", True)),
    )


async def _with_curated_badge(user: UserResponse, db: AsyncSession) -> UserResponse:
    badge = await curated_badge_for_email(db, user.email)
    if not badge:
        return user
    hl = badge.get("highlight") or "none"
    highlight = None if hl == "none" else hl
    return user.model_copy(
        update={
            "curated_badge_label": badge["label"],
            "curated_badge_slug": badge.get("slug") or None,
            "curated_highlight": highlight,
        }
    )


def _jwt_fallback_user(uid: str, payload: dict) -> UserResponse:
    last_login_raw = payload.get("last_login")
    last_login = None
    if isinstance(last_login_raw, str):
        try:
            last_login = datetime.fromisoformat(last_login_raw)
        except ValueError:
            user_hash = hashlib.sha256(uid.encode()).hexdigest()[:8]
            logger.debug("Failed to parse last_login for user hash: %s", user_hash)

    pf_raw = payload.get("platform_fee_bps")
    fee_bps = None
    if pf_raw is not None and pf_raw != "":
        try:
            fee_bps = int(pf_raw)
        except (TypeError, ValueError):
            fee_bps = None

    nsfw_raw = payload.get("nsfw_filter_enabled")
    if nsfw_raw is None:
        nsfw_filter_enabled = True
    elif isinstance(nsfw_raw, bool):
        nsfw_filter_enabled = nsfw_raw
    else:
        nsfw_filter_enabled = str(nsfw_raw).lower() in ("1", "true", "yes")

    return UserResponse(
        id=uid,
        email=payload.get("email", ""),
        name=payload.get("name"),
        role=payload.get("role", "user"),
        last_login=last_login,
        account_type=str(payload.get("account_type") or "individual"),
        organization_verified=bool(payload.get("organization_verified", False)),
        organization_display_name=payload.get("organization_display_name"),
        platform_fee_bps=fee_bps,
        nsfw_filter_enabled=nsfw_filter_enabled,
    )


async def get_current_user(
    token: str = Depends(get_bearer_token),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Load the current user from DB so org verification and fees stay up to date without re-login."""
    try:
        payload = decode_access_token(token)
    except AccessTokenError as exc:
        # Log error type only, not the full exception which may contain sensitive token data
        logger.warning("Token validation failed: %s", type(exc).__name__)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=exc.message)

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token")

    uid = str(user_id)
    result = await db.execute(select(UserRow).where(UserRow.id == uid))
    row = result.scalar_one_or_none()
    if row:
        user = _row_to_user_response(row)
    else:
        user = _jwt_fallback_user(uid, payload)
    return await _with_curated_badge(user, db)


async def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> Optional[UserResponse]:
    """Bearer optional: used for public list/detail to respect NSFW preferences when logged in."""
    if not credentials or credentials.scheme.lower() != "bearer":
        return None
    try:
        payload = decode_access_token(credentials.credentials)
    except AccessTokenError:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    uid = str(user_id)
    result = await db.execute(select(UserRow).where(UserRow.id == uid))
    row = result.scalar_one_or_none()
    if row:
        user = _row_to_user_response(row)
    else:
        user = _jwt_fallback_user(uid, payload)
    return await _with_curated_badge(user, db)


async def get_admin_user(current_user: UserResponse = Depends(get_current_user)) -> UserResponse:
    """Dependency to ensure current user has admin role."""
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user
