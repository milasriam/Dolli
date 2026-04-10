from core.database import Base
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String


class Campaigns(Base):
    __tablename__ = "campaigns"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    title = Column(String, nullable=False)
    description = Column(String, nullable=False)
    category = Column(String, nullable=False)
    goal_amount = Column(Float, nullable=False)
    raised_amount = Column(Float, nullable=True, default=0, server_default='0')
    donor_count = Column(Integer, nullable=True, default=0, server_default='0')
    share_count = Column(Integer, nullable=True, default=0, server_default='0')
    click_count = Column(Integer, nullable=True, default=0, server_default='0')
    image_url = Column(String, nullable=True)
    gif_url = Column(String, nullable=True)
    video_url = Column(String, nullable=True)
    status = Column(String, nullable=True, default='active', server_default='active')
    urgency_level = Column(String, nullable=True, default='medium', server_default='medium')
    featured = Column(Boolean, nullable=True, default=False, server_default='false')
    impact_statement = Column(String, nullable=True)
    # Mature/sensitive fundraisers — hidden in lists and redacted in detail when viewer has NSFW filter on.
    is_nsfw = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(DateTime(timezone=True), nullable=True)