"""NSFW / sensitive campaign visibility (list filter + detail redaction)."""

from typing import Optional, Tuple

from sqlalchemy import or_
from sqlalchemy.sql import Select

from models.campaigns import Campaigns
from schemas.auth import UserResponse


def is_admin_user(user: UserResponse) -> bool:
    return (user.role or "").strip().lower() == "admin"


def should_redact_nsfw_campaign(campaign: Campaigns, viewer: Optional[UserResponse]) -> bool:
    if not bool(getattr(campaign, "is_nsfw", False)):
        return False
    if viewer is None:
        return True
    if is_admin_user(viewer):
        return False
    if campaign.user_id == viewer.id:
        return False
    return bool(getattr(viewer, "nsfw_filter_enabled", True))


def apply_nsfw_list_filter(
    query: Select,
    count_query: Select,
    viewer: Optional[UserResponse],
) -> Tuple[Select, Select]:
    """Narrow list queries so NSFW rows are hidden when the viewer uses the safe filter."""
    if viewer and is_admin_user(viewer):
        return query, count_query
    if viewer is None:
        cond = or_(Campaigns.is_nsfw.is_(False), Campaigns.is_nsfw.is_(None))
        return query.where(cond), count_query.where(cond)
    if not bool(getattr(viewer, "nsfw_filter_enabled", True)):
        return query, count_query
    cond = or_(
        Campaigns.is_nsfw.is_(False),
        Campaigns.is_nsfw.is_(None),
        Campaigns.user_id == viewer.id,
    )
    return query.where(cond), count_query.where(cond)
