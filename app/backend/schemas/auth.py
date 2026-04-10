from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class UserResponse(BaseModel):
    id: str  # Now a string UUID (platform sub)
    email: str
    name: Optional[str] = None
    role: str = "user"  # user/admin
    last_login: Optional[datetime] = None
    account_type: str = "individual"
    organization_verified: bool = False
    organization_display_name: Optional[str] = None
    platform_fee_bps: Optional[int] = None
    nsfw_filter_enabled: bool = True

    class Config:
        from_attributes = True


class AdminSetUserOrganizationRequest(BaseModel):
    """Admin-only: mark a user as a verified NPO/NGO-style organization account."""

    organization_verified: bool
    organization_display_name: Optional[str] = None
    platform_fee_bps: Optional[int] = Field(
        default=None,
        ge=0,
        le=10_000,
        description="Optional override in basis points (100 = 1%). Null = use server default for org tier.",
    )


class PlatformTokenExchangeRequest(BaseModel):
    """Request body for exchanging Platform token for app token."""

    platform_token: str


class TokenExchangeResponse(BaseModel):
    """Response body for issued application token."""

    token: str
