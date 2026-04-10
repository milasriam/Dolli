"""Schemas for AI-assisted campaign draft generation."""

from typing import List, Literal

from pydantic import BaseModel, Field, field_validator

from core.campaign_categories import CAMPAIGN_CATEGORY_SLUGS


class CampaignAiDraftRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=4000)
    model: str = Field(
        default="deepseek-v3.2",
        description="Passed through to the AI hub (must be allowed by your provider).",
    )


class CampaignAiDraftResponse(BaseModel):
    title: str
    description: str
    category: str
    goal_amount: float
    impact_statement: str
    image_url: str = ""
    gif_url: str = ""
    video_url: str = ""
    normalization_notes: List[str] = Field(default_factory=list)

    @field_validator("category")
    @classmethod
    def category_must_be_canonical(cls, v: str) -> str:
        if v not in CAMPAIGN_CATEGORY_SLUGS:
            raise ValueError("category must be a canonical slug")
        return v


class CampaignAiRefineRequest(BaseModel):
    """Regenerate a single field using the user's story + optional current text."""

    field: Literal["title", "description", "impact_statement"]
    story_context: str = Field(..., min_length=1, max_length=4000)
    current_value: str = Field(default="", max_length=2000)
    model: str = Field(
        default="deepseek-v3.2",
        description="Passed through to the AI hub.",
    )


class CampaignAiRefineResponse(BaseModel):
    value: str
    normalization_notes: List[str] = Field(default_factory=list)


class CampaignAiStatusResponse(BaseModel):
    """Public-ish flags for the SPA (no secrets)."""

    enabled: bool
    hub_configured: bool
