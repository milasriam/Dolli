"""One-time tokens for passwordless email (magic link) sign-in."""

from models.base import Base
from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.sql import func


class MagicLoginToken(Base):
    __tablename__ = "magic_login_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    user_id = Column(String(255), nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
