"""
Ensure a single real fundraising campaign exists for Dolli platform development.

Idempotent: looks up by fixed title; inserts once. Opt-in via ENABLE_PLATFORM_DEV_CAMPAIGN.
"""

import logging
import os
from datetime import datetime, timezone

from sqlalchemy import select

from core.database import db_manager
from models.campaigns import Campaigns

logger = logging.getLogger(__name__)

DEFAULT_TITLE = "Dolli — fund platform development"
DEFAULT_DESCRIPTION = (
    "Support engineering, design, payments compliance, and hosting for Dolli — "
    "the social-native micro-donation platform. "
    "This campaign is for real infrastructure and product work, not mock data."
)
DEFAULT_GOAL = 25_000.0
DEFAULT_IMAGE = "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80"


def _enabled() -> bool:
    raw = (os.environ.get("ENABLE_PLATFORM_DEV_CAMPAIGN") or "").strip().lower()
    if raw in ("1", "true", "yes", "on"):
        return True
    if raw in ("0", "false", "no", "off"):
        return False
    # Implicit: only staging/dev-like env (never prod when unset).
    env = (os.environ.get("ENVIRONMENT") or os.environ.get("APP_ENV") or "").strip().lower()
    if env in ("production", "prod", "live"):
        return False
    if any(x in env for x in ("stag", "dev", "development", "local")):
        return True
    return False


async def ensure_platform_dev_campaign() -> None:
    if not _enabled():
        logger.info("Platform dev campaign seed skipped (disabled or production env)")
        return
    if not db_manager.async_session_maker:
        logger.warning("No session maker; skip platform dev campaign")
        return

    title = (os.environ.get("PLATFORM_DEV_CAMPAIGN_TITLE") or DEFAULT_TITLE).strip()
    owner = (os.environ.get("PLATFORM_DEV_CAMPAIGN_USER_ID") or "system-seed-user").strip()

    async with db_manager.async_session_maker() as session:
        existing = await session.execute(select(Campaigns).where(Campaigns.title == title))
        if existing.scalar_one_or_none() is not None:
            logger.info("Platform dev campaign already exists: %r", title)
            return

        goal = float(os.environ.get("PLATFORM_DEV_CAMPAIGN_GOAL") or DEFAULT_GOAL)
        desc = (os.environ.get("PLATFORM_DEV_CAMPAIGN_DESCRIPTION") or DEFAULT_DESCRIPTION).strip()
        image = (os.environ.get("PLATFORM_DEV_CAMPAIGN_IMAGE_URL") or DEFAULT_IMAGE).strip()

        row = Campaigns(
            user_id=owner,
            title=title,
            description=desc,
            category="education",
            goal_amount=goal,
            raised_amount=0.0,
            donor_count=0,
            share_count=0,
            click_count=0,
            image_url=image,
            gif_url=None,
            video_url=None,
            status="active",
            urgency_level="medium",
            featured=True,
            impact_statement="Keeps Dolli online, secure, and shipping features for every fundraiser",
            created_at=datetime.now(timezone.utc),
        )
        session.add(row)
        await session.commit()
        await session.refresh(row)
        logger.info("Created platform dev campaign id=%s title=%r", row.id, title)
