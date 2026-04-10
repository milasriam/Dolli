"""
Authenticated endpoint for AI-assisted campaign draft (validated JSON, category whitelist).
"""

import logging
import os

from fastapi import APIRouter, Depends, HTTPException, status

from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from schemas.campaign_ai import CampaignAiDraftRequest, CampaignAiDraftResponse
from services.campaign_ai import generate_campaign_ai_draft

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/campaigns", tags=["campaigns", "ai"])


def _campaign_ai_enabled() -> bool:
    raw = os.environ.get("ENABLE_CAMPAIGN_AI", "true").strip().lower()
    return raw not in ("0", "false", "no", "off")


@router.post("/ai-draft", response_model=CampaignAiDraftResponse)
async def post_campaign_ai_draft(
    body: CampaignAiDraftRequest,
    _user: UserResponse = Depends(get_current_user),
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
