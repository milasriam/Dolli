from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


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
    # Account & linked social (for profile / security UI).
    has_password: bool = False
    tiktok_connected: bool = False
    tiktok_primary_login: bool = False
    tiktok_display_name: Optional[str] = None
    meta_connected: bool = False
    meta_primary_login: bool = False
    meta_display_name: Optional[str] = None
    instagram_handle: Optional[str] = None

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
    """Public: which sign-in methods the SPA should show.

    password: email/password form (DB-backed and/or legacy single-account).
    email_signup: POST /register enabled.
    magic_link: magic-link email sign-in (requires SMTP + ALLOW_MAGIC_LINK).
    password_reset: forgot-password email (requires SMTP + ALLOW_PASSWORD_RESET).
    """

    google_oidc: bool = False
    tiktok: bool = False
    meta_facebook: bool = False
    password: bool = False
    email_signup: bool = False
    magic_link: bool = False
    password_reset: bool = False
    local_demo_redirect: bool = False


class SocialAuthorizeUrlResponse(BaseModel):
    """JSON alternative to 302 OAuth start — SPA opens url in the browser (Bearer not sent to TikTok/Meta)."""

    url: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    """Always generic to avoid email enumeration."""

    sent: bool = True


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=10, max_length=500)
    password: str = Field(..., min_length=8, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=200)
    new_password: str = Field(..., min_length=8, max_length=128)


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
