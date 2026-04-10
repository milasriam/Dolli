from core.database import Base
from sqlalchemy import Column, DateTime, Integer, JSON, String


class ClientProductEvent(Base):
    """Append-only product analytics from the web client (POST /analytics/client-event)."""

    __tablename__ = "client_product_events"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, index=True)
    event = Column(String(64), nullable=False, index=True)
    user_id = Column(String, nullable=True, index=True)
    payload = Column(JSON, nullable=True)
