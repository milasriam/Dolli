"""
Authenticated endpoints for AI-assisted campaign draft (full + single-field refine).
"""

import logging
import os

from fastapi import APIRouter, Depends, HTTPException, status
from openai import (
    APIConnectionError,
    APITimeoutError,
    AuthenticationError,
    BadRequestError,
    RateLimitError,
)

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
from core.ai_credentials import is_ai_hub_configured
from services.campaign_ai import generate_campaign_ai_draft, generate_campaign_ai_refine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/campaigns", tags=["campaigns", "ai"])


def _campaign_ai_enabled() -> bool:
    raw = os.environ.get("ENABLE_CAMPAIGN_AI", "true").strip().lower()
    return raw not in ("0", "false", "no", "off")


def _campaign_ai_default_model() -> str:
    return (os.environ.get("CAMPAIGN_AI_MODEL") or "gpt-4o-mini").strip() or "gpt-4o-mini"


def _ai_hub_env_configured() -> bool:
    return is_ai_hub_configured()


def _http_for_openai_error(exc: BaseException) -> HTTPException | None:
    """Turn OpenAI SDK errors into HTTP errors with actionable detail text."""
    if isinstance(exc, RateLimitError):
        low = str(exc).lower()
        if "insufficient_quota" in low:
            return HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    "OpenAI has no usable quota for this API key (billing or limits). "
                    "See https://platform.openai.com/account/billing — then try again."
                ),
            )
        return HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="The AI provider is rate-limiting requests. Wait a minute and try again.",
        )
    if isinstance(exc, AuthenticationError):
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The AI provider rejected the API key. Check server configuration.",
        )
    if isinstance(exc, (APIConnectionError, APITimeoutError)):
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not reach the AI provider. Try again later.",
        )
    if isinstance(exc, BadRequestError):
        logger.info("Campaign AI provider BadRequest: %s", exc)
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The AI provider rejected the request (model or parameters). Try again or change the model.",
        )
    return None


@router.get("/ai-status", response_model=CampaignAiStatusResponse)
async def get_campaign_ai_status() -> CampaignAiStatusResponse:
    """Feature flags for the create-campaign UI (no auth)."""
    return CampaignAiStatusResponse(
        enabled=_campaign_ai_enabled(),
        hub_configured=_ai_hub_env_configured(),
        default_model=_campaign_ai_default_model(),
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
    except (RateLimitError, AuthenticationError, APIConnectionError, APITimeoutError, BadRequestError) as e:
        mapped = _http_for_openai_error(e)
        if mapped:
            if isinstance(e, RateLimitError):
                logger.warning("Campaign AI draft rate limit: %s", e)
            elif isinstance(e, AuthenticationError):
                logger.error("Campaign AI draft auth error: %s", e)
            else:
                logger.info("Campaign AI draft provider error: %s", e)
            raise mapped from e
        raise
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
    except (RateLimitError, AuthenticationError, APIConnectionError, APITimeoutError, BadRequestError) as e:
        mapped = _http_for_openai_error(e)
        if mapped:
            if isinstance(e, RateLimitError):
                logger.warning("Campaign AI refine rate limit: %s", e)
            elif isinstance(e, AuthenticationError):
                logger.error("Campaign AI refine auth error: %s", e)
            else:
                logger.info("Campaign AI refine provider error: %s", e)
            raise mapped from e
        raise
    except Exception as e:
        logger.exception("Campaign AI refine failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI refinement failed. Try again later.",
        ) from e
