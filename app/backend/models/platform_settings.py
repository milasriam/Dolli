from core.database import Base
from sqlalchemy import Column, DateTime, String, Text
from sqlalchemy.sql import func


class PlatformSetting(Base):
    """Key/value platform config editable by admins (e.g. pilot allowlists)."""

    __tablename__ = "platform_settings"

    key = Column(String(128), primary_key=True, nullable=False)
    value = Column(Text, nullable=False, server_default="")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
