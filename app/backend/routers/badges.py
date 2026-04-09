import json
import logging
from typing import List, Optional


from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.badges import BadgesService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/badges", tags=["badges"])


# ---------- Pydantic Schemas ----------
class BadgesData(BaseModel):
    """Entity data schema (for create/update)"""
    name: str
    description: str = None
    icon: str = None
    category: str = None
    tier: str = None


class BadgesUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    category: Optional[str] = None
    tier: Optional[str] = None


class BadgesResponse(BaseModel):
    """Entity response schema"""
    id: int
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    category: Optional[str] = None
    tier: Optional[str] = None

    class Config:
        from_attributes = True


class BadgesListResponse(BaseModel):
    """List response schema"""
    items: List[BadgesResponse]
    total: int
    skip: int
    limit: int


class BadgesBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[BadgesData]


class BadgesBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: BadgesUpdateData


class BadgesBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[BadgesBatchUpdateItem]


class BadgesBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=BadgesListResponse)
async def query_badgess(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Query badgess with filtering, sorting, and pagination"""
    logger.debug(f"Querying badgess: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = BadgesService(db)
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
        logger.debug(f"Found {result['total']} badgess")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying badgess: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=BadgesListResponse)
async def query_badgess_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query badgess with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying badgess: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = BadgesService(db)
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
        logger.debug(f"Found {result['total']} badgess")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying badgess: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=BadgesResponse)
async def get_badges(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Get a single badges by ID"""
    logger.debug(f"Fetching badges with id: {id}, fields={fields}")
    
    service = BadgesService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.warning(f"Badges with id {id} not found")
            raise HTTPException(status_code=404, detail="Badges not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching badges {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=BadgesResponse, status_code=201)
async def create_badges(
    data: BadgesData,
    db: AsyncSession = Depends(get_db),
):
    """Create a new badges"""
    logger.debug(f"Creating new badges with data: {data}")
    
    service = BadgesService(db)
    try:
        result = await service.create(data.model_dump())
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create badges")
        
        logger.info(f"Badges created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating badges: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating badges: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[BadgesResponse], status_code=201)
async def create_badgess_batch(
    request: BadgesBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create multiple badgess in a single request"""
    logger.debug(f"Batch creating {len(request.items)} badgess")
    
    service = BadgesService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump())
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} badgess successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[BadgesResponse])
async def update_badgess_batch(
    request: BadgesBatchUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update multiple badgess in a single request"""
    logger.debug(f"Batch updating {len(request.items)} badgess")
    
    service = BadgesService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} badgess successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=BadgesResponse)
async def update_badges(
    id: int,
    data: BadgesUpdateData,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing badges"""
    logger.debug(f"Updating badges {id} with data: {data}")

    service = BadgesService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"Badges with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Badges not found")
        
        logger.info(f"Badges {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating badges {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating badges {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_badgess_batch(
    request: BadgesBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple badgess by their IDs"""
    logger.debug(f"Batch deleting {len(request.ids)} badgess")
    
    service = BadgesService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} badgess successfully")
        return {"message": f"Successfully deleted {deleted_count} badgess", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_badges(
    id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single badges by ID"""
    logger.debug(f"Deleting badges with id: {id}")
    
    service = BadgesService(db)
    try:
        success = await service.delete(id)
        if not success:
            logger.warning(f"Badges with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Badges not found")
        
        logger.info(f"Badges {id} deleted successfully")
        return {"message": "Badges deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting badges {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")