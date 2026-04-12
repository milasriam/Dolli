from models.base import Base
from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.sql import func


class User(Base):
    __tablename__ = "users"

    id = Column(String(255), primary_key=True, index=True)  # Use platform sub as primary key
    email = Column(String(255), nullable=False)
    name = Column(String(255), nullable=True)
    role = Column(String(50), default="user", nullable=False)  # user/admin
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
    # "individual" | "verified_organization" — verified orgs get a badge, different public stats, fee tier.
    account_type = Column(String(32), nullable=False, default="individual", server_default="individual")
    organization_verified = Column(Boolean, nullable=False, default=False, server_default="0")
    organization_display_name = Column(String(255), nullable=True)
    # Optional per-account override (basis points). If null, server uses defaults by account_type.
    platform_fee_bps = Column(Integer, nullable=True)
    # When True (default), NSFW-marked campaigns are filtered out of feeds and redacted in detail (except own/admin).
    nsfw_filter_enabled = Column(Boolean, nullable=False, default=True, server_default="true")
    # Bcrypt hash for email/password sign-up; null for OAuth-only users.
    password_hash = Column(String(255), nullable=True)
    # Optional linked social identities (for users whose primary id is email/local or Google).
    tiktok_linked_open_id = Column(String(64), nullable=True, unique=True, index=True)
    tiktok_linked_display_name = Column(String(255), nullable=True)
    meta_linked_user_id = Column(String(64), nullable=True, unique=True, index=True)
    meta_linked_display_name = Column(String(255), nullable=True)
    # Public @handle for Instagram (manual; Meta Graph scopes not required).
    instagram_handle = Column(String(120), nullable=True)


class OIDCState(Base):
    __tablename__ = "oidc_states"

    id = Column(Integer, primary_key=True, index=True)
    state = Column(String(255), unique=True, index=True, nullable=False)
    nonce = Column(String(255), nullable=False)
    code_verifier = Column(String(255), nullable=False)
    # When set, OAuth callback attaches the provider to this user instead of logging in as platform_sub.
    link_user_id = Column(String(255), nullable=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
