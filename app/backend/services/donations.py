import logging
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from models.donations import Donations

logger = logging.getLogger(__name__)


# ------------------ Service Layer ------------------
class DonationsService:
    """Service layer for Donations operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: Dict[str, Any], user_id: Optional[str] = None) -> Optional[Donations]:
        """Create a new donations"""
        try:
            if user_id:
                data['user_id'] = user_id
            obj = Donations(**data)
            self.db.add(obj)
            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Created donations with id: {obj.id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating donations: {str(e)}")
            raise

    async def count_completed_donations_for_user(self, user_id: str) -> int:
        """Donations with payment_status=paid and positive amount (any campaign)."""
        try:
            q = select(func.count(Donations.id)).where(
                and_(
                    Donations.user_id == user_id,
                    Donations.payment_status == "paid",
                    Donations.amount > 0,
                )
            )
            result = await self.db.execute(q)
            return int(result.scalar() or 0)
        except Exception as e:
            logger.error(f"Error counting paid donations for user {user_id}: {str(e)}")
            raise

    async def count_completed_donations_for_campaign(self, campaign_id: int) -> int:
        """Paid donations with positive amount for this campaign (immutable once > 0)."""
        try:
            q = select(func.count(Donations.id)).where(
                and_(
                    Donations.campaign_id == campaign_id,
                    Donations.payment_status == "paid",
                    Donations.amount > 0,
                )
            )
            result = await self.db.execute(q)
            return int(result.scalar() or 0)
        except Exception as e:
            logger.error(f"Error counting paid donations for campaign {campaign_id}: {str(e)}")
            raise

    async def check_ownership(self, obj_id: int, user_id: str) -> bool:
        """Check if user owns this record"""
        try:
            obj = await self.get_by_id(obj_id, user_id=user_id)
            return obj is not None
        except Exception as e:
            logger.error(f"Error checking ownership for donations {obj_id}: {str(e)}")
            return False

    async def get_by_id(self, obj_id: int, user_id: Optional[str] = None) -> Optional[Donations]:
        """Get donations by ID (user can only see their own records)"""
        try:
            query = select(Donations).where(Donations.id == obj_id)
            if user_id:
                query = query.where(Donations.user_id == user_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching donations {obj_id}: {str(e)}")
            raise

    async def get_list(
        self, 
        skip: int = 0, 
        limit: int = 20, 
        user_id: Optional[str] = None,
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated list of donationss (user can only see their own records)"""
        try:
            query = select(Donations)
            count_query = select(func.count(Donations.id))
            
            if user_id:
                query = query.where(Donations.user_id == user_id)
                count_query = count_query.where(Donations.user_id == user_id)
            
            if query_dict:
                for field, value in query_dict.items():
                    if hasattr(Donations, field):
                        query = query.where(getattr(Donations, field) == value)
                        count_query = count_query.where(getattr(Donations, field) == value)
            
            count_result = await self.db.execute(count_query)
            total = count_result.scalar()

            if sort:
                if sort.startswith('-'):
                    field_name = sort[1:]
                    if hasattr(Donations, field_name):
                        query = query.order_by(getattr(Donations, field_name).desc())
                else:
                    if hasattr(Donations, sort):
                        query = query.order_by(getattr(Donations, sort))
            else:
                query = query.order_by(Donations.id.desc())

            result = await self.db.execute(query.offset(skip).limit(limit))
            items = result.scalars().all()

            return {
                "items": items,
                "total": total,
                "skip": skip,
                "limit": limit,
            }
        except Exception as e:
            logger.error(f"Error fetching donations list: {str(e)}")
            raise

    async def update(self, obj_id: int, update_data: Dict[str, Any], user_id: Optional[str] = None) -> Optional[Donations]:
        """Update donations (requires ownership)"""
        try:
            obj = await self.get_by_id(obj_id, user_id=user_id)
            if not obj:
                logger.warning(f"Donations {obj_id} not found for update")
                return None
            for key, value in update_data.items():
                if hasattr(obj, key) and key != 'user_id':
                    setattr(obj, key, value)

            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Updated donations {obj_id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating donations {obj_id}: {str(e)}")
            raise

    async def delete(self, obj_id: int, user_id: Optional[str] = None) -> bool:
        """Delete donations (requires ownership)"""
        try:
            obj = await self.get_by_id(obj_id, user_id=user_id)
            if not obj:
                logger.warning(f"Donations {obj_id} not found for deletion")
                return False
            await self.db.delete(obj)
            await self.db.commit()
            logger.info(f"Deleted donations {obj_id}")
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting donations {obj_id}: {str(e)}")
            raise

    async def get_by_field(self, field_name: str, field_value: Any) -> Optional[Donations]:
        """Get donations by any field"""
        try:
            if not hasattr(Donations, field_name):
                raise ValueError(f"Field {field_name} does not exist on Donations")
            result = await self.db.execute(
                select(Donations).where(getattr(Donations, field_name) == field_value)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching donations by {field_name}: {str(e)}")
            raise

    async def list_by_field(
        self, field_name: str, field_value: Any, skip: int = 0, limit: int = 20
    ) -> List[Donations]:
        """Get list of donationss filtered by field"""
        try:
            if not hasattr(Donations, field_name):
                raise ValueError(f"Field {field_name} does not exist on Donations")
            result = await self.db.execute(
                select(Donations)
                .where(getattr(Donations, field_name) == field_value)
                .offset(skip)
                .limit(limit)
                .order_by(Donations.id.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching donationss by {field_name}: {str(e)}")
            raise