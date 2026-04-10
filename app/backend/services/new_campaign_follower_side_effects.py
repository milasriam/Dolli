"""When a campaign becomes *active*, notify users who follow the organizer (in-app + optional SMTP)."""

import logging
from typing import Optional

from models.auth import User
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from services.notify_email import send_followers_new_campaign_emails
from services.user_follows import UserFollowsService
from services.user_notifications import notify_followers_new_campaign

logger = logging.getLogger(__name__)


async def run_when_campaign_became_active(
    db: AsyncSession,
    *,
    creator_id: str,
    campaign_id: int,
    campaign_title: str,
    prev_status_lower: Optional[str],
    new_status_lower: str,
) -> None:
    prev_norm = (prev_status_lower or "").strip().lower()
    new_norm = (new_status_lower or "active").strip().lower()
    if new_norm != "active" or prev_norm == "active":
        return

    inserted = await notify_followers_new_campaign(
        db,
        creator_id=creator_id,
        campaign_id=campaign_id,
        campaign_title=campaign_title,
    )
    if inserted <= 0:
        return

    ufs = UserFollowsService(db)
    follower_ids = await ufs.list_follower_user_ids(creator_id, limit=500)
    if not follower_ids:
        return

    org_row = (await db.execute(select(User).where(User.id == creator_id).limit(1))).scalar_one_or_none()
    organizer_display = (
        (org_row.name or "").strip()
        if org_row and org_row.name
        else (org_row.email.split("@", 1)[0] if org_row and org_row.email else "An organizer")
    )

    rows = await db.execute(select(User.email).where(User.id.in_(follower_ids)))
    emails = [e for e in rows.scalars().all() if e and str(e).strip()]
    if not emails:
        return

    try:
        await send_followers_new_campaign_emails(
            recipient_emails=emails,
            organizer_display=organizer_display,
            campaign_title=campaign_title,
            campaign_id=campaign_id,
        )
    except Exception:
        logger.exception("send_followers_new_campaign_emails failed campaign_id=%s", campaign_id)
