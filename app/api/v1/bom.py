
import logging
from typing import Annotated, List, Literal

from fastapi import APIRouter, HTTPException, Depends, Path, Query
from fastapi.responses import Response
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
def submit_site_requisite(
    data: SiteRequisiteSubmit,
    db: Session = Depends(get_db),
    current_user: ip = Depends(get_fully_verified_user)
):
    """
    Submit site requisite (Partner Only)
    """
    try:
        logger.info(f"[BOM Submit] User: {current_user.phone_number}, SO: {data.sales_order}, Items: {len(data.items)}")

        # Default POC from the logged in partner only when user did not provide one.
        if not data.sr_poc:
            data.sr_poc = f"{current_user.first_name} {current_user.last_name or ''}".strip()

        result = RequisiteService.submit_site_requisite(db, data, user_id=current_user.id)
        logger.info(f"[BOM Submit] Success - SO ID: {result.id}")
        return result
    except Exception as e:
        logger.error(f"[BOM Submit] Error: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to submit requisite") from e

@router.get("/history", response_model=List[SODetailResponse])
def get_requisite_history(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: ip = Depends(get_fully_verified_user)
):
    """
    Get all site requisite history
    """
    try:
        logger.info(f"[BOM History] Fetching history for user: {current_user.phone_number}")
        history = RequisiteService.get_history(db, limit, offset, user_id=current_user.id)
        logger.info(f"[BOM History] Returned {len(history)} records")
        return history
    except Exception as e:
        logger.error(f"[BOM History] Error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch history") from e

@router.get("/history/by-sales-order/{sales_order}", response_model=List[SODetailResponse])
def get_requisites_by_sales_order(
    sales_order: Annotated[str, Path(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")],
    db: Session = Depends(get_db),
    current_user: ip = Depends(get_fully_verified_user)
):
    """
    Get all requisites for a specific sales order (Partner) — may return multiple records
    """
    try:
        results = RequisiteService.get_history_by_sales_order(db, sales_order, user_id=current_user.id)
        return results
    except Exception as e:
        logger.error(f"[BOM History SO] Error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch sales order") from e

@router.patch("/history/{so_id}/status")
def update_requisite_status(
    so_id: Annotated[int, Path(gt=0)],
    status: Literal["pending", "completed"],
    db: Session = Depends(get_db),
    current_user: ip = Depends(get_fully_verified_user)
):
    """
    Update site requisite status
    """
    try:
        result = RequisiteService.update_status(db, so_id, status)
        if not result:
            raise HTTPException(status_code=404, detail="SO not found")
        return {"message": "Status updated successfully", "data": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}") from e

@router.get("/history/{so_id}/download")
def download_repair_order(
    so_id: Annotated[int, Path(gt=0)],
    db: Session = Depends(get_db),
    current_user: ip = Depends(get_fully_verified_user)
):
    """
    Download Repair Order xlsx for a specific requisite by ID (Partner)
    """
    try:
        logger.info(f"[BOM Download] User: {current_user.phone_number}, SO ID: {so_id}")

        xlsx_bytes = RequisiteService.generate_repair_order_xlsx(
            db, so_id, user_id=current_user.id
        )

        filename = f"repair_order_{so_id}.xlsx"
        return Response(
            content=xlsx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[BOM Download] Error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate repair order") from e


@router.get("/so-lookup/{sales_order}")
def lookup_sales_order(
    sales_order: Annotated[str, Path(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")],
    current_user: ip = Depends(get_fully_verified_user)
):
    """
    Fetch SO details from Odoo (customer, project, address) for the partner UI.
    Returns a best-effort response — fields may be None if Odoo is unavailable.
    """
    try:
        details = OdooService.get_sales_order_details(sales_order)
        return details
    except Exception as e:
        logger.warning(f"[BOM SO Lookup] Failed for {sales_order}: {str(e)}")
        raise HTTPException(status_code=404, detail="Sales order not found or Odoo unavailable")


@router.get("/{sales_order}/{cabinet_position}", response_model=List[BOMItemResponse])
def get_bom_items(
    sales_order: Annotated[str, Path(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")],
    cabinet_position: Annotated[str, Path(min_length=1, max_length=128)],
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
        raise HTTPException(status_code=500, detail="Failed to fetch BOM data") from e
