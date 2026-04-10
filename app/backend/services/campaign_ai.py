"""
AI-assisted campaign draft: call LLM, extract JSON, validate and normalize fields.
"""

import json
import logging
import re
from typing import Any

from core.campaign_categories import CAMPAIGN_CATEGORY_SLUGS, normalize_campaign_category
from schemas.aihub import ChatMessage, GenTxtRequest
from schemas.campaign_ai import CampaignAiDraftResponse
from services.aihub import AIHubService

logger = logging.getLogger(__name__)

_JSON_BLOCK = re.compile(r"\{[\s\S]*\}")


def _extract_json_object(text: str) -> dict[str, Any] | None:
    if not text or not text.strip():
        return None
    match = _JSON_BLOCK.search(text)
    if not match:
        return None
    blob = match.group(0)
    try:
        data = json.loads(blob)
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def _clamp_str(value: Any, max_len: int) -> str:
    if value is None:
        return ""
    s = str(value).strip()
    return s[:max_len] if max_len else s


def _clamp_goal(value: Any) -> float:
    try:
        n = float(value)
    except (TypeError, ValueError):
        return 1000.0
    n = int(round(n))
    return float(max(500, min(10000, n)))


def build_campaign_ai_system_prompt() -> str:
    cats = ", ".join(CAMPAIGN_CATEGORY_SLUGS)
    return f"""You are a campaign creation assistant for Dolli, a social-native micro-donation platform.
The user describes a cause; you return ONLY valid JSON (no markdown fences, no commentary) with this shape:
{{
  "title": "compelling title (max 60 chars)",
  "description": "emotional, concrete story (max 200 chars)",
  "category": "one of: {cats}",
  "goal_amount": <number between 500 and 10000>,
  "impact_statement": "what $1 achieves (max 80 chars)",
  "image_url": "optional https URL or empty string",
  "gif_url": "optional .gif URL or empty string",
  "video_url": "optional direct .mp4 URL or empty string"
}}
Use only the listed category slugs exactly. If unsure, pick the closest slug."""


async def generate_campaign_ai_draft(*, user_prompt: str, model: str) -> CampaignAiDraftResponse:
    service = AIHubService()
    req = GenTxtRequest(
        messages=[
            ChatMessage(role="system", content=build_campaign_ai_system_prompt()),
            ChatMessage(role="user", content=user_prompt.strip()),
        ],
        model=model,
        stream=False,
        temperature=0.35,
        max_tokens=1024,
    )
    raw = await service.gentxt(req)
    content = (raw.content or "").strip()
    data = _extract_json_object(content)
    if not data:
        logger.warning("campaign_ai: could not parse JSON from model output (len=%s)", len(content))
        raise ValueError("Model did not return valid JSON. Try again or shorten your prompt.")

    title = _clamp_str(data.get("title"), 60) or "Support this cause"
    description = _clamp_str(data.get("description"), 200) or title
    goal_amount = _clamp_goal(data.get("goal_amount"))
    impact_statement = _clamp_str(data.get("impact_statement"), 80)

    category, cat_notes = normalize_campaign_category(data.get("category"))
    image_url = _clamp_str(data.get("image_url"), 2000)
    gif_url = _clamp_str(data.get("gif_url"), 2000)
    video_url = _clamp_str(data.get("video_url"), 2000)

    notes = list(cat_notes)
    if not impact_statement:
        notes.append("impact_statement was empty; user should fill it in")

    return CampaignAiDraftResponse(
        title=title,
        description=description,
        category=category,
        goal_amount=goal_amount,
        impact_statement=impact_statement,
        image_url=image_url,
        gif_url=gif_url,
        video_url=video_url,
        normalization_notes=notes,
    )
