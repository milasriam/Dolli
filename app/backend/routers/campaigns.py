import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from services.campaigns import CampaignsService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/campaigns", tags=["campaigns"])


# ---------- Pydantic Schemas ----------
class CampaignsData(BaseModel):
    """Entity data schema (for create/update)"""
    user_id: Optional[str] = None
    title: str
    description: str
    category: str
    goal_amount: float
    raised_amount: float = None
    donor_count: int = None
    share_count: int = None
    click_count: int = None
    image_url: str = None
    status: str = None
    urgency_level: str = None
    featured: bool = None
    impact_statement: str = None
    created_at: Optional[datetime] = None


class CampaignsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    user_id: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    goal_amount: Optional[float] = None
    raised_amount: Optional[float] = None
    donor_count: Optional[int] = None
    share_count: Optional[int] = None
    click_count: Optional[int] = None
    image_url: Optional[str] = None
    status: Optional[str] = None
    urgency_level: Optional[str] = None
    featured: Optional[bool] = None
    impact_statement: Optional[str] = None
    created_at: Optional[datetime] = None


class CampaignsResponse(BaseModel):
    """Entity response schema"""
    id: int
    user_id: str
    title: str
    description: str
    category: str
    goal_amount: float
    raised_amount: Optional[float] = None
    donor_count: Optional[int] = None
    share_count: Optional[int] = None
    click_count: Optional[int] = None
    image_url: Optional[str] = None
    status: Optional[str] = None
    urgency_level: Optional[str] = None
    featured: Optional[bool] = None
    impact_statement: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CampaignsListResponse(BaseModel):
    """List response schema"""
    items: List[CampaignsResponse]
    total: int
    skip: int
    limit: int


class CampaignsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[CampaignsData]


class CampaignsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: CampaignsUpdateData


class CampaignsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[CampaignsBatchUpdateItem]


class CampaignsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=CampaignsListResponse)
async def query_campaignss(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Query campaignss with filtering, sorting, and pagination"""
    logger.debug(f"Querying campaignss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = CampaignsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")
        
        result = await service.get_list(
            skip=skip, 
            limit=limit,
            query_dict=query_dict,
            sort=sort,
        )
        logger.debug(f"Found {result['total']} campaignss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying campaignss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=CampaignsListResponse)
async def query_campaignss_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query campaignss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying campaignss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = CampaignsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")

        result = await service.get_list(
            skip=skip,
            limit=limit,
            query_dict=query_dict,
            sort=sort
        )
        logger.debug(f"Found {result['total']} campaignss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying campaignss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=CampaignsResponse)
async def get_campaigns(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Get a single campaigns by ID"""
    logger.debug(f"Fetching campaigns with id: {id}, fields={fields}")
    
    service = CampaignsService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.warning(f"Campaigns with id {id} not found")
            raise HTTPException(status_code=404, detail="Campaigns not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching campaigns {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=CampaignsResponse, status_code=201)
async def create_campaigns(
    data: CampaignsData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new campaigns"""
    logger.debug(f"Creating new campaigns with data: {data}")
    
    service = CampaignsService(db)
    try:
        payload = data.model_dump()
        payload["user_id"] = current_user.id
        result = await service.create(payload)
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create campaigns")
        
        logger.info(f"Campaigns created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating campaigns: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating campaigns: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[CampaignsResponse], status_code=201)
async def create_campaignss_batch(
    request: CampaignsBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create multiple campaignss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} campaignss")
    
    service = CampaignsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump())
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} campaignss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[CampaignsResponse])
async def update_campaignss_batch(
    request: CampaignsBatchUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update multiple campaignss in a single request"""
    logger.debug(f"Batch updating {len(request.items)} campaignss")
    
    service = CampaignsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} campaignss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=CampaignsResponse)
async def update_campaigns(
    id: int,
    data: CampaignsUpdateData,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing campaigns"""
    logger.debug(f"Updating campaigns {id} with data: {data}")

    service = CampaignsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"Campaigns with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Campaigns not found")
        
        logger.info(f"Campaigns {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating campaigns {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating campaigns {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_campaignss_batch(
    request: CampaignsBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple campaignss by their IDs"""
    logger.debug(f"Batch deleting {len(request.ids)} campaignss")
    
    service = CampaignsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} campaignss successfully")
        return {"message": f"Successfully deleted {deleted_count} campaignss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_campaigns(
    id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single campaigns by ID"""
    logger.debug(f"Deleting campaigns with id: {id}")
    
    service = CampaignsService(db)
    try:
        success = await service.delete(id)
        if not success:
            logger.warning(f"Campaigns with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Campaigns not found")
        
        logger.info(f"Campaigns {id} deleted successfully")
        return {"message": "Campaigns deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting campaigns {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
