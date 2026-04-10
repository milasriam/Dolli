"""Admin-only content review helpers (NSFW-flagged fundraisers)."""

import logging
from typing import List

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_admin_user
from models.campaigns import Campaigns
from schemas.auth import UserResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/admin/moderation", tags=["admin", "moderation"])


class ModerationCampaignItem(BaseModel):
    id: int
    user_id: str
    title: str
    status: str | None
    category: str | None
    is_nsfw: bool
    created_at: str | None = None

    class Config:
        from_attributes = True


class ModerationCampaignListResponse(BaseModel):
    items: List[ModerationCampaignItem]
    total: int


@router.get("/nsfw-campaigns", response_model=ModerationCampaignListResponse)
async def list_nsfw_campaigns(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    _admin: UserResponse = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Campaigns marked NSFW (for manual review in the admin UI)."""
    q = select(Campaigns).where(Campaigns.is_nsfw.is_(True)).order_by(Campaigns.created_at.desc())
    try:
        cnt = await db.execute(
            select(func.count()).select_from(Campaigns).where(Campaigns.is_nsfw.is_(True))
        )
        total = int(cnt.scalar() or 0)
    except Exception as e:
        logger.error("moderation count failed: %s", e)
        total = 0

    result = await db.execute(q.offset(skip).limit(limit))
    rows = result.scalars().all()
    items = []
    for c in rows:
        items.append(
            ModerationCampaignItem(
                id=c.id,
                user_id=c.user_id,
                title=c.title or "",
                status=c.status,
                category=c.category,
                is_nsfw=bool(c.is_nsfw),
                created_at=c.created_at.isoformat() if getattr(c, "created_at", None) else None,
            )
        )
    return ModerationCampaignListResponse(items=items, total=total)
