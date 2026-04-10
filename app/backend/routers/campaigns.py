import json
import logging
import os
import re
import uuid
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.nsfw_visibility import should_redact_nsfw_campaign
from dependencies.auth import get_current_user, get_optional_current_user
from models.auth import User as AuthUser
from models.campaigns import Campaigns
from models.user_profiles import User_profiles
from schemas.auth import UserResponse
from schemas.storage import FileUpDownRequest
from services.campaigns import CampaignsService
from services.donations import DonationsService
from services.storage import StorageService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/campaigns", tags=["campaigns"])


def _is_admin(user: UserResponse) -> bool:
    return (user.role or "").strip().lower() == "admin"


def _can_manage_campaign(campaign: Campaigns, user: UserResponse) -> bool:
    return _is_admin(user) or campaign.user_id == user.id


def _sanitize_owner_campaign_update(update_dict: dict, user: UserResponse) -> dict:
    data = dict(update_dict)
    data.pop("user_id", None)
    if not _is_admin(user):
        for key in ("raised_amount", "donor_count", "share_count", "click_count", "featured"):
            data.pop(key, None)
    return data


async def _get_campaign_or_404(campaign_id: int, db: AsyncSession) -> Campaigns:
    service = CampaignsService(db)
    campaign = await service.get_by_id(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaigns not found")
    return campaign


# Narrative / media fields: owners may change these only while the row is still a draft.
_CAMPAIGN_CONTENT_FIELDS = frozenset(
    {
        "title",
        "description",
        "category",
        "goal_amount",
        "image_url",
        "gif_url",
        "video_url",
        "impact_statement",
        "urgency_level",
    }
)


async def _ensure_no_paid_donations(campaign_id: int, db: AsyncSession, user: UserResponse) -> None:
    """Block delete / revert-to-draft once the campaign has completed paid gifts."""
    if _is_admin(user):
        return
    donations = DonationsService(db)
    n = await donations.count_completed_donations_for_campaign(campaign_id)
    if n > 0:
        raise HTTPException(
            status_code=400,
            detail=(
                "This campaign already has completed donations. "
                "You can’t delete it or move it back to drafts. Contact support if you need help."
            ),
        )


# ---------- Pydantic Schemas ----------
class CampaignsData(BaseModel):
    """Entity data schema (for create/update)"""
    user_id: Optional[str] = None
    title: str
    description: str
    category: str
    goal_amount: float
    raised_amount: float = None
    donor_count: int = None
    share_count: int = None
    click_count: int = None
    image_url: str = None
    gif_url: str = None
    video_url: str = None
    status: str = None
    urgency_level: str = None
    featured: bool = None
    impact_statement: str = None
    is_nsfw: bool = False
    created_at: Optional[datetime] = None


class CampaignsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    user_id: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    goal_amount: Optional[float] = None
    raised_amount: Optional[float] = None
    donor_count: Optional[int] = None
    share_count: Optional[int] = None
    click_count: Optional[int] = None
    image_url: Optional[str] = None
    gif_url: Optional[str] = None
    video_url: Optional[str] = None
    status: Optional[str] = None
    urgency_level: Optional[str] = None
    featured: Optional[bool] = None
    impact_statement: Optional[str] = None
    is_nsfw: Optional[bool] = None
    created_at: Optional[datetime] = None


class CampaignsResponse(BaseModel):
    """Entity response schema"""
    id: int
    user_id: str
    title: str
    description: str
    category: str
    goal_amount: float
    raised_amount: Optional[float] = None
    donor_count: Optional[int] = None
    share_count: Optional[int] = None
    click_count: Optional[int] = None
    image_url: Optional[str] = None
    gif_url: Optional[str] = None
    video_url: Optional[str] = None
    status: Optional[str] = None
    urgency_level: Optional[str] = None
    featured: Optional[bool] = None
    impact_statement: Optional[str] = None
    created_at: Optional[datetime] = None
    is_nsfw: bool = False
    nsfw_content_hidden: bool = False

    class Config:
        from_attributes = True


def _campaign_response_for_viewer(campaign: Campaigns, viewer: Optional[UserResponse]) -> CampaignsResponse:
    base = CampaignsResponse.model_validate(campaign, from_attributes=True)
    is_nsfw = bool(getattr(campaign, "is_nsfw", False))
    if not is_nsfw:
        return base.model_copy(update={"is_nsfw": False, "nsfw_content_hidden": False})
    if not should_redact_nsfw_campaign(campaign, viewer):
        return base.model_copy(update={"is_nsfw": True, "nsfw_content_hidden": False})
    return base.model_copy(
        update={
            "is_nsfw": True,
            "nsfw_content_hidden": True,
            "title": "Sensitive content",
            "description": (
                "This fundraiser is marked as mature or sensitive. "
                "Turn off the NSFW filter in your profile settings to view the full page."
            ),
            "image_url": None,
            "gif_url": None,
            "video_url": None,
            "impact_statement": None,
        }
    )


class CreateCampaignEligibilityResponse(BaseModel):
    can_create: bool
    paid_donations_count: int
    admin_bypass: bool = False
    dev_bypass: bool = False
    message: Optional[str] = None


class CampaignOrganizerInsightsResponse(BaseModel):
    """Public transparency stats for the fundraiser organizer (no email)."""

    display_name: Optional[str] = None
    # Omitted (null) for verified organizations — we do not surface personal giving stats.
    paid_donations_count: Optional[int] = None
    campaigns_created_total: int
    campaigns_active_count: int
    is_verified_organization: bool = False
    organization_badge_label: Optional[str] = None


class CampaignsListResponse(BaseModel):
    """List response schema"""
    items: List[CampaignsResponse]
    total: int
    skip: int
    limit: int


class PresignCoverRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=220)


class PresignCoverResponse(BaseModel):
    upload_url: str
    access_url: str = ""
    object_key: str
    expires_at: str = ""


class CampaignsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[CampaignsData]


class CampaignsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: CampaignsUpdateData


class CampaignsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[CampaignsBatchUpdateItem]


class CampaignsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=CampaignsListResponse)
async def query_campaignss(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    search: str = Query(None, max_length=200, description="Search title and description (ilike)"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
    viewer: Optional[UserResponse] = Depends(get_optional_current_user),
):
    """Query campaignss with filtering, sorting, and pagination"""
    logger.debug(f"Querying campaignss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = CampaignsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")
        
        result = await service.get_list(
            skip=skip,
            limit=limit,
            query_dict=query_dict,
            sort=sort,
            viewer=viewer,
            search=search,
        )
        logger.debug(f"Found {result['total']} campaignss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying campaignss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/presign-cover", response_model=PresignCoverResponse)
async def presign_campaign_cover(
    body: PresignCoverRequest,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    Presigned PUT URL for a campaign cover image (JPEG/PNG/WebP).
    Set DOLLI_COVER_UPLOAD_BUCKET (and optionally DOLLI_COVER_PUBLIC_BASE_URL).
    """
    bucket = (os.environ.get("DOLLI_COVER_UPLOAD_BUCKET") or "").strip()
    if not bucket:
        raise HTTPException(
            status_code=503,
            detail="Cover upload is not configured on this server. Paste an https image URL instead.",
        )
    base = (os.environ.get("DOLLI_COVER_PUBLIC_BASE_URL") or "").rstrip("/")
    raw_name = body.filename.strip()
    ext = ""
    if "." in raw_name:
        ext = raw_name.rsplit(".", 1)[-1].lower()
        if ext not in ("jpg", "jpeg", "png", "webp", "gif"):
            ext = "jpg"
    else:
        ext = "jpg"
    safe_stem = re.sub(r"[^a-zA-Z0-9._-]+", "-", raw_name.rsplit(".", 1)[0])[:80] or "cover"
    object_key = f"campaign-covers/{current_user.id}/{uuid.uuid4().hex}-{safe_stem}.{ext}"
    try:
        svc = StorageService()
        out = await svc.create_upload_url(FileUpDownRequest(bucket_name=bucket, object_key=object_key))
    except ValueError as e:
        logger.warning("presign cover storage misconfigured: %s", e)
        raise HTTPException(status_code=503, detail="File storage is not available.") from e
    except Exception as e:
        logger.exception("presign cover failed: %s", e)
        raise HTTPException(status_code=502, detail="Could not create upload URL.") from e

    access = (out.access_url or "").strip()
    if not access and base:
        access = f"{base}/{object_key}"

    return PresignCoverResponse(
        upload_url=out.upload_url,
        access_url=access,
        object_key=object_key,
        expires_at=out.expires_at or "",
    )


@router.get("/all", response_model=CampaignsListResponse)
async def query_campaignss_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    search: str = Query(None, max_length=200, description="Search title and description (ilike)"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
    viewer: Optional[UserResponse] = Depends(get_optional_current_user),
):
    # Query campaignss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying campaignss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = CampaignsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")

        result = await service.get_list(
            skip=skip,
            limit=limit,
            query_dict=query_dict,
            sort=sort,
            viewer=viewer,
            search=search,
        )
        logger.debug(f"Found {result['total']} campaignss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying campaignss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


def _campaign_create_allowed(
    *,
    user_role: str,
    paid_donations_count: int,
) -> tuple[bool, bool, bool]:
    """Returns (can_create, admin_bypass, dev_bypass)."""
    dev_bypass = os.environ.get("ALLOW_CAMPAIGN_CREATE_WITHOUT_DONATION", "").lower() in (
        "1",
        "true",
        "yes",
    )
    if user_role == "admin" or dev_bypass:
        return True, user_role == "admin", dev_bypass
    return paid_donations_count >= 1, False, False


@router.get("/create-eligibility", response_model=CreateCampaignEligibilityResponse)
async def campaign_create_eligibility(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Whether the current user may create a campaign (requires ≥1 paid donation unless admin/dev flag)."""
    donations = DonationsService(db)
    paid = await donations.count_completed_donations_for_user(current_user.id)
    can, admin_bypass, dev_bypass = _campaign_create_allowed(
        user_role=current_user.role or "user",
        paid_donations_count=paid,
    )
    msg = None
    if not can:
        msg = (
            "Give at least once to any active campaign (completed payment) to unlock creating your own. "
            "This keeps Dolli focused on people who also support others."
        )
    return CreateCampaignEligibilityResponse(
        can_create=can,
        paid_donations_count=paid,
        admin_bypass=admin_bypass,
        dev_bypass=dev_bypass,
        message=msg,
    )


@router.get("/{id}/organizer-insights", response_model=CampaignOrganizerInsightsResponse)
async def get_campaign_organizer_insights(
    id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Aggregate public stats about who is running this campaign:
    completed gifts they’ve made on Dolli, and how many fundraisers they’ve created.
    """
    campaign = await _get_campaign_or_404(id, db)
    organizer_id = campaign.user_id

    camp_svc = CampaignsService(db)
    total = await camp_svc.count_by_user_id(organizer_id)
    active = await camp_svc.count_by_user_id(organizer_id, status="active")

    auth_row = (
        await db.execute(select(AuthUser).where(AuthUser.id == organizer_id).limit(1))
    ).scalar_one_or_none()
    is_verified = bool(
        auth_row
        and (
            bool(getattr(auth_row, "organization_verified", False))
            or (getattr(auth_row, "account_type", None) or "") == "verified_organization"
        )
    )

    prof_result = await db.execute(
        select(User_profiles).where(User_profiles.user_id == organizer_id).limit(1)
    )
    prof = prof_result.scalar_one_or_none()
    profile_display: Optional[str] = None
    if prof and prof.display_name:
        s = prof.display_name.strip()
        if s:
            profile_display = s

    org_display: Optional[str] = None
    if auth_row and getattr(auth_row, "organization_display_name", None):
        o = str(auth_row.organization_display_name).strip()
        if o:
            org_display = o

    display_name = (org_display or profile_display) if is_verified else profile_display

    donations = DonationsService(db)
    paid: Optional[int] = None
    if not is_verified:
        paid = await donations.count_completed_donations_for_user(organizer_id)

    badge_label = "Verified organization" if is_verified else None

    return CampaignOrganizerInsightsResponse(
        display_name=display_name,
        paid_donations_count=paid,
        campaigns_created_total=total,
        campaigns_active_count=active,
        is_verified_organization=is_verified,
        organization_badge_label=badge_label,
    )


@router.get("/{id}", response_model=CampaignsResponse)
async def get_campaigns(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
    viewer: Optional[UserResponse] = Depends(get_optional_current_user),
):
    """Get a single campaigns by ID"""
    logger.debug(f"Fetching campaigns with id: {id}, fields={fields}")
    
    service = CampaignsService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.warning(f"Campaigns with id {id} not found")
            raise HTTPException(status_code=404, detail="Campaigns not found")

        return _campaign_response_for_viewer(result, viewer)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching campaigns {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=CampaignsResponse, status_code=201)
async def create_campaigns(
    data: CampaignsData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new campaigns"""
    logger.debug(f"Creating new campaigns with data: {data}")
    
    service = CampaignsService(db)
    donations = DonationsService(db)
    try:
        paid = await donations.count_completed_donations_for_user(current_user.id)
        can, _, _ = _campaign_create_allowed(
            user_role=current_user.role or "user",
            paid_donations_count=paid,
        )
        if not can:
            raise HTTPException(
                status_code=403,
                detail=(
                    "At least one completed donation is required before you can create a campaign. "
                    "Explore fundraisers and donate — then come back to launch your own."
                ),
            )

        payload = data.model_dump()
        payload["user_id"] = current_user.id
        result = await service.create(payload)
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create campaigns")
        
        logger.info(f"Campaigns created successfully with id: {result.id}")
        return _campaign_response_for_viewer(result, current_user)
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error creating campaigns: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating campaigns: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[CampaignsResponse], status_code=201)
async def create_campaignss_batch(
    request: CampaignsBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create multiple campaignss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} campaignss")
    
    service = CampaignsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump())
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} campaignss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[CampaignsResponse])
async def update_campaignss_batch(
    request: CampaignsBatchUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update multiple campaignss in a single request"""
    logger.debug(f"Batch updating {len(request.items)} campaignss")
    
    service = CampaignsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} campaignss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=CampaignsResponse)
async def update_campaigns(
    id: int,
    data: CampaignsUpdateData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing campaign (owner or admin). Revert to draft only if there are no paid donations."""
    logger.debug(f"Updating campaigns {id} with data: {data}")

    campaign = await _get_campaign_or_404(id, db)
    if not _can_manage_campaign(campaign, current_user):
        raise HTTPException(status_code=403, detail="You can only edit your own campaigns.")

    update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
    update_dict = _sanitize_owner_campaign_update(update_dict, current_user)

    if not _is_admin(current_user):
        touches_content = bool(_CAMPAIGN_CONTENT_FIELDS.intersection(update_dict.keys()))
        if touches_content and (campaign.status or "").strip().lower() != "draft":
            raise HTTPException(
                status_code=400,
                detail=(
                    "You can only change text and media while the campaign is a draft. "
                    "Unpublish it from your profile first, then edit and publish again."
                ),
            )

    if update_dict.get("status") == "draft":
        await _ensure_no_paid_donations(id, db, current_user)

    if not update_dict:
        return _campaign_response_for_viewer(campaign, current_user)

    service = CampaignsService(db)
    try:
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"Campaigns with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Campaigns not found")

        logger.info(f"Campaigns {id} updated successfully")
        return _campaign_response_for_viewer(result, current_user)
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating campaigns {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating campaigns {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_campaignss_batch(
    request: CampaignsBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple campaignss by their IDs"""
    logger.debug(f"Batch deleting {len(request.ids)} campaignss")
    
    service = CampaignsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} campaignss successfully")
        return {"message": f"Successfully deleted {deleted_count} campaignss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_campaigns(
    id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a campaign (owner or admin). Allowed only while there are no completed paid donations."""
    logger.debug(f"Deleting campaigns with id: {id}")

    campaign = await _get_campaign_or_404(id, db)
    if not _can_manage_campaign(campaign, current_user):
        raise HTTPException(status_code=403, detail="You can only delete your own campaigns.")
    await _ensure_no_paid_donations(id, db, current_user)

    service = CampaignsService(db)
    try:
        success = await service.delete(id)
        if not success:
            logger.warning(f"Campaigns with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Campaigns not found")

        logger.info(f"Campaigns {id} deleted successfully")
        return {"message": "Campaigns deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting campaigns {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
