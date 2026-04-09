from core.database import Base
from sqlalchemy import Column, DateTime, Float, Integer, String


class User_profiles(Base):
    __tablename__ = "user_profiles"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    display_name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    total_donated = Column(Float, nullable=True)
    donation_count = Column(Integer, nullable=True)
    current_streak = Column(Integer, nullable=True)
    longest_streak = Column(Integer, nullable=True)
    referral_count = Column(Integer, nullable=True)
    badges = Column(String, nullable=True)
    impact_rank = Column(String, nullable=True)
    last_donation_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=True)