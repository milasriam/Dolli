"""Tracks which fundraising % milestones were already announced (dedupe in-app + email)."""

from core.database import Base
from sqlalchemy import Column, DateTime, Integer, UniqueConstraint, func


class CampaignMilestoneNotified(Base):
    __tablename__ = "campaign_milestone_notified"
    __table_args__ = (UniqueConstraint("campaign_id", "milestone_pct", name="uq_campaign_milestone_pct"),)

    id = Column(Integer, primary_key=True, autoincrement=True, nullable=False)
    campaign_id = Column(Integer, nullable=False, index=True)
    milestone_pct = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
