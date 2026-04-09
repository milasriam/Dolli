from core.database import Base
from sqlalchemy import Column, DateTime, Float, Integer, String


class Donations(Base):
    __tablename__ = "donations"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    campaign_id = Column(Integer, nullable=False)
    amount = Column(Float, nullable=False)
    payment_status = Column(String, nullable=True, default='pending', server_default='pending')
    payment_provider = Column(String, nullable=True)
    provider_invoice_id = Column(String, nullable=True)
    provider_reference = Column(String, nullable=True)
    source_platform = Column(String, nullable=True)
    referral_token = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=True)
