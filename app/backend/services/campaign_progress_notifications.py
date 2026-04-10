"""In-app (and optional SMTP) alerts when a followed organizer crosses fundraising % milestones."""

from __future__ import annotations

import logging
from typing import List

from models.auth import User
from models.campaign_milestone_notified import CampaignMilestoneNotified
from models.campaigns import Campaigns
from models.user_follows import UserFollow
from models.user_notifications import UserNotification
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from services.notify_email import send_followers_campaign_milestone_emails

logger = logging.getLogger(__name__)

MILESTONES: tuple[int, ...] = (25, 50, 75, 100)
NOTIFY_KIND = "campaign_progress"


def _percent(raised: float, goal: float) -> int:
    if goal <= 0:
        return 0
    return int(min(100, max(0, (raised / goal) * 100)))


async def _milestone_already_logged(db: AsyncSession, campaign_id: int, milestone_pct: int) -> bool:
    q = select(CampaignMilestoneNotified.id).where(
        CampaignMilestoneNotified.campaign_id == campaign_id,
        CampaignMilestoneNotified.milestone_pct == milestone_pct,
    ).limit(1)
    return (await db.execute(q)).scalar_one_or_none() is not None


async def run_campaign_progress_after_pledge(
    db: AsyncSession,
    campaign: Campaigns,
    *,
    old_raised: float,
    new_raised: float,
) -> None:
    """Call after a completed gift increases ``raised_amount`` (separate transaction from payment is fine)."""
    goal = float(campaign.goal_amount or 0)
    if goal <= 0:
        return

    old_p = _percent(float(old_raised or 0), goal)
    new_p = _percent(float(new_raised or 0), goal)
    crossed = [m for m in MILESTONES if new_p >= m and old_p < m]
    if not crossed:
        return

    organizer_id = str(campaign.user_id)
    follower_rows = await db.execute(select(UserFollow.follower_id).where(UserFollow.following_id == organizer_id))
    follower_ids = list(follower_rows.scalars().all())
    if not follower_ids:
        return

    title_base = (campaign.title or "").strip()[:500] or "A fundraiser"
    fresh: List[int] = []
    for m in crossed:
        if await _milestone_already_logged(db, int(campaign.id), m):
            continue
        fresh.append(m)
    if not fresh:
        return

    for m in fresh:
        db.add(CampaignMilestoneNotified(campaign_id=int(campaign.id), milestone_pct=m))

    for m in fresh:
        title = f"Milestone reached: {m}% funded"
        body = (
            f"{title_base} reached {m}% of its goal "
            f"(${float(new_raised or 0):,.0f} of ${goal:,.0f})."
        )
        for fid in follower_ids:
            db.add(
                UserNotification(
                    user_id=fid,
                    kind=NOTIFY_KIND,
                    title=title,
                    body=body[:2000],
                    campaign_id=int(campaign.id),
                    actor_user_id=organizer_id,
                )
            )

    await db.commit()
    logger.info(
        "campaign_progress_notifications milestones=%s campaign_id=%s followers=%s",
        fresh,
        campaign.id,
        len(follower_ids),
    )

    emails = await _follower_emails(db, follower_ids)
    for m in fresh:
        try:
            await send_followers_campaign_milestone_emails(
                recipient_emails=emails,
                milestone_pct=m,
                campaign_title=title_base,
                campaign_id=int(campaign.id),
            )
        except Exception:
            logger.exception("milestone email send failed campaign_id=%s m=%s", campaign.id, m)


async def _follower_emails(db: AsyncSession, follower_ids: List[str]) -> list[str]:
    if not follower_ids:
        return []
    rows = await db.execute(select(User.email).where(User.id.in_(follower_ids)))
    return [str(e).strip() for e in rows.scalars().all() if e and str(e).strip()]
