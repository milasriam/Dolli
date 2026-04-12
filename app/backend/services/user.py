import logging
import time
from typing import Optional

from models.auth import User
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class UserService:
    @staticmethod
    async def get_user_profile(db: AsyncSession, user_id: str) -> Optional[User]:
        """Get user profile by user ID."""
        start_time = time.time()
        logger.debug(f"[DB_OP] Starting get_user_profile - user_id: {user_id}")
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        logger.debug(
            f"[DB_OP] Get user profile completed in {time.time() - start_time:.4f}s - found: {user is not None}"
        )
        return user

    @staticmethod
    async def update_user_profile(db: AsyncSession, user_id: str, **updates) -> Optional[User]:
        """Update user profile. Only keys present in ``updates`` are applied (allows clearing fields with null)."""
        start_time = time.time()
        logger.debug(f"[DB_OP] Starting update_user_profile - user_id: {user_id}")
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        logger.debug(f"[DB_OP] User lookup completed in {time.time() - start_time:.4f}s - found: {user is not None}")

        if not user:
            return None

        allowed = {"name", "nsfw_filter_enabled", "instagram_handle"}
        extra = set(updates) - allowed
        if extra:
            raise ValueError(f"Unsupported profile fields: {', '.join(sorted(extra))}")

        changed = False
        if "name" in updates:
            user.name = updates["name"]
            changed = True
        if "nsfw_filter_enabled" in updates:
            user.nsfw_filter_enabled = updates["nsfw_filter_enabled"]
            changed = True
        if "instagram_handle" in updates:
            raw = updates["instagram_handle"]
            if raw is None:
                user.instagram_handle = None
                changed = True
            else:
                h = raw.strip()
                if h.startswith("@"):
                    h = h[1:].strip()
                if len(h) > 120:
                    raise ValueError("Instagram handle is too long")
                if h and not all(c.isascii() and (c.isalnum() or c in "._") for c in h):
                    raise ValueError("Use ASCII letters, numbers, periods, and underscores only")
                user.instagram_handle = h or None
                changed = True

        if changed:
            start_time_update = time.time()
            logger.debug("[DB_OP] Starting user profile update")
            await db.commit()
            await db.refresh(user)
            logger.debug(f"[DB_OP] User profile update completed in {time.time() - start_time_update:.4f}s")

        return user
