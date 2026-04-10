"""Admin-only: curated profile badges for selected user emails (e.g. Early partner)."""

import logging
import re
from typing import List, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_admin_user
from schemas.auth import UserResponse
from services.curated_user_badges import load_badge_map, save_badge_map, slugify_badge_label
from services.pilot_campaign_access import strict_normalize_emails

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/admin/curated-user-badges", tags=["admin", "curated-badges"])


CuratedHighlightLevel = Literal["none", "frame", "featured"]


class CuratedBadgeItemOut(BaseModel):
    email: str
    label: str
    slug: str
    highlight: CuratedHighlightLevel = "none"


class CuratedBadgesListResponse(BaseModel):
    items: List[CuratedBadgeItemOut]


class CuratedBadgeItemIn(BaseModel):
    email: str
    label: str
    slug: str = ""
    highlight: CuratedHighlightLevel = "none"

    @field_validator("label")
    @classmethod
    def label_ok(cls, v: str) -> str:
        t = (v or "").strip()
        if not t:
            raise ValueError("label is required")
        if len(t) > 64:
            raise ValueError("label too long (max 64)")
        if any(c in t for c in "\n\r\t\x00"):
            raise ValueError("label cannot contain control characters")
        return t

    @field_validator("slug")
    @classmethod
    def slug_ok(cls, v: str) -> str:
        t = (v or "").strip().lower()
        if not t:
            return ""
        if len(t) > 64 or not re.match(r"^[a-z0-9_]{1,64}$", t):
            raise ValueError("slug must be lowercase letters, digits, underscores (max 64), or leave empty")
        return t


class CuratedBadgesPutBody(BaseModel):
    items: List[CuratedBadgeItemIn] = Field(default_factory=list, max_length=200)


@router.get("", response_model=CuratedBadgesListResponse)
async def list_curated_badges(
    _admin: UserResponse = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    m = await load_badge_map(db)
    items = [
        CuratedBadgeItemOut(
            email=e,
            label=d["label"],
            slug=d["slug"],
            highlight=d.get("highlight") or "none",  # type: ignore[arg-type]
        )
        for e, d in sorted(m.items())
    ]
    return CuratedBadgesListResponse(items=items)


@router.put("", response_model=CuratedBadgesListResponse)
async def put_curated_badges(
    body: CuratedBadgesPutBody,
    _admin: UserResponse = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    mapping: dict[str, dict[str, str]] = {}
    for it in body.items:
        try:
            em = strict_normalize_emails([it.email])
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        if not em:
            raise HTTPException(status_code=400, detail=f"Invalid email: {it.email!r}")
        email = em[0]
        label = it.label.strip()
        slug = it.slug.strip().lower() if it.slug else slugify_badge_label(label)
        mapping[email] = {"label": label, "slug": slug, "highlight": it.highlight}
    n = await save_badge_map(db, mapping)
    logger.info("Curated user badges saved (%d entries)", n)
    m = await load_badge_map(db)
    items = [
        CuratedBadgeItemOut(
            email=e,
            label=d["label"],
            slug=d["slug"],
            highlight=d.get("highlight") or "none",  # type: ignore[arg-type]
        )
        for e, d in sorted(m.items())
    ]
    return CuratedBadgesListResponse(items=items)
