"""
Authenticated endpoints for AI-assisted campaign draft (full + single-field refine).
"""

import logging
import os

from fastapi import APIRouter, Depends, HTTPException, status

from core.campaign_ai_limits import record_campaign_ai_request
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from schemas.campaign_ai import (
    CampaignAiDraftRequest,
    CampaignAiDraftResponse,
    CampaignAiRefineRequest,
    CampaignAiRefineResponse,
    CampaignAiStatusResponse,
)
from services.campaign_ai import generate_campaign_ai_draft, generate_campaign_ai_refine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/campaigns", tags=["campaigns", "ai"])


def _campaign_ai_enabled() -> bool:
    raw = os.environ.get("ENABLE_CAMPAIGN_AI", "true").strip().lower()
    return raw not in ("0", "false", "no", "off")


def _ai_hub_env_configured() -> bool:
    return bool(
        (os.environ.get("APP_AI_BASE_URL") or "").strip()
        and (os.environ.get("APP_AI_KEY") or "").strip()
    )


@router.get("/ai-status", response_model=CampaignAiStatusResponse)
async def get_campaign_ai_status() -> CampaignAiStatusResponse:
    """Feature flags for the create-campaign UI (no auth)."""
    return CampaignAiStatusResponse(
        enabled=_campaign_ai_enabled(),
        hub_configured=_ai_hub_env_configured(),
    )


@router.post("/ai-draft", response_model=CampaignAiDraftResponse)
async def post_campaign_ai_draft(
    body: CampaignAiDraftRequest,
    user: UserResponse = Depends(get_current_user),
) -> CampaignAiDraftResponse:
    """
    Generate a validated campaign draft from a short natural-language prompt.
    Requires JWT and configured AI hub (APP_AI_BASE_URL / APP_AI_KEY).
    """
    if not _campaign_ai_enabled():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Campaign AI assistant is disabled on this server.",
        )

    await record_campaign_ai_request(str(user.id))
    logger.info("campaign_ai draft user_id=%s model=%s prompt_len=%s", user.id, body.model, len(body.prompt))

    try:
        return await generate_campaign_ai_draft(user_prompt=body.prompt, model=body.model)
    except ValueError as e:
        msg = str(e)
        if "not configured" in msg.lower() or "APP_AI" in msg:
            logger.error("Campaign AI: AI hub misconfiguration: %s", msg)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI service is not configured.",
            ) from e
        logger.info("Campaign AI validation error: %s", msg)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=msg,
        ) from e
    except Exception as e:
        logger.exception("Campaign AI failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI generation failed. Try again later.",
        ) from e


@router.post("/ai-refine", response_model=CampaignAiRefineResponse)
async def post_campaign_ai_refine(
    body: CampaignAiRefineRequest,
    user: UserResponse = Depends(get_current_user),
) -> CampaignAiRefineResponse:
    """Generate an alternative for one field (title, description, or impact_statement)."""
    if not _campaign_ai_enabled():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Campaign AI assistant is disabled on this server.",
        )

    await record_campaign_ai_request(str(user.id))
    logger.info(
        "campaign_ai refine user_id=%s field=%s model=%s",
        user.id,
        body.field,
        body.model,
    )

    try:
        return await generate_campaign_ai_refine(
            field=body.field,
            story_context=body.story_context,
            current_value=body.current_value or "",
            model=body.model,
        )
    except ValueError as e:
        msg = str(e)
        if "not configured" in msg.lower() or "APP_AI" in msg:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI service is not configured.",
            ) from e
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=msg,
        ) from e
    except Exception as e:
        logger.exception("Campaign AI refine failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI refinement failed. Try again later.",
        ) from e
