import logging
import os
from datetime import datetime, timezone
from typing import Optional

from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.nsfw_visibility import should_redact_nsfw_campaign
from models.auth import User as AuthUser
from models.campaigns import Campaigns
from models.donations import Donations
from schemas.auth import UserResponse
from services.notify_email import send_donation_receipt_email
from services.payment_providers import (
    PaymentProviderError,
    create_halyk_checkout,
    create_kaspi_checkout,
    verify_halyk_payment,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/payment", tags=["payment"])


class CreatePaymentSessionRequest(BaseModel):
    campaign_id: int
    amount: float = Field(..., gt=0)
    referral_token: str = ""
    source_platform: str = "direct"
    provider: str = "halyk_epay"


class VerifyPaymentRequest(BaseModel):
    invoice_id: Optional[str] = None
    provider: Optional[str] = None
    session_id: Optional[str] = None


class HalykCallbackRequest(BaseModel):
    invoiceId: Optional[str] = None
    invoiceID: Optional[str] = None
    resultCode: Optional[str] = None
    reasonCode: Optional[str] = None
    reference: Optional[str] = None
    id: Optional[str] = None
    statusName: Optional[str] = None


def _normalize_provider(provider: Optional[str]) -> str:
    value = (provider or "halyk_epay").strip().lower()
    if value in {"halyk", "halyk_epay", "epay", "halyk-epay"}:
        return "halyk_epay"
    if value in {"kaspi", "kaspi_pay", "kaspi-pay"}:
        return "kaspi_pay"
    raise HTTPException(status_code=400, detail="Unsupported payment provider")


async def _get_campaign_or_404(db: AsyncSession, campaign_id: int) -> Campaigns:
    result = await db.execute(select(Campaigns).where(Campaigns.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


def _env_fee_bps(key: str, fallback: int) -> int:
    raw = os.environ.get(key, str(fallback))
    try:
        return max(0, min(10_000, int(raw)))
    except ValueError:
        return fallback


async def _organizer_platform_fee_bps(db: AsyncSession, organizer_user_id: str) -> int:
    """Effective fee tier for the campaign owner (logged at checkout; provider split not wired yet)."""
    result = await db.execute(select(AuthUser).where(AuthUser.id == organizer_user_id).limit(1))
    organizer = result.scalar_one_or_none()
    if not organizer:
        return _env_fee_bps("PLATFORM_FEE_BPS_INDIVIDUAL", 300)
    override = getattr(organizer, "platform_fee_bps", None)
    if override is not None:
        return max(0, min(10_000, int(override)))
    is_org = bool(getattr(organizer, "organization_verified", False)) or (
        (getattr(organizer, "account_type", None) or "") == "verified_organization"
    )
    if is_org:
        return _env_fee_bps("PLATFORM_FEE_BPS_VERIFIED_ORGANIZATION", 500)
    return _env_fee_bps("PLATFORM_FEE_BPS_INDIVIDUAL", 300)


async def _get_donation_by_invoice(db: AsyncSession, invoice_id: str) -> Donations | None:
    result = await db.execute(select(Donations).where(Donations.provider_invoice_id == invoice_id))
    return result.scalar_one_or_none()


async def _mark_paid_if_needed(
    db: AsyncSession,
    donation: Donations,
    provider_reference: Optional[str] = None,
) -> tuple[Donations, bool]:
    """Returns (donation, newly_marked_paid)."""
    already_paid = donation.payment_status == "paid"
    donation.payment_status = "paid"
    if provider_reference:
        donation.provider_reference = provider_reference

    if donation.created_at is None:
        donation.created_at = datetime.now(timezone.utc)

    newly = not already_paid
    if newly:
        campaign = await _get_campaign_or_404(db, donation.campaign_id)
        campaign.raised_amount = float(campaign.raised_amount or 0) + float(donation.amount or 0)
        campaign.donor_count = int(campaign.donor_count or 0) + 1

    await db.commit()
    await db.refresh(donation)
    return donation, newly


async def _email_donor_receipt(db: AsyncSession, donation: Donations, campaign_title: str) -> None:
    result = await db.execute(select(AuthUser).where(AuthUser.id == donation.user_id).limit(1))
    user_row = result.scalar_one_or_none()
    if user_row and getattr(user_row, "email", None):
        await send_donation_receipt_email(
            str(user_row.email),
            campaign_title,
            float(donation.amount or 0),
        )


async def _mark_failed(
    db: AsyncSession,
    donation: Donations,
    provider_reference: Optional[str] = None,
) -> Donations:
    donation.payment_status = "failed"
    if provider_reference:
        donation.provider_reference = provider_reference
    await db.commit()
    await db.refresh(donation)
    return donation


@router.post("/create_payment_session")
async def create_payment_session(
    payload: CreatePaymentSessionRequest,
    request: Request,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    provider = _normalize_provider(payload.provider)
    campaign = await _get_campaign_or_404(db, payload.campaign_id)
    if should_redact_nsfw_campaign(campaign, current_user):
        raise HTTPException(
            status_code=403,
            detail="This fundraiser is marked as sensitive. Turn off the NSFW filter in your profile to donate.",
        )
    fee_bps = await _organizer_platform_fee_bps(db, campaign.user_id)
    logger.info(
        "create_payment_session campaign_id=%s organizer_id=%s platform_fee_bps=%s (checkout split not implemented)",
        campaign.id,
        campaign.user_id,
        fee_bps,
    )

    donation = Donations(
        user_id=str(current_user.id),
        campaign_id=payload.campaign_id,
        amount=float(payload.amount),
        payment_status="pending",
        payment_provider=provider,
        source_platform=payload.source_platform or "direct",
        referral_token=payload.referral_token or "",
        created_at=datetime.now(timezone.utc),
    )
    db.add(donation)
    await db.flush()

    try:
        if provider == "halyk_epay":
            intent = await create_halyk_checkout(
                request=request,
                donation_id=donation.id,
                campaign_id=campaign.id,
                campaign_title=campaign.title,
                amount=float(payload.amount),
                customer_email=current_user.email,
            )
        else:
            intent = create_kaspi_checkout(campaign.id)
    except PaymentProviderError as exc:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:
        await db.rollback()
        logger.exception("Unexpected payment initialization error")
        raise HTTPException(status_code=500, detail="Failed to initialize payment")

    donation.provider_invoice_id = intent.invoice_id
    donation.provider_reference = intent.provider_reference
    await db.commit()
    await db.refresh(donation)

    return {
        "donation_id": donation.id,
        "provider": intent.provider,
        "action": intent.action,
        "status": intent.status,
        "invoice_id": intent.invoice_id,
        "url": intent.url,
        "message": intent.message,
        "payment_payload": intent.payment_payload,
        "platform_fee_bps": fee_bps,
        "platform_fee_disclosure": (
            "A platform fee (basis points on the organizer side) is recorded at checkout. "
            "You always see the amount you choose to give."
        ),
    }


@router.post("/verify_payment")
async def verify_payment(
    payload: VerifyPaymentRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    invoice_id = payload.invoice_id or payload.session_id
    if not invoice_id:
        raise HTTPException(status_code=400, detail="invoice_id is required")

    donation = await _get_donation_by_invoice(db, invoice_id)
    if not donation or donation.user_id != str(current_user.id):
        raise HTTPException(status_code=404, detail="Donation not found")

    provider = _normalize_provider(payload.provider or donation.payment_provider)

    if provider == "kaspi_pay":
        st = donation.payment_status or "pending"
        out = {
            "provider": provider,
            "invoice_id": invoice_id,
            "status": st,
            "payment_status": st,
            "campaign_id": donation.campaign_id,
            "amount": donation.amount,
            "message": "Kaspi Pay payments are currently confirmed manually.",
        }
        if st == "pending":
            out["retry_after_seconds"] = 8
        return out

    try:
        verification = await verify_halyk_payment(invoice_id)
    except PaymentProviderError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:
        logger.exception("Unexpected Halyk verification error for invoice %s", invoice_id)
        raise HTTPException(status_code=500, detail="Failed to verify payment")

    if verification.status == "paid":
        donation, newly = await _mark_paid_if_needed(db, donation, verification.provider_reference)
        if newly:
            camp = await _get_campaign_or_404(db, donation.campaign_id)
            await _email_donor_receipt(db, donation, camp.title or "your fundraiser")
            try:
                from services.campaign_progress_notifications import run_campaign_progress_after_pledge

                new_r = float(camp.raised_amount or 0)
                old_r = new_r - float(donation.amount or 0)
                await run_campaign_progress_after_pledge(db, camp, old_raised=old_r, new_raised=new_r)
            except Exception:
                logger.exception(
                    "campaign_progress_notifications failed campaign_id=%s",
                    donation.campaign_id,
                )
    elif verification.status == "failed":
        donation = await _mark_failed(db, donation, verification.provider_reference)
    else:
        if verification.provider_reference:
            donation.provider_reference = verification.provider_reference
            await db.commit()
            await db.refresh(donation)

    st = donation.payment_status or verification.status
    out = {
        "provider": verification.provider,
        "invoice_id": verification.invoice_id,
        "status": st,
        "payment_status": donation.payment_status or verification.payment_status,
        "campaign_id": donation.campaign_id,
        "amount": donation.amount,
        "provider_reference": donation.provider_reference,
        "raw": verification.raw,
    }
    if st == "pending":
        out["retry_after_seconds"] = 5
    return out


@router.post("/providers/halyk/callback")
async def halyk_callback(payload: HalykCallbackRequest, db: AsyncSession = Depends(get_db)):
    invoice_id = payload.invoiceId or payload.invoiceID
    if not invoice_id:
        raise HTTPException(status_code=400, detail="invoiceId is required")

    donation = await _get_donation_by_invoice(db, invoice_id)
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")

    result_code = str(payload.resultCode or "").strip()
    reason_code = str(payload.reasonCode or "").strip()
    status_name = str(payload.statusName or "").upper()
    provider_reference = payload.reference or payload.id

    if result_code == "100" and reason_code in {"", "00"}:
        donation, newly = await _mark_paid_if_needed(db, donation, provider_reference)
        if newly:
            camp = await _get_campaign_or_404(db, donation.campaign_id)
            await _email_donor_receipt(db, donation, camp.title or "your fundraiser")
            try:
                from services.campaign_progress_notifications import run_campaign_progress_after_pledge

                new_r = float(camp.raised_amount or 0)
                old_r = new_r - float(donation.amount or 0)
                await run_campaign_progress_after_pledge(db, camp, old_raised=old_r, new_raised=new_r)
            except Exception:
                logger.exception(
                    "campaign_progress_notifications failed campaign_id=%s",
                    donation.campaign_id,
                )
        status_value = donation.payment_status
    elif result_code in {"107", "200", "201"} or status_name in {"NEW", "AUTH", "IN_PROGRESS", "PENDING"}:
        if provider_reference:
            donation.provider_reference = provider_reference
            await db.commit()
            await db.refresh(donation)
        status_value = donation.payment_status or "pending"
    else:
        donation = await _mark_failed(db, donation, provider_reference)
        status_value = donation.payment_status

    return {
        "ok": True,
        "invoice_id": invoice_id,
        "status": status_value,
    }
