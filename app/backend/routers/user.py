from typing import Optional

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, status
from models.auth import User
from pydantic import BaseModel
from schemas.auth import UserResponse
from services.user import UserService
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/users", tags=["users"])


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    nsfw_filter_enabled: Optional[bool] = None


@router.get("/profile", response_model=UserResponse)
async def get_profile(db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    """Get current user profile"""
    profile = await UserService.get_user_profile(db, current_user.id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")
    return profile


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    profile_data: UpdateProfileRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Update current user profile"""
    if profile_data.name is None and profile_data.nsfw_filter_enabled is None:
        profile = await UserService.get_user_profile(db, current_user.id)
        if not profile:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")
        return profile

    profile = await UserService.update_user_profile(
        db,
        current_user.id,
        name=profile_data.name,
        nsfw_filter_enabled=profile_data.nsfw_filter_enabled,
    )
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")
    return profile
