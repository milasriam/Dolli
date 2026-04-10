"""Admin-assigned profile badges (e.g. Early partner), keyed by account email."""

import json
import re
from typing import Any, Dict, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.platform_settings import PlatformSetting
from services.pilot_campaign_access import strict_normalize_emails

CURATED_USER_BADGES_KEY = "curated_user_badges"

_SLUG_CLEAN = re.compile(r"[^a-z0-9_]+")

# Visual promo tier for curated accounts (future: map "featured" to paid sponsorship).
CURATED_HIGHLIGHT_ALLOWED = frozenset({"none", "frame", "featured"})


def _normalize_highlight(raw: Any) -> str:
    s = str(raw or "").strip().lower()
    if s in CURATED_HIGHLIGHT_ALLOWED:
        return s
    return "none"


def slugify_badge_label(label: str) -> str:
    s = _SLUG_CLEAN.sub("_", label.strip().lower())
    s = s.strip("_") or "partner"
    return s[:64]


def _coerce_map(raw: Any) -> Dict[str, Dict[str, str]]:
    if not isinstance(raw, dict):
        return {}
    out: Dict[str, Dict[str, str]] = {}
    for k, v in raw.items():
        ek = str(k).strip().lower()
        if not ek:
            continue
        if isinstance(v, str):
            lab = v.strip()[:64]
            if not lab:
                continue
            out[ek] = {"label": lab, "slug": slugify_badge_label(lab), "highlight": "none"}
        elif isinstance(v, dict):
            lab = str(v.get("label") or "").strip()[:64]
            if not lab:
                continue
            slug_raw = str(v.get("slug") or "").strip().lower()[:64]
            if slug_raw and re.match(r"^[a-z0-9_]{1,64}$", slug_raw):
                slug = slug_raw
            else:
                slug = slugify_badge_label(lab)
            hl = _normalize_highlight(v.get("highlight") or v.get("promo_highlight"))
            out[ek] = {"label": lab, "slug": slug, "highlight": hl}
    return out


async def load_badge_map(db: AsyncSession) -> Dict[str, Dict[str, str]]:
    result = await db.execute(select(PlatformSetting.value).where(PlatformSetting.key == CURATED_USER_BADGES_KEY).limit(1))
    raw = result.scalar_one_or_none()
    if not raw or not str(raw).strip():
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return _coerce_map(data)


async def curated_badge_for_email(db: AsyncSession, email: Optional[str]) -> Optional[Dict[str, str]]:
    if not email or not str(email).strip():
        return None
    m = await load_badge_map(db)
    return m.get(str(email).strip().lower())


async def save_badge_map(db: AsyncSession, mapping: Dict[str, Dict[str, str]]) -> int:
    payload = json.dumps(mapping, ensure_ascii=False, separators=(",", ":"))
    row = await db.get(PlatformSetting, CURATED_USER_BADGES_KEY)
    if row:
        row.value = payload
    else:
        db.add(PlatformSetting(key=CURATED_USER_BADGES_KEY, value=payload))
    await db.commit()
    return len(mapping)
