from core.database import Base
from sqlalchemy import Column, DateTime, Float, Integer, String


class Referrals(Base):
    __tablename__ = "referrals"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    campaign_id = Column(Integer, nullable=False)
    platform = Column(String, nullable=False)
    referral_token = Column(String, nullable=False)
    clicks = Column(Integer, nullable=True, default=0, server_default='0')
    signups = Column(Integer, nullable=True, default=0, server_default='0')
    donations_count = Column(Integer, nullable=True, default=0, server_default='0')
    donations_amount = Column(Float, nullable=True, default=0, server_default='0')
    created_at = Column(DateTime(timezone=True), nullable=True)