from core.database import Base
from sqlalchemy import Column, Integer, String


class Badges(Base):
    __tablename__ = "badges"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    icon = Column(String, nullable=True)
    category = Column(String, nullable=True)
    tier = Column(String, nullable=True)