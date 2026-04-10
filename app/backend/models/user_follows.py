from core.database import Base
from sqlalchemy import Column, DateTime, Integer, String, UniqueConstraint, func


class UserFollow(Base):
    """follower_id subscribes to following_id (creator updates & new campaigns)."""

    __tablename__ = "user_follows"
    __table_args__ = (UniqueConstraint("follower_id", "following_id", name="uq_user_follows_pair"),)

    id = Column(Integer, primary_key=True, autoincrement=True, nullable=False)
    follower_id = Column(String(255), nullable=False, index=True)
    following_id = Column(String(255), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
