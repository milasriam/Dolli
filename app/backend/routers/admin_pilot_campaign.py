"""Admin-only: pilot users who may create campaigns without a prior paid donation."""

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_admin_user
from schemas.auth import UserResponse
from services import pilot_campaign_access as pilot_access

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/admin/pilot-campaign-creators", tags=["admin", "pilot-campaign"])


class PilotCampaignCreatorsResponse(BaseModel):
    """Emails from env vs database vs merged effective set."""

    env_emails: List[str]
    database_emails: List[str]
    effective_emails: List[str]


class PilotCampaignCreatorsUpdate(BaseModel):
    emails: List[str] = Field(default_factory=list)

    @field_validator("emails", mode="before")
    @classmethod
    def coerce_strings(cls, v):
        if v is None:
            return []
        if isinstance(v, str):
            parts = [p.strip() for p in v.replace("\n", ",").split(",")]
            return [p for p in parts if p]
        return v


@router.get("", response_model=PilotCampaignCreatorsResponse)
async def get_pilot_campaign_creators(
    _admin: UserResponse = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    env_set = pilot_access.env_pilot_campaign_emails()
    db_set = await pilot_access.db_pilot_campaign_emails(db)
    merged_set = await pilot_access.merged_pilot_campaign_emails(db)
    return PilotCampaignCreatorsResponse(
        env_emails=sorted(env_set),
        database_emails=sorted(db_set),
        effective_emails=sorted(merged_set),
    )


@router.put("", response_model=PilotCampaignCreatorsResponse)
async def put_pilot_campaign_creators(
    body: PilotCampaignCreatorsUpdate,
    _admin: UserResponse = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    raw = [str(e) for e in body.emails]
    try:
        n = await pilot_access.set_database_pilot_campaign_emails(db, raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    logger.info("Pilot campaign creator list updated in DB (%d emails)", n)
    env_set = pilot_access.env_pilot_campaign_emails()
    db_set = await pilot_access.db_pilot_campaign_emails(db)
    merged_set = await pilot_access.merged_pilot_campaign_emails(db)
    return PilotCampaignCreatorsResponse(
        env_emails=sorted(env_set),
        database_emails=sorted(db_set),
        effective_emails=sorted(merged_set),
    )
