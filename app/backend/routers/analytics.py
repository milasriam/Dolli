import json
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from typing import List, Optional

from core.database import get_db
from dependencies.auth import get_admin_user, get_current_user, get_optional_current_user
from schemas.auth import UserResponse
from models.donations import Donations
from models.campaigns import Campaigns
from models.referrals import Referrals
from models.user_profiles import User_profiles
from models.client_product_events import ClientProductEvent

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])
admin_router = APIRouter(prefix="/api/v1/admin/analytics", tags=["admin", "analytics"])
logger = logging.getLogger(__name__)


class CampaignStats(BaseModel):
    total_campaigns: int = 0
    total_raised: float = 0
    total_donors: int = 0
    total_shares: int = 0
    avg_completion: float = 0


class ReferralFunnel(BaseModel):
    total_shares: int = 0
    total_clicks: int = 0
    total_signups: int = 0
    total_donations: int = 0
    click_rate: float = 0
    signup_rate: float = 0
    donation_rate: float = 0
    viral_coefficient: float = 0


class TopDonor(BaseModel):
    user_id: str
    display_name: str = "Anonymous"
    total_donated: float = 0
    donation_count: int = 0
    referral_count: int = 0


class PlatformMetrics(BaseModel):
    platform: str
    shares: int = 0
    clicks: int = 0
    donations: int = 0
    conversion_rate: float = 0


@router.get("/campaign-stats")
async def get_campaign_stats(
    db: AsyncSession = Depends(get_db),
):
    """Get overall campaign statistics"""
    try:
        result = await db.execute(
            select(
                func.count(Campaigns.id).label("total_campaigns"),
                func.coalesce(func.sum(Campaigns.raised_amount), 0).label("total_raised"),
                func.coalesce(func.sum(Campaigns.donor_count), 0).label("total_donors"),
                func.coalesce(func.sum(Campaigns.share_count), 0).label("total_shares"),
            ).where(Campaigns.status == "active")
        )
        row = result.one()

        avg_result = await db.execute(
            select(
                func.avg(
                    case(
                        (Campaigns.goal_amount > 0, Campaigns.raised_amount * 100.0 / Campaigns.goal_amount),
                        else_=0,
                    )
                ).label("avg_completion")
            ).where(Campaigns.status == "active")
        )
        avg_row = avg_result.one()

        return CampaignStats(
            total_campaigns=row.total_campaigns or 0,
            total_raised=float(row.total_raised or 0),
            total_donors=int(row.total_donors or 0),
            total_shares=int(row.total_shares or 0),
            avg_completion=float(avg_row.avg_completion or 0),
        )
    except Exception as e:
        logger.error(f"Error getting campaign stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/referral-funnel")
async def get_referral_funnel(
    db: AsyncSession = Depends(get_db),
):
    """Get referral funnel analytics"""
    try:
        result = await db.execute(
            select(
                func.coalesce(func.sum(Referrals.clicks), 0).label("total_clicks"),
                func.coalesce(func.sum(Referrals.signups), 0).label("total_signups"),
                func.coalesce(func.sum(Referrals.donations_count), 0).label("total_donations"),
                func.count(Referrals.id).label("total_shares"),
            )
        )
        row = result.one()

        total_shares = int(row.total_shares or 0)
        total_clicks = int(row.total_clicks or 0)
        total_signups = int(row.total_signups or 0)
        total_donations = int(row.total_donations or 0)

        click_rate = (total_clicks / total_shares * 100) if total_shares > 0 else 0
        signup_rate = (total_signups / total_clicks * 100) if total_clicks > 0 else 0
        donation_rate = (total_donations / total_signups * 100) if total_signups > 0 else 0
        viral_coefficient = (total_donations / total_shares) if total_shares > 0 else 0

        return ReferralFunnel(
            total_shares=total_shares,
            total_clicks=total_clicks,
            total_signups=total_signups,
            total_donations=total_donations,
            click_rate=round(click_rate, 2),
            signup_rate=round(signup_rate, 2),
            donation_rate=round(donation_rate, 2),
            viral_coefficient=round(viral_coefficient, 3),
        )
    except Exception as e:
        logger.error(f"Error getting referral funnel: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/platform-metrics")
async def get_platform_metrics(
    db: AsyncSession = Depends(get_db),
):
    """Get metrics broken down by social platform"""
    try:
        result = await db.execute(
            select(
                Referrals.platform,
                func.count(Referrals.id).label("shares"),
                func.coalesce(func.sum(Referrals.clicks), 0).label("clicks"),
                func.coalesce(func.sum(Referrals.donations_count), 0).label("donations"),
            ).group_by(Referrals.platform)
        )
        rows = result.all()

        metrics = []
        for row in rows:
            shares = int(row.shares or 0)
            donations = int(row.donations or 0)
            conversion = (donations / shares * 100) if shares > 0 else 0
            metrics.append(
                PlatformMetrics(
                    platform=row.platform or "other",
                    shares=shares,
                    clicks=int(row.clicks or 0),
                    donations=donations,
                    conversion_rate=round(conversion, 2),
                )
            )

        return metrics
    except Exception as e:
        logger.error(f"Error getting platform metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class CreateReferralRequest(BaseModel):
    campaign_id: int
    platform: str = "other"


class ReferralResponse(BaseModel):
    referral_token: str
    share_url: str


@router.post("/create-referral", response_model=ReferralResponse)
async def create_referral(
    data: CreateReferralRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a referral token for sharing"""
    try:
        import uuid

        token = f"{current_user.id[:8]}_{data.campaign_id}_{uuid.uuid4().hex[:6]}"

        referral = Referrals(
            user_id=current_user.id,
            campaign_id=data.campaign_id,
            referral_token=token,
            platform=data.platform,
            clicks=0,
            signups=0,
            donations_count=0,
            donations_amount=0,
            created_at=datetime.now(),
        )
        db.add(referral)
        camp_result = await db.execute(select(Campaigns).where(Campaigns.id == data.campaign_id))
        campaign = camp_result.scalar_one_or_none()
        if campaign:
            campaign.share_count = int(campaign.share_count or 0) + 1
        await db.commit()

        return ReferralResponse(
            referral_token=token,
            share_url=f"/api/share/campaign/{data.campaign_id}?ref={token}",
        )
    except Exception as e:
        logger.error(f"Error creating referral: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/track-click")
async def track_referral_click(
    referral_token: str,
    db: AsyncSession = Depends(get_db),
):
    """Track a referral link click"""
    try:
        result = await db.execute(
            select(Referrals).where(Referrals.referral_token == referral_token)
        )
        referral = result.scalar_one_or_none()
        if referral:
            referral.clicks = (referral.clicks or 0) + 1
            await db.commit()
        return {"status": "tracked"}
    except Exception as e:
        logger.error(f"Error tracking click: {e}")
        return {"status": "error"}


class ClientEventBody(BaseModel):
    event: str = Field(..., max_length=64)
    payload: dict = Field(default_factory=dict)

    @field_validator("event")
    @classmethod
    def normalize_event(cls, v: str) -> str:
        s = (v or "").strip()
        if not s:
            raise ValueError("event is required")
        return s[:64]

    @field_validator("payload")
    @classmethod
    def payload_size(cls, v: dict) -> dict:
        raw = json.dumps(v, ensure_ascii=False, default=str)
        if len(raw) > 4096:
            raise ValueError("payload too large")
        return v


@router.post("/client-event", status_code=204)
async def client_event(
    body: ClientEventBody,
    request: Request,
    db: AsyncSession = Depends(get_db),
    viewer: Optional[UserResponse] = Depends(get_optional_current_user),
):
    """Product analytics: logged and stored append-only when the DB table exists."""
    uid = viewer.id if viewer else None
    logger.info(
        "client_event event=%r user_id=%r ip=%r payload=%r",
        body.event,
        uid,
        request.client.host if request.client else None,
        body.payload,
    )
    try:
        row = ClientProductEvent(
            event=body.event,
            user_id=uid,
            payload=body.payload or {},
            created_at=datetime.now(timezone.utc),
        )
        db.add(row)
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.warning("client_event DB write failed (run migrations?): %s", exc, exc_info=True)
    return Response(status_code=204)


class ProductEventBucket(BaseModel):
    event: str
    count: int


class ProductEventSummaryResponse(BaseModel):
    since_iso: str
    days: int
    total: int
    by_event: List[ProductEventBucket]


@admin_router.get("/product-events-summary", response_model=ProductEventSummaryResponse)
async def product_events_summary(
    days: int = Query(7, ge=1, le=90),
    _admin: UserResponse = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Aggregated client-side product events (admin)."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    try:
        result = await db.execute(
            select(ClientProductEvent.event, func.count(ClientProductEvent.id))
            .where(ClientProductEvent.created_at >= since)
            .group_by(ClientProductEvent.event)
            .order_by(func.count(ClientProductEvent.id).desc())
        )
        rows = result.all()
        total_row = await db.execute(
            select(func.count(ClientProductEvent.id)).where(ClientProductEvent.created_at >= since)
        )
        total = int(total_row.scalar() or 0)
    except Exception as exc:
        logger.exception("product_events_summary query failed: %s", exc)
        raise HTTPException(status_code=500, detail="Could not load event summary") from exc

    return ProductEventSummaryResponse(
        since_iso=since.isoformat(),
        days=days,
        total=total,
        by_event=[ProductEventBucket(event=r[0], count=int(r[1])) for r in rows],
    )