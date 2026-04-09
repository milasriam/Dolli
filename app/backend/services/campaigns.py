import logging
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.campaigns import Campaigns

logger = logging.getLogger(__name__)


# ------------------ Service Layer ------------------
class CampaignsService:
    """Service layer for Campaigns operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: Dict[str, Any]) -> Optional[Campaigns]:
        """Create a new campaigns"""
        try:
            obj = Campaigns(**data)
            self.db.add(obj)
            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Created campaigns with id: {obj.id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating campaigns: {str(e)}")
            raise

    async def get_by_id(self, obj_id: int) -> Optional[Campaigns]:
        """Get campaigns by ID"""
        try:
            query = select(Campaigns).where(Campaigns.id == obj_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching campaigns {obj_id}: {str(e)}")
            raise

    async def get_list(
        self, 
        skip: int = 0, 
        limit: int = 20, 
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated list of campaignss"""
        try:
            query = select(Campaigns)
            count_query = select(func.count(Campaigns.id))
            
            if query_dict:
                for field, value in query_dict.items():
                    if hasattr(Campaigns, field):
                        query = query.where(getattr(Campaigns, field) == value)
                        count_query = count_query.where(getattr(Campaigns, field) == value)
            
            count_result = await self.db.execute(count_query)
            total = count_result.scalar()

            if sort:
                if sort.startswith('-'):
                    field_name = sort[1:]
                    if hasattr(Campaigns, field_name):
                        query = query.order_by(getattr(Campaigns, field_name).desc())
                else:
                    if hasattr(Campaigns, sort):
                        query = query.order_by(getattr(Campaigns, sort))
            else:
                query = query.order_by(Campaigns.id.desc())

            result = await self.db.execute(query.offset(skip).limit(limit))
            items = result.scalars().all()

            return {
                "items": items,
                "total": total,
                "skip": skip,
                "limit": limit,
            }
        except Exception as e:
            logger.error(f"Error fetching campaigns list: {str(e)}")
            raise

    async def update(self, obj_id: int, update_data: Dict[str, Any]) -> Optional[Campaigns]:
        """Update campaigns"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Campaigns {obj_id} not found for update")
                return None
            for key, value in update_data.items():
                if hasattr(obj, key):
                    setattr(obj, key, value)

            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Updated campaigns {obj_id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating campaigns {obj_id}: {str(e)}")
            raise

    async def delete(self, obj_id: int) -> bool:
        """Delete campaigns"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Campaigns {obj_id} not found for deletion")
                return False
            await self.db.delete(obj)
            await self.db.commit()
            logger.info(f"Deleted campaigns {obj_id}")
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting campaigns {obj_id}: {str(e)}")
            raise

    async def get_by_field(self, field_name: str, field_value: Any) -> Optional[Campaigns]:
        """Get campaigns by any field"""
        try:
            if not hasattr(Campaigns, field_name):
                raise ValueError(f"Field {field_name} does not exist on Campaigns")
            result = await self.db.execute(
                select(Campaigns).where(getattr(Campaigns, field_name) == field_value)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching campaigns by {field_name}: {str(e)}")
            raise

    async def list_by_field(
        self, field_name: str, field_value: Any, skip: int = 0, limit: int = 20
    ) -> List[Campaigns]:
        """Get list of campaignss filtered by field"""
        try:
            if not hasattr(Campaigns, field_name):
                raise ValueError(f"Field {field_name} does not exist on Campaigns")
            result = await self.db.execute(
                select(Campaigns)
                .where(getattr(Campaigns, field_name) == field_value)
                .offset(skip)
                .limit(limit)
                .order_by(Campaigns.id.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching campaignss by {field_name}: {str(e)}")
            raise