import logging
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.badges import Badges

logger = logging.getLogger(__name__)


# ------------------ Service Layer ------------------
class BadgesService:
    """Service layer for Badges operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: Dict[str, Any]) -> Optional[Badges]:
        """Create a new badges"""
        try:
            obj = Badges(**data)
            self.db.add(obj)
            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Created badges with id: {obj.id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating badges: {str(e)}")
            raise

    async def get_by_id(self, obj_id: int) -> Optional[Badges]:
        """Get badges by ID"""
        try:
            query = select(Badges).where(Badges.id == obj_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching badges {obj_id}: {str(e)}")
            raise

    async def get_list(
        self, 
        skip: int = 0, 
        limit: int = 20, 
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated list of badgess"""
        try:
            query = select(Badges)
            count_query = select(func.count(Badges.id))
            
            if query_dict:
                for field, value in query_dict.items():
                    if hasattr(Badges, field):
                        query = query.where(getattr(Badges, field) == value)
                        count_query = count_query.where(getattr(Badges, field) == value)
            
            count_result = await self.db.execute(count_query)
            total = count_result.scalar()

            if sort:
                if sort.startswith('-'):
                    field_name = sort[1:]
                    if hasattr(Badges, field_name):
                        query = query.order_by(getattr(Badges, field_name).desc())
                else:
                    if hasattr(Badges, sort):
                        query = query.order_by(getattr(Badges, sort))
            else:
                query = query.order_by(Badges.id.desc())

            result = await self.db.execute(query.offset(skip).limit(limit))
            items = result.scalars().all()

            return {
                "items": items,
                "total": total,
                "skip": skip,
                "limit": limit,
            }
        except Exception as e:
            logger.error(f"Error fetching badges list: {str(e)}")
            raise

    async def update(self, obj_id: int, update_data: Dict[str, Any]) -> Optional[Badges]:
        """Update badges"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Badges {obj_id} not found for update")
                return None
            for key, value in update_data.items():
                if hasattr(obj, key):
                    setattr(obj, key, value)

            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Updated badges {obj_id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating badges {obj_id}: {str(e)}")
            raise

    async def delete(self, obj_id: int) -> bool:
        """Delete badges"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Badges {obj_id} not found for deletion")
                return False
            await self.db.delete(obj)
            await self.db.commit()
            logger.info(f"Deleted badges {obj_id}")
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting badges {obj_id}: {str(e)}")
            raise

    async def get_by_field(self, field_name: str, field_value: Any) -> Optional[Badges]:
        """Get badges by any field"""
        try:
            if not hasattr(Badges, field_name):
                raise ValueError(f"Field {field_name} does not exist on Badges")
            result = await self.db.execute(
                select(Badges).where(getattr(Badges, field_name) == field_value)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching badges by {field_name}: {str(e)}")
            raise

    async def list_by_field(
        self, field_name: str, field_value: Any, skip: int = 0, limit: int = 20
    ) -> List[Badges]:
        """Get list of badgess filtered by field"""
        try:
            if not hasattr(Badges, field_name):
                raise ValueError(f"Field {field_name} does not exist on Badges")
            result = await self.db.execute(
                select(Badges)
                .where(getattr(Badges, field_name) == field_value)
                .offset(skip)
                .limit(limit)
                .order_by(Badges.id.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching badgess by {field_name}: {str(e)}")
            raise