from datetime import datetime
from typing import List, Optional

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
    # Admin-curated (platform_settings); shown as a badge in the app, not in JWT.
    curated_badge_label: Optional[str] = None
    curated_badge_slug: Optional[str] = None
    # Extra visual treatment for invited partners: "frame" (contrast ring), "featured" (reserved for future paid promo).
    curated_highlight: Optional[str] = None

    class Config:
        from_attributes = True


class EarlyDonorMilestoneResponse(BaseModel):
    """First-wave donor recognition (distinct users by first paid gift time)."""

    rank: Optional[int] = None
    """1-based position; null if the user has no completed paid donation."""

    milestone: Optional[int] = None
    """Smallest tier unlocked: 100, 1000, or 10000; null if rank is above all tiers."""

    total_distinct_donors: int = 0
    """How many distinct accounts have at least one completed paid donation."""


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


class LoginOptionsResponse(BaseModel):
    """Public: which sign-in methods the SPA should show."""

    google_oidc: bool = False
    tiktok: bool = False
    meta_facebook: bool = False
    password: bool = False
    local_demo_redirect: bool = False


class UserNotificationResponse(BaseModel):
    id: int
    kind: str
    title: str
    body: Optional[str] = None
    campaign_id: Optional[int] = None
    actor_user_id: Optional[str] = None
    read_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserNotificationListResponse(BaseModel):
    items: List[UserNotificationResponse]
    total: int
    skip: int
    limit: int


class UnreadNotificationsResponse(BaseModel):
    count: int


class MarkNotificationsReadRequest(BaseModel):
    ids: List[int] = Field(default_factory=list)
