from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.model.invoice_request import InvoiceRequest


def serialize_invoice_request(req: InvoiceRequest | None) -> dict | None:
    if req is None:
        return None
    return {
        "id": req.id,
        "job_id": req.job_id,
        "status": req.status,
        "invoice_number": req.invoice_number,
        "completion_percentage": req.completion_percentage,
        "notes": req.notes,
        "requested_at": req.requested_at.isoformat() if req.requested_at else None,
        "requested_by": f"{req.requested_by.email}" if req.requested_by else None,
        "approved_at": req.approved_at.isoformat() if req.approved_at else None,
        "approved_by": f"{req.approved_by.email}" if req.approved_by else None,
        "rejection_reason": req.rejection_reason,
    }


def get_latest_invoice_request(db: Session, job_id: int) -> InvoiceRequest | None:
    return (
        db.query(InvoiceRequest)
        .filter(InvoiceRequest.job_id == job_id)
        .order_by(InvoiceRequest.requested_at.desc())
        .first()
    )


def get_invoice_requests(db: Session, job_id: int) -> list[InvoiceRequest]:
    return (
        db.query(InvoiceRequest)
        .filter(InvoiceRequest.job_id == job_id)
        .order_by(InvoiceRequest.requested_at.desc())
        .all()
    )


def get_pending_invoice_request(db: Session, job_id: int) -> InvoiceRequest | None:
    return (
        db.query(InvoiceRequest)
        .filter(InvoiceRequest.job_id == job_id, InvoiceRequest.status == "pending")
        .order_by(InvoiceRequest.requested_at.desc())
        .first()
    )


def create_invoice_request(
    db: Session,
    job_id: int,
    *,
    requested_by_id: int | None = None,
    completion_percentage: int | None = None,
    notes: str | None = None,
) -> InvoiceRequest:
    if get_pending_invoice_request(db, job_id):
        raise HTTPException(status_code=400, detail="An invoice request is already pending for this job")

    req = InvoiceRequest(
        job_id=job_id,
        status="pending",
        requested_by_id=requested_by_id,
        completion_percentage=completion_percentage,
        notes=notes.strip() if notes else None,
    )
    db.add(req)
    db.flush()
    req.invoice_number = f"INV-{job_id}-{req.id}-{datetime.utcnow().year}"
    db.commit()
    db.refresh(req)
    return req
