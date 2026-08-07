from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, get_fully_verified_user
from app.database import get_db
from app.model.sunday_work_request import SundayWorkRequest
from app.model.user import User
from app.schemas.sunday_work_request import (
    SundayWorkRequestCreate,
    SundayWorkRequestResponse,
    SundayWorkRequestReview,
)

admin_router = APIRouter(prefix="/admin/sunday-requests", tags=["Sunday Work Requests - Admin"])
ip_router = APIRouter(prefix="/api/v1/dashboard/sunday-requests", tags=["Sunday Work Requests - IP"])


def _require_admin(current_user=Depends(get_current_user)) -> User:
    if not isinstance(current_user, User):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def _require_superadmin(current_user: User = Depends(_require_admin)) -> User:
    if not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Only superadmins can review Sunday work requests")
    return current_user


def _load(db: Session, request_id: int) -> SundayWorkRequest:
    request = (
        db.query(SundayWorkRequest)
        .options(selectinload(SundayWorkRequest.ip_user), selectinload(SundayWorkRequest.admin))
        .filter(SundayWorkRequest.id == request_id)
        .first()
    )
    if not request:
        raise HTTPException(status_code=404, detail="Sunday work request not found")
    return request


# ─── IP: request approval to work (check in) on a Sunday ──────────────────────

@ip_router.post("", response_model=SundayWorkRequestResponse)
def create_sunday_work_request(
    data: SundayWorkRequestCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_fully_verified_user),
):
    if data.request_date.weekday() != 6:
        raise HTTPException(status_code=400, detail="request_date must be a Sunday")

    existing = db.query(SundayWorkRequest).filter(
        SundayWorkRequest.ip_user_id == current_user.id,
        SundayWorkRequest.request_date == data.request_date,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="A request for this Sunday already exists")

    request = SundayWorkRequest(
        ip_user_id=current_user.id,
        request_date=data.request_date,
        reason=data.reason,
        status="pending",
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return _load(db, request.id)


@ip_router.get("", response_model=List[SundayWorkRequestResponse])
def list_my_sunday_work_requests(
    db: Session = Depends(get_db),
    current_user=Depends(get_fully_verified_user),
):
    return (
        db.query(SundayWorkRequest)
        .options(selectinload(SundayWorkRequest.ip_user))
        .filter(SundayWorkRequest.ip_user_id == current_user.id)
        .order_by(SundayWorkRequest.request_date.desc())
        .all()
    )


# ─── Admin: visibility + superadmin approval ───────────────────────────────────

@admin_router.post("", response_model=SundayWorkRequestResponse)
def create_supervisor_sunday_work_request(
    data: SundayWorkRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_admin),
):
    """A supervisor files their own Sunday request; superadmins don't mark attendance."""
    if current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Superadmins do not file Sunday work requests")
    if data.request_date.weekday() != 6:
        raise HTTPException(status_code=400, detail="request_date must be a Sunday")

    existing = db.query(SundayWorkRequest).filter(
        SundayWorkRequest.admin_id == current_user.id,
        SundayWorkRequest.request_date == data.request_date,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="A request for this Sunday already exists")

    request = SundayWorkRequest(
        admin_id=current_user.id,
        request_date=data.request_date,
        reason=data.reason,
        status="pending",
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return _load(db, request.id)


@admin_router.get("", response_model=List[SundayWorkRequestResponse])
def list_sunday_work_requests(
    status_filter: Optional[str] = Query(None, alias="status"),
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_admin),
):
    """Visible to any admin, for record-keeping; approval is superadmin-only."""
    query = db.query(SundayWorkRequest).options(
        selectinload(SundayWorkRequest.ip_user), selectinload(SundayWorkRequest.admin)
    )
    if status_filter:
        query = query.filter(SundayWorkRequest.status == status_filter)
    return (
        query.order_by(SundayWorkRequest.request_date.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@admin_router.put("/{request_id}/approve", response_model=SundayWorkRequestResponse)
def approve_sunday_work_request(
    request_id: int,
    data: SundayWorkRequestReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_superadmin),
):
    request = _load(db, request_id)
    if request.status != "pending":
        raise HTTPException(status_code=400, detail=f"Request is already {request.status}")
    request.status = "approved"
    request.reviewed_by_admin_id = current_user.id
    request.reviewed_at = datetime.utcnow()
    request.review_notes = data.review_notes
    db.commit()
    return _load(db, request_id)


@admin_router.put("/{request_id}/reject", response_model=SundayWorkRequestResponse)
def reject_sunday_work_request(
    request_id: int,
    data: SundayWorkRequestReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_superadmin),
):
    request = _load(db, request_id)
    if request.status != "pending":
        raise HTTPException(status_code=400, detail=f"Request is already {request.status}")
    request.status = "rejected"
    request.reviewed_by_admin_id = current_user.id
    request.reviewed_at = datetime.utcnow()
    request.review_notes = data.review_notes
    db.commit()
    return _load(db, request_id)
