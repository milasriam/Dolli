"""Campaigns surfaced by people you follow (paid gifts + share links they created)."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional, Sequence

from models.auth import User
from models.campaigns import Campaigns
from models.donations import Donations
from models.referrals import Referrals
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.nsfw_visibility import apply_nsfw_list_filter

if False:  # TYPE_CHECKING
    from schemas.auth import UserResponse

logger = logging.getLogger(__name__)


@dataclass
class NetworkActivityRow:
    activity_type: str  # donation | share
    occurred_at: datetime
    actor_user_id: str
    campaign_id: int
    donation_amount: Optional[float] = None


async def build_network_activity_feed(
    db: AsyncSession,
    *,
    following_ids: Sequence[str],
    skip: int = 0,
    limit: int = 24,
    viewer: Optional["UserResponse"] = None,
) -> Dict[str, Any]:
    ids = [x for x in following_ids if x]
    if not ids:
        return {"items": [], "total": 0, "skip": skip, "limit": limit}

    try:
        d_rows = (
            await db.execute(
                select(Donations, Campaigns)
                .join(Campaigns, Campaigns.id == Donations.campaign_id)
                .where(
                    Donations.user_id.in_(ids),
                    Donations.payment_status == "paid",
                    Campaigns.status == "active",
                )
                .order_by(Donations.created_at.desc().nulls_last(), Donations.id.desc())
                .limit(400)
            )
        ).all()

        r_rows = (
            await db.execute(
                select(Referrals, Campaigns)
                .join(Campaigns, Campaigns.id == Referrals.campaign_id)
                .where(
                    Referrals.user_id.in_(ids),
                    Campaigns.status == "active",
                )
                .order_by(Referrals.created_at.desc().nulls_last(), Referrals.id.desc())
                .limit(400)
            )
        ).all()

        events: List[NetworkActivityRow] = []
        for d, c in d_rows:
            if d.created_at is None:
                continue
            events.append(
                NetworkActivityRow(
                    activity_type="donation",
                    occurred_at=d.created_at,
                    actor_user_id=str(d.user_id),
                    campaign_id=int(c.id),
                    donation_amount=float(d.amount or 0),
                )
            )
        for ref, c in r_rows:
            if ref.created_at is None:
                continue
            events.append(
                NetworkActivityRow(
                    activity_type="share",
                    occurred_at=ref.created_at,
                    actor_user_id=str(ref.user_id),
                    campaign_id=int(c.id),
                    donation_amount=None,
                )
            )

        events.sort(key=lambda e: e.occurred_at, reverse=True)

        # Dedupe consecutive same campaign keeping most recent activity only (cleaner cards)
        seen_campaign_order: List[int] = []
        deduped: List[NetworkActivityRow] = []
        for e in events:
            if e.campaign_id in seen_campaign_order:
                continue
            seen_campaign_order.append(e.campaign_id)
            deduped.append(e)

        total = len(deduped)
        page = deduped[skip : skip + limit]
        if not page:
            return {"items": [], "total": total, "skip": skip, "limit": limit}

        camp_ids = list({e.campaign_id for e in page})
        q = select(Campaigns).where(Campaigns.id.in_(camp_ids))
        count_q = select(Campaigns.id).where(Campaigns.id.in_(camp_ids))
        q, _count = apply_nsfw_list_filter(q, count_q, viewer)
        cmap = {c.id: c for c in (await db.execute(q)).scalars().all()}

        actor_ids = list({e.actor_user_id for e in page})
        umap: Dict[str, User] = {}
        if actor_ids:
            urows = await db.execute(select(User).where(User.id.in_(actor_ids)))
            umap = {str(u.id): u for u in urows.scalars().all()}

        def _actor_label(uid: str) -> str:
            u = umap.get(uid)
            if not u:
                return "Someone you follow"
            nm = (u.name or "").strip()
            if nm:
                return nm
            em = (u.email or "").strip()
            if "@" in em:
                loc = em.split("@", 1)[0]
                return (loc[:2] + "…") if len(loc) > 2 else "Member"
            return "Member"

        items: List[Dict[str, Any]] = []
        for e in page:
            c = cmap.get(e.campaign_id)
            if not c:
                continue
            items.append(
                {
                    "activity_type": e.activity_type,
                    "occurred_at": e.occurred_at.isoformat() if e.occurred_at else None,
                    "actor_user_id": e.actor_user_id,
                    "actor_display_name": _actor_label(e.actor_user_id),
                    "donation_amount": e.donation_amount,
                    "campaign": c,
                }
            )

        return {"items": items, "total": total, "skip": skip, "limit": limit}
    except Exception as exc:
        logger.error("network_activity_feed failed: %s", exc)
        raise
