from typing import List, Optional

from core.database import get_db
from dependencies.auth import _with_curated_badge, get_current_user, get_optional_current_user, user_row_to_response
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from models.auth import User
from pydantic import BaseModel
from schemas.auth import UserResponse
from services.user import UserService
from services.user_follows import UserFollowsService
from models.user_profiles import User_profiles
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/users", tags=["users"])


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    nsfw_filter_enabled: Optional[bool] = None
    instagram_handle: Optional[str] = None


@router.get("/profile", response_model=UserResponse)
async def get_profile(db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    """Get current user profile"""
    profile = await UserService.get_user_profile(db, current_user.id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")
    base = user_row_to_response(profile)
    return await _with_curated_badge(base, db)


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    profile_data: UpdateProfileRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Update current user profile"""
    patch = profile_data.model_dump(exclude_unset=True)
    if not patch:
        profile = await UserService.get_user_profile(db, current_user.id)
        if not profile:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")
        base = user_row_to_response(profile)
        return await _with_curated_badge(base, db)

    try:
        profile = await UserService.update_user_profile(db, current_user.id, **patch)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")
    base = user_row_to_response(profile)
    return await _with_curated_badge(base, db)


class PublicUserBriefResponse(BaseModel):
    user_id: str
    name: Optional[str] = None


class FollowingListResponse(BaseModel):
    items: List[PublicUserBriefResponse]
    total: int


class FollowStatsResponse(BaseModel):
    follower_count: int
    following_count: int
    mutual_friend_count: int = 0


class FollowStatusResponse(BaseModel):
    following: bool


class FriendStatusResponse(BaseModel):
    """Mutual follow — both users follow each other."""

    friends: bool


class UserSearchItemResponse(BaseModel):
    user_id: str
    display_name: str
    is_verified_organization: bool = False
    account_type: str = "individual"
    subtitle: Optional[str] = None


class UserSearchListResponse(BaseModel):
    items: List[UserSearchItemResponse]


@router.get("/search", response_model=UserSearchListResponse)
async def search_users(
    q: str = Query(..., min_length=1, max_length=120),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Search people and verified organizations by name, public profile title, or org display name."""
    raw = (q or "").strip()[:120]
    safe = "".join(c for c in raw if c not in "%_\\") or raw
    pattern = f"%{safe}%"

    profile_ids = select(User_profiles.user_id).where(User_profiles.display_name.ilike(pattern))

    stmt = (
        select(User)
        .where(
            or_(
                User.name.ilike(pattern),
                User.email.ilike(pattern),
                User.organization_display_name.ilike(pattern),
                User.id.in_(profile_ids),
            )
        )
        .order_by(User.organization_verified.desc(), User.id.asc())
        .limit(limit)
    )
    rows = list((await db.execute(stmt)).scalars().all())
    uids = [u.id for u in rows]
    prof_map: dict[str, str] = {}
    if uids:
        pr = await db.execute(
            select(User_profiles.user_id, User_profiles.display_name).where(User_profiles.user_id.in_(uids))
        )
        for uid, dn in pr.all():
            if dn and str(dn).strip():
                prof_map[str(uid)] = str(dn).strip()

    def _mask_email(email: str) -> str:
        if "@" not in email:
            return (email[:3] + "…") if len(email) > 3 else "…"
        local, domain = email.split("@", 1)
        if len(local) <= 2:
            return f"***@{domain}"
        return f"{local[:2]}…@{domain}"

    items: List[UserSearchItemResponse] = []
    for u in rows:
        is_org = bool(getattr(u, "organization_verified", False)) or (
            (getattr(u, "account_type", None) or "") == "verified_organization"
        )
        org_name = (getattr(u, "organization_display_name", None) or "").strip()
        nm = (u.name or "").strip()
        prof_s = prof_map.get(str(u.id), "")

        if is_org and org_name:
            display = org_name
            subtitle = "Verified organization"
        elif nm:
            display = nm
            subtitle = _mask_email(u.email) if u.email else None
        elif prof_s:
            display = prof_s
            subtitle = _mask_email(u.email) if u.email else None
        else:
            display = _mask_email(u.email) if u.email else u.id[:8] + "…"
            subtitle = "Dolli member"

        items.append(
            UserSearchItemResponse(
                user_id=str(u.id),
                display_name=display,
                is_verified_organization=is_org,
                account_type=str(getattr(u, "account_type", None) or "individual"),
                subtitle=subtitle,
            )
        )

    return UserSearchListResponse(items=items)


@router.get("/me/following", response_model=FollowingListResponse)
async def list_my_following(
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Accounts the current user follows (for UI + sanity checks)."""
    ufs = UserFollowsService(db)
    ids = await ufs.list_following_user_ids(current_user.id)
    if not ids:
        return FollowingListResponse(items=[], total=0)
    rows = await db.execute(select(User).where(User.id.in_(ids)))
    by_id = {u.id: u for u in rows.scalars().all()}
    items: List[PublicUserBriefResponse] = []
    for uid in ids:
        u = by_id.get(uid)
        nm = (u.name or "").strip() if u and u.name else None
        items.append(PublicUserBriefResponse(user_id=uid, name=nm))
    return FollowingListResponse(items=items, total=len(items))


@router.get("/me/friends", response_model=FollowingListResponse)
async def list_my_friends(
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Mutual follows (you follow them and they follow you)."""
    ufs = UserFollowsService(db)
    ids = await ufs.list_mutual_friend_ids(current_user.id)
    if not ids:
        return FollowingListResponse(items=[], total=0)
    rows = await db.execute(select(User).where(User.id.in_(ids)))
    by_id = {u.id: u for u in rows.scalars().all()}
    items: List[PublicUserBriefResponse] = []
    for uid in ids:
        u = by_id.get(uid)
        nm = (u.name or "").strip() if u and u.name else None
        items.append(PublicUserBriefResponse(user_id=uid, name=nm))
    return FollowingListResponse(items=items, total=len(items))


@router.get("/{user_id}/follow-stats", response_model=FollowStatsResponse)
async def follow_stats(user_id: str, db: AsyncSession = Depends(get_db)):
    """Public: follower / following counts for any user id."""
    ufs = UserFollowsService(db)
    fc = await ufs.follower_count(user_id)
    fw = await ufs.following_count(user_id)
    mf = await ufs.mutual_friend_count(user_id)
    return FollowStatsResponse(follower_count=fc, following_count=fw, mutual_friend_count=mf)


@router.get("/{user_id}/follow-status", response_model=FollowStatusResponse)
async def follow_status(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    viewer: Optional[UserResponse] = Depends(get_optional_current_user),
):
    """Whether the current viewer follows this user (false when logged out)."""
    if not viewer:
        return FollowStatusResponse(following=False)
    ufs = UserFollowsService(db)
    ok = await ufs.is_following(viewer.id, user_id)
    return FollowStatusResponse(following=ok)


@router.get("/{user_id}/friend-status", response_model=FriendStatusResponse)
async def friend_status(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    viewer: Optional[UserResponse] = Depends(get_optional_current_user),
):
    """Whether the viewer and this user are mutual follows (friends)."""
    if not viewer:
        return FriendStatusResponse(friends=False)
    ufs = UserFollowsService(db)
    ok = await ufs.is_friend(viewer.id, user_id)
    return FriendStatusResponse(friends=ok)


@router.post("/{user_id}/follow", status_code=status.HTTP_204_NO_CONTENT)
async def follow_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    ufs = UserFollowsService(db)
    try:
        await ufs.follow(current_user.id, user_id)
    except LookupError:
        raise HTTPException(status_code=404, detail="User not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{user_id}/follow", status_code=status.HTTP_204_NO_CONTENT)
async def unfollow_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    ufs = UserFollowsService(db)
    await ufs.unfollow(current_user.id, user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
