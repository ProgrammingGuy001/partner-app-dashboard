from datetime import datetime
import logging
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload

from app.core.security import get_current_user
from app.database import get_db
from app.model.purchase_order_request import PurchaseOrderRequest
from app.model.user import User
from app.schemas.purchase_order import (
    PurchaseOrderRequestCreate,
    PurchaseOrderRequestResponse,
    PurchaseVendorResponse,
)
from app.services.odoo_service import OdooService

router = APIRouter(prefix="/admin/purchase-orders", tags=["Admin Purchase Orders"])
from app.utils.error_text import sync_error_summary

logger = logging.getLogger(__name__)


def _require_superadmin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Superadmin approval required")
    return current_user


def _serialize(
    request: PurchaseOrderRequest,
    odoo_status: dict | None = None,
    odoo_status_error: str | None = None,
) -> dict:
    odoo_status = odoo_status or {}
    return {
        "id": request.id,
        "po_number": request.po_number,
        "vendor_id": request.vendor_id,
        "vendor_name": request.vendor_name,
        "sales_order": request.sales_order,
        "poc_name": request.poc_name,
        "service_type": request.service_type,
        "product_name": request.product_name,
        "quantity": request.quantity,
        "unit_price": request.unit_price,
        "status": request.status,
        "requested_at": request.requested_at,
        "requested_by_email": request.requested_by.email if request.requested_by else None,
        "approved_at": request.approved_at,
        "approved_by_email": request.approved_by.email if request.approved_by else None,
        "odoo_purchase_order_id": request.odoo_purchase_order_id,
        "odoo_purchase_order_name": request.odoo_purchase_order_name,
        "odoo_sync_error": request.odoo_sync_error,
        "odoo_purchase_order_state": odoo_status.get("state"),
        "odoo_invoice_status": odoo_status.get("invoice_status"),
        "odoo_status_error": odoo_status_error,
        "bill_status": request.bill_status,
        "bill_requested_at": request.bill_requested_at,
        "bill_requested_by_email": request.bill_requested_by.email if request.bill_requested_by else None,
        "bill_approved_at": request.bill_approved_at,
        "bill_approved_by_email": request.bill_approved_by.email if request.bill_approved_by else None,
        "odoo_vendor_bill_id": odoo_status.get("vendor_bill_id") or request.odoo_vendor_bill_id,
        "odoo_vendor_bill_name": odoo_status.get("vendor_bill_name") or request.odoo_vendor_bill_name,
        "odoo_vendor_bill_state": odoo_status.get("vendor_bill_state"),
        "bill_sync_error": request.bill_sync_error,
    }


def _billing_statuses(requests: list[PurchaseOrderRequest]) -> tuple[dict, str | None]:
    order_ids = [request.odoo_purchase_order_id for request in requests if request.odoo_purchase_order_id]
    if not order_ids:
        return {}, None
    try:
        return OdooService.get_purchase_order_billing_statuses(order_ids), None
    except Exception as exc:
        logger.warning("Unable to load Odoo purchase-order billing statuses: %s", exc)
        logger.exception("Could not load Odoo billing status")
        return {}, sync_error_summary(exc, "Unable to load Odoo billing status")


@router.get("/vendors", response_model=list[PurchaseVendorResponse])
def search_vendors(
    search: str = Query(min_length=2, max_length=100),
    current_user: User = Depends(get_current_user),
):
    return OdooService.search_purchase_vendors(search)


@router.post("", response_model=PurchaseOrderRequestResponse, status_code=201)
def create_purchase_order_request(
    body: PurchaseOrderRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vendor = OdooService.get_purchase_vendor(body.vendor_id)
    request = PurchaseOrderRequest(
        requested_by_id=current_user.id,
        vendor_id=vendor["id"],
        vendor_name=vendor["name"],
        sales_order=body.sales_order.strip(),
        poc_name=body.poc_name.strip(),
        service_type=body.service_type,
        product_name=OdooService.PURCHASE_SERVICE_PRODUCTS[body.service_type],
        quantity=body.quantity,
        unit_price=body.unit_price,
        odoo_sync_key=f"partner-dashboard-po-{uuid4().hex}",
    )
    db.add(request)
    db.flush()
    request.po_number = f"PO-{datetime.utcnow().year}-{request.id:04d}"
    db.commit()
    db.refresh(request)
    return _serialize(request)


@router.get("", response_model=list[PurchaseOrderRequestResponse])
def list_purchase_order_requests(
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(PurchaseOrderRequest).options(
        selectinload(PurchaseOrderRequest.requested_by),
        selectinload(PurchaseOrderRequest.approved_by),
        selectinload(PurchaseOrderRequest.bill_requested_by),
        selectinload(PurchaseOrderRequest.bill_approved_by),
    )
    if not current_user.is_superadmin:
        query = query.filter(PurchaseOrderRequest.requested_by_id == current_user.id)
    requests = (
        query.order_by(PurchaseOrderRequest.requested_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    statuses, status_error = _billing_statuses(requests)
    return [
        _serialize(item, statuses.get(item.odoo_purchase_order_id), status_error)
        for item in requests
    ]


@router.post("/{request_id}/approve", response_model=PurchaseOrderRequestResponse)
def approve_purchase_order_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_superadmin),
):
    request = (
        db.query(PurchaseOrderRequest)
        .filter(PurchaseOrderRequest.id == request_id)
        .with_for_update()
        .first()
    )
    if not request:
        raise HTTPException(status_code=404, detail="Purchase order request not found")
    if request.status == "approved":
        return _serialize(request)

    try:
        rfq = OdooService.create_installation_service_rfq(
            vendor_id=request.vendor_id,
            sales_order=request.sales_order,
            poc_name=request.poc_name,
            service_type=request.service_type,
            quantity=float(request.quantity),
            unit_price=float(request.unit_price),
            sync_key=request.odoo_sync_key,
        )
    except Exception as exc:
        db.rollback()
        failed = db.get(PurchaseOrderRequest, request_id)
        if failed:
            logger.exception("Purchase order Odoo sync failed (request=%s)", failed.id)
            failed.odoo_sync_error = sync_error_summary(exc)
            db.commit()
        raise

    request.status = "approved"
    request.approved_by_id = current_user.id
    request.approved_at = datetime.utcnow()
    request.odoo_purchase_order_id = rfq["id"]
    request.odoo_purchase_order_name = rfq["name"]
    request.odoo_sync_error = None
    db.commit()
    db.refresh(request)
    return _serialize(request)


@router.post("/{request_id}/bill-request", response_model=PurchaseOrderRequestResponse)
def request_vendor_bill(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    request = (
        db.query(PurchaseOrderRequest)
        .filter(PurchaseOrderRequest.id == request_id)
        .with_for_update()
        .first()
    )
    if not request or (not current_user.is_superadmin and request.requested_by_id != current_user.id):
        raise HTTPException(status_code=404, detail="Purchase order request not found")
    if request.status != "approved" or not request.odoo_purchase_order_id:
        raise HTTPException(status_code=409, detail="Create the Odoo RFQ before requesting a bill")

    status = OdooService.get_purchase_order_billing_status(request.odoo_purchase_order_id)
    if status["vendor_bill_id"]:
        raise HTTPException(status_code=409, detail="A vendor bill already exists for this Odoo purchase order")
    if status["state"] not in {"purchase", "done"}:
        raise HTTPException(status_code=409, detail="Confirm the RFQ as a purchase order in Odoo first")
    if status["invoice_status"] != "to invoice":
        raise HTTPException(status_code=409, detail="This Odoo purchase order has nothing available to bill")
    if request.bill_status in {"pending", "approved"}:
        return _serialize(request, status)

    request.bill_status = "pending"
    request.bill_requested_by_id = current_user.id
    request.bill_requested_at = datetime.utcnow()
    request.bill_sync_error = None
    db.commit()
    db.refresh(request)
    return _serialize(request, status)


@router.post("/{request_id}/bill-request/approve", response_model=PurchaseOrderRequestResponse)
def approve_vendor_bill_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_superadmin),
):
    request = (
        db.query(PurchaseOrderRequest)
        .filter(PurchaseOrderRequest.id == request_id)
        .with_for_update()
        .first()
    )
    if not request:
        raise HTTPException(status_code=404, detail="Purchase order request not found")
    if request.bill_status == "approved":
        status = OdooService.get_purchase_order_billing_status(request.odoo_purchase_order_id)
        return _serialize(request, status)
    if request.bill_status != "pending" or not request.odoo_purchase_order_id:
        raise HTTPException(status_code=409, detail="A pending bill request is required")

    try:
        bill = OdooService.create_vendor_bill_from_purchase_order(request.odoo_purchase_order_id)
    except Exception as exc:
        db.rollback()
        failed = db.get(PurchaseOrderRequest, request_id)
        if failed:
            logger.exception("Vendor bill sync failed (request=%s)", failed.id)
            failed.bill_sync_error = sync_error_summary(exc)
            db.commit()
        raise

    request.bill_status = "approved"
    request.bill_approved_by_id = current_user.id
    request.bill_approved_at = datetime.utcnow()
    request.odoo_vendor_bill_id = bill["vendor_bill_id"]
    request.odoo_vendor_bill_name = bill["vendor_bill_name"]
    request.bill_sync_error = None
    db.commit()
    db.refresh(request)
    return _serialize(request, bill)
