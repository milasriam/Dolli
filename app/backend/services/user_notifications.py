import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

from models.user_notifications import UserNotification
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

NOTIFY_KIND_NEW_CAMPAIGN = "new_campaign"


async def notify_followers_new_campaign(
    db: AsyncSession,
    *,
    creator_id: str,
    campaign_id: int,
    campaign_title: str,
) -> int:
    """Insert one in-app notification per follower. Returns rows inserted."""
    from models.user_follows import UserFollow

    follower_rows = await db.execute(select(UserFollow.follower_id).where(UserFollow.following_id == creator_id))
    follower_ids = list(follower_rows.scalars().all())
    if not follower_ids:
        return 0

    title = "New fundraiser from someone you follow"
    body = (campaign_title or "").strip()[:2000] or "(untitled)"
    for fid in follower_ids:
        db.add(
            UserNotification(
                user_id=fid,
                kind=NOTIFY_KIND_NEW_CAMPAIGN,
                title=title,
                body=body,
                campaign_id=campaign_id,
                actor_user_id=creator_id,
            )
        )
    await db.commit()
    logger.info(
        "new_campaign_notifications inserted=%s campaign_id=%s creator=%s",
        len(follower_ids),
        campaign_id,
        creator_id,
    )
    return len(follower_ids)


class UserNotificationsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def unread_count(self, user_id: str) -> int:
        q = select(func.count(UserNotification.id)).where(
            UserNotification.user_id == user_id,
            UserNotification.read_at.is_(None),
        )
        return int((await self.db.execute(q)).scalar() or 0)

    async def list_for_user(
        self,
        user_id: str,
        *,
        skip: int = 0,
        limit: int = 50,
    ) -> Dict[str, Any]:
        q = (
            select(UserNotification)
            .where(UserNotification.user_id == user_id)
            .order_by(UserNotification.id.desc())
            .offset(skip)
            .limit(limit)
        )
        items = list((await self.db.execute(q)).scalars().all())
        total_q = select(func.count(UserNotification.id)).where(UserNotification.user_id == user_id)
        total = int((await self.db.execute(total_q)).scalar() or 0)
        return {"items": items, "total": total, "skip": skip, "limit": limit}

    async def mark_read(self, user_id: str, notification_ids: List[int]) -> int:
        if not notification_ids:
            return 0
        now = datetime.now(timezone.utc)
        r = await self.db.execute(
            update(UserNotification)
            .where(
                UserNotification.user_id == user_id,
                UserNotification.id.in_(notification_ids),
                UserNotification.read_at.is_(None),
            )
            .values(read_at=now)
        )
        await self.db.commit()
        return int(r.rowcount or 0)

    async def mark_all_read(self, user_id: str) -> int:
        now = datetime.now(timezone.utc)
        r = await self.db.execute(
            update(UserNotification)
            .where(UserNotification.user_id == user_id, UserNotification.read_at.is_(None))
            .values(read_at=now)
        )
        await self.db.commit()
        return int(r.rowcount or 0)
