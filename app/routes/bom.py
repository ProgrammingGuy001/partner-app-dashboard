import logging
from typing import Annotated, List, Literal

from fastapi import APIRouter, HTTPException, Depends, Path, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.requisite_schema import SiteRequisiteSubmit, SODetailResponse, BOMItemResponse
from app.services.odoo_service import OdooService
from app.services.requisite_service import RequisiteService
from app.core.security import get_current_user
from app.model.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bom", tags=["BOM"])

# ============================================
# Static routes MUST come before dynamic ones
# ============================================

@router.post("/submit", response_model=SODetailResponse)
def submit_site_requisite(
    data: SiteRequisiteSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submit site requisite (Admin)
    """
    try:
        logger.info(f"[BOM Submit] Admin User: {current_user.email}, SO: {data.sales_order}, Items: {len(data.items)}")
        result = RequisiteService.submit_site_requisite(db, data)
        logger.info(f"[BOM Submit] Admin Success - SO ID: {result.id}")
        return result
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.exception("Error submitting requisite")
        raise HTTPException(status_code=500, detail="Could not submit the requisite.") from e

@router.get("/history", response_model=List[SODetailResponse])
def get_requisite_history(
    limit: int = Query(50, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all site requisite history (Admin)
    """
    try:
        logger.info(f"[BOM History] Fetching history for Admin user: {current_user.email}")
        history = RequisiteService.get_history(db, limit, offset)
        logger.info(f"[BOM History] Admin Returned {len(history)} records")
        return history
    except Exception as e:
        logger.exception("Error fetching history")
        raise HTTPException(status_code=500, detail="Could not load the history.") from e


@router.get("/history/refresh", response_model=List[SODetailResponse])
def refresh_requisite_history(
    limit: int = Query(50, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Refresh and return the raw repair.order state from Odoo."""
    try:
        return RequisiteService.get_history_with_odoo_states(db, limit, offset)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Failed to refresh states from Odoo") from exc


@router.post("/history/{so_id}/retry-sync", response_model=SODetailResponse)
def retry_requisite_sync(
    so_id: Annotated[int, Path(gt=0)],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return RequisiteService.retry_odoo_sync(db, so_id)

@router.get("/history/by-sales-order/{sales_order}", response_model=List[SODetailResponse])
def get_requisites_by_sales_order(
    sales_order: Annotated[str, Path(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all requisites for a specific sales order (Admin) — may return multiple records
    """
    try:
        results = RequisiteService.get_history_by_sales_order(db, sales_order)
        return results
    except Exception as e:
        logger.exception("Error")
        raise HTTPException(status_code=500, detail="Something went wrong. Try again.") from e

@router.patch("/history/{so_id}/status")
def update_requisite_status(
    so_id: Annotated[int, Path(gt=0)],
    status: Literal["pending", "completed"],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update site requisite status (Admin)
    """
    try:
        result = RequisiteService.update_status(db, so_id, status)
        if not result:
            raise HTTPException(status_code=404, detail="SO not found")
        return {"message": "Status updated successfully", "data": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error")
        raise HTTPException(status_code=500, detail="Something went wrong. Try again.") from e

@router.get("/history/{so_id}/download")
def download_repair_order(
    so_id: Annotated[int, Path(gt=0)],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Download Repair Order xlsx for a specific requisite by ID (Admin)
    """
    try:
        logger.info(f"[BOM Download Admin] Admin: {current_user.email}, SO ID: {so_id}")

        xlsx_bytes = RequisiteService.generate_repair_order_xlsx(db, so_id)

        filename = f"repair_order_{so_id}.xlsx"
        return Response(
            content=xlsx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Encoding": "identity",
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[BOM Download Admin] Error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate repair order") from e


@router.get("/so-lookup/{sales_order}")
def lookup_sales_order(
    sales_order: Annotated[str, Path(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")],
    current_user: User = Depends(get_current_user)
):
    """
    Fetch SO details from Odoo (customer, project, address) — Admin
    """
    try:
        from app.services.odoo_service import OdooService
        details = OdooService.get_sales_order_details(sales_order)
        return details
    except Exception as e:
        logger.warning(f"[BOM SO Lookup Admin] Failed for {sales_order}: {str(e)}")
        raise HTTPException(status_code=404, detail="Sales order not found or Odoo unavailable") from e


@router.get("/{sales_order}/{cabinet_position}", response_model=List[BOMItemResponse])
def get_bom_items(
    sales_order: Annotated[str, Path(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")],
    cabinet_position: Annotated[str, Path(min_length=1, max_length=128)],
    search: str | None = Query(None, description="Search items by product name"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fetch complete BOM hierarchy from Odoo (Admin)
    """
    try:
        logger.info(f"[BOM API - Admin] Fetching BOM for SO: {sales_order}, Cabinet: {cabinet_position}, Admin User: {current_user.email}")
        bom_data = OdooService.fetch_full_bom_data(sales_order, cabinet_position)

        if search:
            search_lower = search.lower()
            def filter_bom_items(items, search_term):
                result = []
                for item in items:
                    if search_term in item.get('product_name', '').lower():
                        result.append(item)
                    else:
                        filtered_children = filter_bom_items(item.get('children', []), search_term)
                        if filtered_children:
                            item['children'] = filtered_children
                            result.append(item)
                return result
            bom_data = filter_bom_items(bom_data, search_lower)

        logger.info(f"[BOM API] Admin Successfully fetched {len(bom_data)} BOM items")
        return bom_data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Admin] Error fetching BOM: {str(e)}", exc_info=True)
        logger.exception("Error fetching BOM")
        raise HTTPException(status_code=500, detail="Could not load the BOM.") from e
