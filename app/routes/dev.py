"""Dev-only account administration.

The dev account owns the admin/superadmin lifecycle: creating accounts,
enabling/disabling them, changing roles and revoking sessions. It replaces the
public signup route, which created accounts nobody could approve.
"""
from datetime import date, datetime, time, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.orm import Session, selectinload

from app.core.security import get_current_user, hash_password, revoke_refresh_tokens
from app.crud.user import get_user_by_email
from app.database import get_db
from app.model.admin_attendance import AdminAttendance
from app.model.attendance import DailyAttendance
from app.model.dev_audit_log import DevAuditLog
from app.model.ip import ip
from app.model.job import Job
from app.model.user import User
from app.utils.attendance_policy import ATTENDANCE_TIMEZONE, attendance_business_date
from app.utils.rate_limiter import limiter

router = APIRouter(prefix="/dev", tags=["Dev"])


def require_dev(current_user: User = Depends(get_current_user)) -> User:
    if not getattr(current_user, "is_dev", False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Dev access required")
    return current_user


def log_dev_action(
    db: Session,
    actor: User,
    action: str,
    target_email: str | None = None,
    detail: str | None = None,
) -> None:
    """Append a privileged action to the audit trail. Caller commits."""
    db.add(DevAuditLog(
        actor_id=actor.id,
        action=action,
        target_email=target_email,
        detail=detail[:2000] if detail else None,
    ))


def _serialize(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "isActive": bool(user.is_active),
        "isApproved": bool(user.is_approved),
        "is_superadmin": bool(user.is_superadmin),
        "is_dev": bool(user.is_dev),
        "created_at": user.created_at,
    }


class DevUserResponse(BaseModel):
    id: int
    email: str | None = None
    name: str | None = None
    isActive: bool
    isApproved: bool
    is_superadmin: bool
    is_dev: bool
    created_at: datetime | None = None


class DevUserCreate(BaseModel):
    email: EmailStr
    name: str | None = Field(default=None, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    is_superadmin: bool = False

    @field_validator("email", mode="before")
    @classmethod
    def normalise_email(cls, v):
        return v.lower().strip() if isinstance(v, str) else v


class DevUserUpdate(BaseModel):
    isActive: bool | None = None
    isApproved: bool | None = None
    is_superadmin: bool | None = None
    name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = None

    @field_validator("email", mode="before")
    @classmethod
    def normalise_email(cls, v):
        return v.lower().strip() if isinstance(v, str) else v


class DevAuditLogResponse(BaseModel):
    id: int
    actor_email: str | None = None
    action: str
    target_email: str | None = None
    detail: str | None = None
    created_at: datetime


def _get_target(db: Session, user_id: int) -> User:
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    return target


def _remaining_dev_count(db: Session, excluding_id: int) -> int:
    return (
        db.query(User)
        .filter(User.is_dev == True, User.is_active == True, User.id != excluding_id)  # noqa: E712
        .count()
    )


@router.get("/users", response_model=list[DevUserResponse])
def list_users(db: Session = Depends(get_db), current_user: User = Depends(require_dev)):
    """Every admin row, including inactive and unapproved ones."""
    users = db.query(User).order_by(User.id.asc()).all()
    return [_serialize(user) for user in users]


@router.post("/users", response_model=DevUserResponse, status_code=201)
@limiter.limit("20/minute")
def create_user(
    request: Request,
    body: DevUserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_dev),
):
    if get_user_by_email(db, body.email):
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=body.email,
        name=body.name.strip() if body.name else None,
        password=hash_password(body.password),
        is_active=True,
        is_approved=True,
        is_superadmin=body.is_superadmin,
        is_dev=False,
    )
    db.add(user)
    log_dev_action(
        db, current_user, "create_user", body.email,
        "superadmin" if body.is_superadmin else "admin",
    )
    db.commit()
    db.refresh(user)
    return _serialize(user)


@router.patch("/users/{user_id}", response_model=DevUserResponse)
def update_user(
    user_id: int,
    body: DevUserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_dev),
):
    target = _get_target(db, user_id)
    changes = body.model_dump(exclude_unset=True)
    if not changes:
        return _serialize(target)

    deactivating = changes.get("isActive") is False
    previous_email = target.email

    # No self-lockout: a dev cannot disable their own account.
    if target.id == current_user.id and deactivating:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")

    # Never leave the system without a reachable dev.
    if target.is_dev and deactivating and _remaining_dev_count(db, target.id) == 0:
        raise HTTPException(status_code=400, detail="Cannot deactivate the last active dev account")

    new_email = changes.get("email")
    renaming_login = new_email is not None and new_email != previous_email
    if renaming_login:
        existing = get_user_by_email(db, new_email)
        if existing and existing.id != target.id:
            raise HTTPException(status_code=400, detail="Email already registered")

    if "isActive" in changes:
        target.is_active = changes["isActive"]
    if "isApproved" in changes:
        target.is_approved = changes["isApproved"]
    if "is_superadmin" in changes:
        target.is_superadmin = changes["is_superadmin"]
    if "name" in changes:
        target.name = changes["name"].strip() if changes["name"] else None
    if renaming_login:
        target.email = new_email

    log_dev_action(
        db, current_user, "update_user", previous_email,
        ", ".join(f"{k}={v}" for k, v in changes.items()),
    )
    db.commit()
    db.refresh(target)

    # Disabling an account must end its live sessions, not just block new logins.
    if deactivating:
        revoke_refresh_tokens(db, target.email)

    # Tokens carry the email as their subject, so the old address must stop
    # resolving — otherwise the previous login stays valid under a dead identity.
    if renaming_login:
        revoke_refresh_tokens(db, previous_email)

    return _serialize(target)


@router.post("/users/{user_id}/revoke-sessions")
def revoke_sessions(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_dev),
):
    """Force logout without disabling the account."""
    target = _get_target(db, user_id)
    log_dev_action(db, current_user, "revoke_sessions", target.email)
    db.commit()
    revoke_refresh_tokens(db, target.email)
    return {"message": "Sessions revoked", "email": target.email}


def _serialize_ip(user: ip) -> dict:
    return {
        "id": user.id,
        "phone_number": user.phone_number,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "city": user.city,
        "pincode": user.pincode,
        "is_internal": bool(user.is_internal),
        "is_id_verified": bool(user.is_id_verified),
    }


class DevIPResponse(BaseModel):
    id: int
    phone_number: str
    first_name: str | None = None
    last_name: str | None = None
    city: str | None = None
    pincode: int | None = None
    is_internal: bool
    is_id_verified: bool


class DevIPUpdate(BaseModel):
    """Identity fields only. PAN, bank and education stay behind the verification
    flow — a dev correcting a name must not be able to silently rewrite KYC."""
    phone_number: str | None = Field(default=None, min_length=10, max_length=15)
    first_name: str | None = Field(default=None, max_length=255)
    last_name: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=255)
    pincode: int | None = Field(default=None, ge=100000, le=999999)
    is_internal: bool | None = None

    @field_validator("phone_number")
    @classmethod
    def normalise_phone(cls, v):
        if v is None:
            return v
        digits = "".join(c for c in v if c.isdigit())
        if len(digits) == 10:
            digits = "91" + digits
        if len(digits) != 12:
            raise ValueError("Phone number must be 10 digits, or 12 with the 91 prefix")
        return digits


@router.get("/ip-users", response_model=list[DevIPResponse])
def list_ip_users(db: Session = Depends(get_db), current_user: User = Depends(require_dev)):
    """Every IP, unfiltered by admin assignment."""
    return [_serialize_ip(u) for u in db.query(ip).order_by(ip.id.asc()).all()]


@router.patch("/ip-users/{ip_id}", response_model=DevIPResponse)
def update_ip_user(
    ip_id: int,
    body: DevIPUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_dev),
):
    target = db.get(ip, ip_id)
    if target is None:
        raise HTTPException(status_code=404, detail="IP user not found")

    changes = body.model_dump(exclude_unset=True)
    if not changes:
        return _serialize_ip(target)

    new_phone = changes.get("phone_number")
    if new_phone and new_phone != target.phone_number:
        clash = db.query(ip.id).filter(ip.phone_number == new_phone, ip.id != target.id).first()
        if clash:
            raise HTTPException(status_code=400, detail="Phone number already registered to another IP")

    for field in ("phone_number", "city", "first_name", "last_name"):
        if field in changes:
            value = changes[field]
            setattr(target, field, value.strip() if isinstance(value, str) else value)
    if "pincode" in changes:
        target.pincode = changes["pincode"]
    if "is_internal" in changes:
        target.is_internal = changes["is_internal"]

    log_dev_action(
        db, current_user, "update_ip_user", target.phone_number,
        ", ".join(f"{k}={v}" for k, v in changes.items()),
    )
    db.commit()
    db.refresh(target)
    return _serialize_ip(target)


class DevAttendanceCreate(BaseModel):
    """Backfill a day somebody genuinely worked but could not record."""
    subject_type: Literal["ip", "admin"]
    subject_id: int
    attendance_date: date
    reason: str = Field(min_length=3, max_length=500)
    # IP records hang off a job; admin records do not.
    job_id: int | None = None
    attendance_type: Literal["check_in", "check_out"] = "check_in"


def _backfill_marker(reason: str) -> str:
    return f"Dev backfill: {reason.strip()}"


@router.post("/attendance", status_code=201)
@limiter.limit("30/minute")
def backfill_attendance(
    request: Request,
    body: DevAttendanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_dev),
):
    """Record attendance on someone else's behalf for a past date.

    This bypasses every gate the normal path enforces — the check-in window, the
    GPS fix, the photo, the Sunday approval — so it is dev-only, needs a written
    reason, and lands in the audit log. Future dates are refused: a backfill
    explains a day that already happened.
    """
    today = attendance_business_date()
    if body.attendance_date > today:
        raise HTTPException(status_code=422, detail="Cannot record attendance for a future date")

    if body.subject_type == "admin":
        target = db.get(User, body.subject_id)
        if target is None:
            raise HTTPException(status_code=404, detail="Admin not found")
        if target.is_superadmin:
            raise HTTPException(status_code=400, detail="Superadmins do not mark attendance")

        # Mid-morning IST, so the stamp reads as a working day in every report that
        # groups by local date rather than by UTC.
        marked_at = datetime.combine(body.attendance_date, time(10, 0), tzinfo=ATTENDANCE_TIMEZONE)
        duplicate = (
            db.query(AdminAttendance.id)
            .filter(
                AdminAttendance.admin_id == target.id,
                AdminAttendance.marked_at >= marked_at.replace(hour=0, minute=0),
                AdminAttendance.marked_at < marked_at.replace(hour=0, minute=0) + timedelta(days=1),
            )
            .first()
        )
        if duplicate:
            raise HTTPException(status_code=409, detail="Attendance already recorded for that date")

        record = AdminAttendance(
            admin_id=target.id,
            marked_at=marked_at,
            notes=_backfill_marker(body.reason),
        )
        db.add(record)
        log_dev_action(
            db, current_user, "backfill_attendance", target.email,
            f"{body.attendance_date} admin — {body.reason.strip()}",
        )
        db.commit()
        db.refresh(record)
        return {
            "message": "Attendance recorded",
            "record": {
                "id": record.id,
                "subject_type": "admin",
                "subject_id": target.id,
                "subject_label": target.email,
                "attendance_date": body.attendance_date.isoformat(),
                "attendance_type": None,
                "notes": record.notes,
            },
        }

    target_ip = db.get(ip, body.subject_id)
    if target_ip is None:
        raise HTTPException(status_code=404, detail="IP user not found")
    if body.job_id is None:
        raise HTTPException(status_code=422, detail="job_id is required for IP attendance")

    job = db.query(Job).filter(Job.id == body.job_id, Job.assigned_ip_id == target_ip.id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found or not assigned to that IP")

    duplicate = (
        db.query(DailyAttendance.id)
        .filter(
            DailyAttendance.ip_user_id == target_ip.id,
            DailyAttendance.job_id == job.id,
            DailyAttendance.attendance_date == body.attendance_date,
            DailyAttendance.attendance_type == body.attendance_type,
        )
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="That check already exists for the date and job")

    # ponytail: latitude/longitude are NOT NULL on daily_attendance, so a backfill
    # borrows the job site's own coordinates instead of inventing a fix. Jobs
    # without coordinates fall back to (0, 0) — the `manual_location` marker is
    # what tells a reader the position was assumed, not measured. Make the columns
    # nullable if a report ever needs to distinguish the two by itself.
    record = DailyAttendance(
        job_id=job.id,
        ip_user_id=target_ip.id,
        phone=target_ip.phone_number,
        attendance_date=body.attendance_date,
        attendance_type=body.attendance_type,
        latitude=job.latitude if job.latitude is not None else 0.0,
        longitude=job.longitude if job.longitude is not None else 0.0,
        manual_location=_backfill_marker(body.reason)[:255],
        checkout_source="manual" if body.attendance_type == "check_out" else None,
    )
    db.add(record)
    log_dev_action(
        db, current_user, "backfill_attendance", target_ip.phone_number,
        f"{body.attendance_date} {body.attendance_type} job#{job.id} — {body.reason.strip()}",
    )
    db.commit()
    db.refresh(record)
    return {
        "message": "Attendance recorded",
        "record": {
            "id": record.id,
            "subject_type": "ip",
            "subject_id": target_ip.id,
            "subject_label": target_ip.phone_number,
            "attendance_date": record.attendance_date.isoformat(),
            "attendance_type": record.attendance_type,
            "notes": record.manual_location,
        },
    }


@router.get("/audit-log", response_model=list[DevAuditLogResponse])
def get_audit_log(
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_dev),
):
    entries = (
        db.query(DevAuditLog)
        .options(selectinload(DevAuditLog.actor))
        .order_by(DevAuditLog.id.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": entry.id,
            "actor_email": entry.actor.email if entry.actor else None,
            "action": entry.action,
            "target_email": entry.target_email,
            "detail": entry.detail,
            "created_at": entry.created_at,
        }
        for entry in entries
    ]
