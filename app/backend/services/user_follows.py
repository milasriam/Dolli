import logging
from typing import List, Optional

from models.auth import User
from models.user_follows import UserFollow
from sqlalchemy import and_, delete, func, select
from sqlalchemy.orm import aliased
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class UserFollowsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def user_exists(self, user_id: str) -> bool:
        r = await self.db.execute(select(User.id).where(User.id == user_id).limit(1))
        return r.scalar_one_or_none() is not None

    async def is_following(self, follower_id: str, following_id: str) -> bool:
        r = await self.db.execute(
            select(UserFollow.id).where(
                UserFollow.follower_id == follower_id,
                UserFollow.following_id == following_id,
            ).limit(1)
        )
        return r.scalar_one_or_none() is not None

    async def is_friend(self, a: str, b: str) -> bool:
        """Mutual follow: A follows B and B follows A."""
        if not a or not b or a == b:
            return False
        return await self.is_following(a, b) and await self.is_following(b, a)

    async def follower_count(self, following_id: str) -> int:
        q = select(func.count(UserFollow.id)).where(UserFollow.following_id == following_id)
        return int((await self.db.execute(q)).scalar() or 0)

    async def following_count(self, follower_id: str) -> int:
        q = select(func.count(UserFollow.id)).where(UserFollow.follower_id == follower_id)
        return int((await self.db.execute(q)).scalar() or 0)

    async def list_following_user_ids(self, follower_id: str, *, limit: int = 5000) -> List[str]:
        q = (
            select(UserFollow.following_id)
            .where(UserFollow.follower_id == follower_id)
            .order_by(UserFollow.created_at.desc())
            .limit(limit)
        )
        rows = (await self.db.execute(q)).scalars().all()
        return list(rows)

    async def list_follower_user_ids(self, following_id: str, *, limit: int = 50_000) -> List[str]:
        q = (
            select(UserFollow.follower_id)
            .where(UserFollow.following_id == following_id)
            .order_by(UserFollow.created_at.desc())
            .limit(limit)
        )
        rows = (await self.db.execute(q)).scalars().all()
        return list(rows)

    async def list_mutual_friend_ids(self, user_id: str, *, limit: int = 5000) -> List[str]:
        """Users with whom ``user_id`` has a mutual follow (friends)."""
        uf1 = aliased(UserFollow)
        uf2 = aliased(UserFollow)
        stmt = (
            select(uf1.following_id)
            .select_from(uf1)
            .join(
                uf2,
                and_(uf2.follower_id == uf1.following_id, uf2.following_id == uf1.follower_id),
            )
            .where(uf1.follower_id == user_id)
            .order_by(uf1.created_at.desc())
            .limit(limit)
        )
        rows = (await self.db.execute(stmt)).scalars().all()
        return list(rows)

    async def mutual_friend_count(self, user_id: str) -> int:
        uf1 = aliased(UserFollow)
        uf2 = aliased(UserFollow)
        q = (
            select(func.count())
            .select_from(uf1)
            .join(
                uf2,
                and_(uf2.follower_id == uf1.following_id, uf2.following_id == uf1.follower_id),
            )
            .where(uf1.follower_id == user_id)
        )
        return int((await self.db.execute(q)).scalar() or 0)

    async def follow(self, follower_id: str, following_id: str) -> bool:
        """Create follow edge. Idempotent: returns True if edge exists after call."""
        if follower_id == following_id:
            raise ValueError("Cannot follow yourself")
        if not await self.user_exists(following_id):
            raise LookupError("User not found")
        if await self.is_following(follower_id, following_id):
            return True
        self.db.add(UserFollow(follower_id=follower_id, following_id=following_id))
        try:
            await self.db.commit()
            return True
        except IntegrityError:
            await self.db.rollback()
            logger.info("follow race: already exists follower=%s following=%s", follower_id, following_id)
            return True

    async def unfollow(self, follower_id: str, following_id: str) -> bool:
        r = await self.db.execute(
            delete(UserFollow).where(
                UserFollow.follower_id == follower_id,
                UserFollow.following_id == following_id,
            )
        )
        await self.db.commit()
        return (r.rowcount or 0) > 0
