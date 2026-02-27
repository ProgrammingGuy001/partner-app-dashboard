
import logging
from typing import List
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.requisite_schema import SiteRequisiteSubmit, SODetailResponse, BOMItemResponse
from app.services.odoo_service import OdooService
from app.services.requisite_service import RequisiteService
from app.api.deps import get_fully_verified_user
from app.model.ip import ip

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dashboard/bom", tags=["BOM"])



@router.post("/submit", response_model=SODetailResponse)
async def submit_site_requisite(
    data: SiteRequisiteSubmit,
    db: Session = Depends(get_db),
    current_user: ip = Depends(get_fully_verified_user)
):
    """
    Submit site requisite (Partner Only)
    """
    try:
        logger.info(f"[BOM Submit] User: {current_user.phone_number}, SO: {data.sales_order}, Items: {len(data.items)}")
        
        # Auto-populate POC from logged in partner
        data.sr_poc = f"{current_user.first_name} {current_user.last_name or ''}".strip()
        
        result = RequisiteService.submit_site_requisite(db, data)
        logger.info(f"[BOM Submit] Success - SO ID: {result.id}")
        return result
    except Exception as e:
        logger.error(f"[BOM Submit] Error: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error submitting requisite: {str(e)}")

@router.get("/history", response_model=List[SODetailResponse])
async def get_requisite_history(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: ip = Depends(get_fully_verified_user)
):
    """
    Get all site requisite history
    """
    try:
        logger.info(f"[BOM History] Fetching history for user: {current_user.phone_number}")
        history = RequisiteService.get_history(db, limit, offset)
        logger.info(f"[BOM History] Returned {len(history)} records")
        return history
    except Exception as e:
        logger.error(f"[BOM History] Error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error fetching history: {str(e)}")

@router.get("/history/{sales_order}", response_model=SODetailResponse)
async def get_requisite_by_sales_order(
    sales_order: str,
    db: Session = Depends(get_db),
    current_user: ip = Depends(get_fully_verified_user)
):
    """
    Get requisite history for specific sales order (Partner)
    """
    try:
        result = RequisiteService.get_history_by_sales_order(db, sales_order)
        if not result:
            raise HTTPException(status_code=404, detail="Sales order not found")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@router.patch("/history/{so_id}/status")
async def update_requisite_status(
    so_id: int,
    status: str,
    db: Session = Depends(get_db),
    current_user: ip = Depends(get_fully_verified_user)
):
    """
    Update site requisite status 
    """
    if status not in ["pending", "completed"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    try:
        result = RequisiteService.update_status(db, so_id, status)
        if not result:
            raise HTTPException(status_code=404, detail="SO not found")
        return {"message": "Status updated successfully", "data": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@router.get("/{sales_order}/{cabinet_position}", response_model=List[BOMItemResponse])
async def get_bom_items(
    sales_order: str, 
    cabinet_position: str,
    db: Session = Depends(get_db),
    current_user: ip = Depends(get_fully_verified_user)
):
    """
    Fetch complete BOM hierarchy from Odoo 
    """
    try:
        logger.info(f"[BOM API - IP] Fetching BOM for SO: {sales_order}, Cabinet: {cabinet_position}, User: {current_user.phone_number}")
        bom_data = OdooService.fetch_full_bom_data(sales_order, cabinet_position)
        logger.info(f"[BOM API] Successfully fetched {len(bom_data)} BOM items")
        return bom_data
    except HTTPException as he:
        logger.error(f"[BOM API] HTTPException: {he.status_code} - {he.detail}")
        raise
    except Exception as e:
        logger.error(f"[BOM API] Unexpected error fetching BOM: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error fetching BOM: {str(e)}")
