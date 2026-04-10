from core.database import Base
from sqlalchemy import Column, DateTime, Integer, String, Text, func


class UserNotification(Base):
    """In-app inbox row (e.g. creator you follow published a campaign)."""

    __tablename__ = "user_notifications"

    id = Column(Integer, primary_key=True, autoincrement=True, nullable=False)
    user_id = Column(String(255), nullable=False, index=True)
    kind = Column(String(64), nullable=False)
    title = Column(String(512), nullable=False)
    body = Column(Text, nullable=True)
    campaign_id = Column(Integer, nullable=True, index=True)
    actor_user_id = Column(String(255), nullable=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
