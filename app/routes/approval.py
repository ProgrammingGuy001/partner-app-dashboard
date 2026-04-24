from datetime import datetime, date

from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from app.database import get_db
from app.crud.ip import verify_ip_user, get_ip_by_phone, get_all_ips, get_approved_ips
from app.core.security import get_current_user
from app.model.user import User
from app.model.ip import ip, IPAdminAssignment
from app.model.attendance import DailyAttendance
from app.model.job import Job
from app.model.admin_attendance import AdminAttendance
from app.services.s3_service import upload_file_to_s3
from app.services.upload_service import read_validated_upload
from app.utils.attendance_policy import (
    build_attendance_completion,
    ensure_attendance_window_open,
)

router = APIRouter(prefix="/admin", tags=["Admin"])


class VerifyIPRequest(BaseModel):
    admin_ids: Optional[List[int]] = None


class AdminUserResponse(BaseModel):
    id: int
    email: str
    isActive: bool
    isApproved: bool
    is_superadmin: bool

    class Config:
        from_attributes = True


def _visible_ip_users(db: Session, current_user: User, phone: Optional[str] = None) -> list[ip]:
    query = db.query(ip)
    if not getattr(current_user, "is_superadmin", False):
        query = query.join(IPAdminAssignment, IPAdminAssignment.ip_id == ip.id).filter(
            IPAdminAssignment.admin_id == current_user.id
        )
    if phone:
        query = query.filter(ip.phone_number.ilike(f"%{phone.strip()}%"))
    return query.all()


def _ip_completion_summary(db: Session, ip_users: list[ip]) -> list[dict]:
    phones = [ip_user.phone_number for ip_user in ip_users if ip_user.phone_number]
    attendance_by_phone: dict[str, list[datetime]] = {phone: [] for phone in phones}
    if phones:
        rows = (
            db.query(DailyAttendance.phone, DailyAttendance.recorded_at)
            .filter(DailyAttendance.phone.in_(phones))
            .all()
        )
        for phone, recorded_at in rows:
            attendance_by_phone.setdefault(phone, []).append(recorded_at)

    return [
        {
            "ip_id": ip_user.id,
            "name": " ".join(
                part for part in [ip_user.first_name, ip_user.last_name] if part
            ) or ip_user.phone_number,
            "phone": ip_user.phone_number,
            **build_attendance_completion(
                ip_user.created_at,
                attendance_by_phone.get(ip_user.phone_number, []),
            ),
        }
        for ip_user in ip_users
    ]


def _admin_completion_summary(db: Session, admins: list[User]) -> list[dict]:
    admin_ids = [admin.id for admin in admins]
    attendance_by_admin: dict[int, list[datetime]] = {admin_id: [] for admin_id in admin_ids}
    if admin_ids:
        rows = (
            db.query(AdminAttendance.admin_id, AdminAttendance.marked_at)
            .filter(AdminAttendance.admin_id.in_(admin_ids))
            .all()
        )
        for admin_id, marked_at in rows:
            attendance_by_admin.setdefault(admin_id, []).append(marked_at)

    return [
        {
            "admin_id": admin.id,
            "admin_email": admin.email,
            **build_attendance_completion(admin.created_at, attendance_by_admin.get(admin.id, [])),
        }
        for admin in admins
    ]


class AssignAdminRequest(BaseModel):
    admin_ids: List[int]


def _serialize_ip_user(ip_user: ip) -> dict:
    return {
        "id": ip_user.id,
        "phone_number": ip_user.phone_number,
        "first_name": ip_user.first_name,
        "last_name": ip_user.last_name,
        "city": ip_user.city,
        "pincode": ip_user.pincode,
        "is_assigned": ip_user.is_assigned,
        "is_verified": ip_user.is_verified,
        "is_pan_verified": ip_user.is_pan_verified,
        "is_bank_details_verified": ip_user.is_bank_details_verified,
        "is_id_verified": ip_user.is_id_verified,
        "pan_number": ip_user.pan_number,
        "pan_name": ip_user.pan_name,
        "account_number": ip_user.account_number,
        "ifsc_code": ip_user.ifsc_code,
        "account_holder_name": ip_user.account_holder_name,
        "registered_at": ip_user.registered_at,
        "verified_at": ip_user.verified_at,
        "assigned_admin_ids": [a.admin_id for a in ip_user.admin_assignments],
    }


@router.post("/verify-ip/{phone_number}")
def verify_ip(
    phone_number: str,
    request: VerifyIPRequest = VerifyIPRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Verify an IP user and optionally assign admins to manage them"""
    db_ip = get_ip_by_phone(db, phone_number)
    if not db_ip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="IP user not found"
        )

    verified_ip = verify_ip_user(db, phone_number)

    # Assign admins if provided
    if request.admin_ids:
        # Clear existing assignments
        db.query(IPAdminAssignment).filter(IPAdminAssignment.ip_id == verified_ip.id).delete()

        # Add new assignments
        for admin_id in request.admin_ids:
            admin = db.query(User).filter(User.id == admin_id).first()
            if not admin:
                raise HTTPException(status_code=404, detail=f"Admin with ID {admin_id} not found")
            assignment = IPAdminAssignment(ip_id=verified_ip.id, admin_id=admin_id)
            db.add(assignment)
        db.commit()

    # Get assigned admin IDs
    assigned_admins = db.query(IPAdminAssignment).filter(IPAdminAssignment.ip_id == verified_ip.id).all()
    assigned_admin_ids = [a.admin_id for a in assigned_admins]

    return {
        "message": "IP user verified successfully",
        "phone_number": verified_ip.phone_number,
        "is_id_verified": verified_ip.is_id_verified,
        "is_verified": verified_ip.is_verified,
        "is_pan_verified": verified_ip.is_pan_verified,
        "is_bank_details_verified": verified_ip.is_bank_details_verified,
        "assigned_admin_ids": assigned_admin_ids
    }


@router.get("/ips")
def get_ips(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get all IPs with their assigned admin IDs"""
    is_superadmin = getattr(current_user, 'is_superadmin', False)

    if is_superadmin:
        ips = db.query(ip).all()
    else:
        ips = get_all_ips(db, admin_id=current_user.id)

    return [_serialize_ip_user(ip_user) for ip_user in ips]


@router.get("/ips/approved")
def get_approved_ips_list(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get only approved/verified IPs for job assignment dropdown.
    Superadmins see all approved IPs, regular admins only see IPs assigned to them.
    """
    is_superadmin = getattr(current_user, 'is_superadmin', False)

    if is_superadmin:
        # Superadmins see all approved IPs
        approved_ips = db.query(ip).filter(ip.is_id_verified == True).all()
    else:
        # Regular admins only see IPs assigned to them that are approved
        approved_ips = get_approved_ips(db, admin_id=current_user.id)

    return [_serialize_ip_user(ip_user) for ip_user in approved_ips]


@router.get("/admin-users", response_model=List[AdminUserResponse])
def get_admin_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get list of admin users for IP assignment dropdown"""
    return db.query(User).filter(User.isActive == True, User.isApproved == True).all()


@router.post("/ips/{ip_id}/assign-admins")
def assign_admins_to_ip(
    ip_id: int,
    request: AssignAdminRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Assign multiple admins to an IP"""
    # Get IP
    ip_user = db.query(ip).filter(ip.id == ip_id).first()
    if not ip_user:
        raise HTTPException(status_code=404, detail="IP not found")

    # Check if current user is superadmin
    if not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Only superadmins can assign admins to IPs")

    # Clear existing assignments
    db.query(IPAdminAssignment).filter(IPAdminAssignment.ip_id == ip_id).delete()

    # Add new assignments
    for admin_id in request.admin_ids:
        admin = db.query(User).filter(User.id == admin_id).first()
        if not admin:
            raise HTTPException(status_code=404, detail=f"Admin with ID {admin_id} not found")
        assignment = IPAdminAssignment(ip_id=ip_id, admin_id=admin_id)
        db.add(assignment)

    db.commit()

    return {"message": "Admins assigned successfully", "ip_id": ip_id, "admin_ids": request.admin_ids}


@router.get("/ips/{ip_id}/admins")
def get_ip_admins(ip_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get list of admins assigned to an IP"""
    ip_user = db.query(ip).filter(ip.id == ip_id).first()
    if not ip_user:
        raise HTTPException(status_code=404, detail="IP not found")

    assignments = db.query(IPAdminAssignment).filter(IPAdminAssignment.ip_id == ip_id).all()
    admin_ids = [a.admin_id for a in assignments]

    admins = db.query(User).filter(User.id.in_(admin_ids)).all() if admin_ids else []

    return [AdminUserResponse.model_validate(admin) for admin in admins]


class AttendanceRecord(BaseModel):
    id: int
    job_id: Optional[int]
    job_name: Optional[str]
    phone: str
    latitude: float
    longitude: float
    manual_location: Optional[str]
    photo_url: Optional[str]
    recorded_at: datetime

    model_config = ConfigDict(from_attributes=True)


@router.get("/attendance", response_model=dict)
def get_all_attendance(
    job_id: Optional[int] = Query(None),
    phone: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin endpoint: list all attendance records with optional filters"""
    visible_ips = _visible_ip_users(db, current_user, phone=phone)
    visible_phones = [ip_user.phone_number for ip_user in visible_ips if ip_user.phone_number]

    query = db.query(DailyAttendance).join(Job, Job.id == DailyAttendance.job_id, isouter=True)
    if not getattr(current_user, "is_superadmin", False):
        if not visible_phones:
            query = query.filter(DailyAttendance.id == -1)
        else:
            query = query.filter(DailyAttendance.phone.in_(visible_phones))

    if job_id is not None:
        query = query.filter(DailyAttendance.job_id == job_id)
    if phone:
        query = query.filter(DailyAttendance.phone.ilike(f"%{phone.strip()}%"))
    if date_from:
        query = query.filter(DailyAttendance.recorded_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        from datetime import time as dtime
        query = query.filter(DailyAttendance.recorded_at <= datetime.combine(date_to, dtime(23, 59, 59)))

    total = query.count()
    records = query.order_by(DailyAttendance.recorded_at.desc()).offset(skip).limit(limit).all()

    job_names: dict[Optional[int], Optional[str]] = {}
    for r in records:
        if r.job_id not in job_names:
            job = db.query(Job).filter(Job.id == r.job_id).first() if r.job_id else None
            job_names[r.job_id] = job.name if job else None

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "completion_summary": _ip_completion_summary(db, visible_ips),
        "records": [
            {
                "id": r.id,
                "job_id": r.job_id,
                "job_name": job_names.get(r.job_id),
                "phone": r.phone,
                "latitude": r.latitude,
                "longitude": r.longitude,
                "manual_location": r.manual_location,
                "photo_url": r.photo_url,
                "recorded_at": r.recorded_at.isoformat(),
            }
            for r in records
        ],
    }


class MarkAdminAttendanceRequest(BaseModel):
    notes: Optional[str] = None
    manual_location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


@router.post("/my-attendance", response_model=dict)
async def mark_admin_attendance(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin marks their own attendance for today."""
    if getattr(current_user, "is_superadmin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superadmins do not mark attendance.",
        )
    ensure_attendance_window_open()

    notes: str | None = None
    manual_location: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    photo_url: str | None = None

    content_type = request.headers.get("content-type", "")
    if content_type.startswith("multipart/form-data"):
        form = await request.form()
        notes = form.get("notes") or None
        manual_location = form.get("manual_location") or None
        latitude_value = form.get("latitude")
        longitude_value = form.get("longitude")
        if latitude_value in (None, "") or longitude_value in (None, ""):
            raise HTTPException(status_code=422, detail="Latitude and longitude are required")
        try:
            latitude = float(str(latitude_value))
            longitude = float(str(longitude_value))
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="Invalid latitude or longitude") from exc
        photo = form.get("photo")
        if not photo or not getattr(photo, "filename", ""):
            raise HTTPException(status_code=422, detail="Attendance photo is required")
        upload = await read_validated_upload(photo)
        photo_url = upload_file_to_s3(
            file_content=upload.content,
            filename=upload.filename,
            content_type=upload.content_type,
        )
    else:
        payload = await request.json() if content_type.startswith("application/json") else {}
        body = MarkAdminAttendanceRequest.model_validate(payload)
        notes = body.notes
        manual_location = body.manual_location
        latitude = body.latitude
        longitude = body.longitude
        raise HTTPException(status_code=422, detail="Admin attendance requires multipart form data with GPS and photo")

    record = AdminAttendance(
        admin_id=current_user.id,
        latitude=latitude,
        longitude=longitude,
        notes=notes.strip() if notes else None,
        manual_location=manual_location.strip() if manual_location else None,
        photo_url=photo_url,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {
        "message": "Attendance marked",
        "record": {
            "id": record.id,
            "admin_id": record.admin_id,
            "admin_email": current_user.email,
            "marked_at": record.marked_at.isoformat(),
            "latitude": record.latitude,
            "longitude": record.longitude,
            "notes": record.notes,
            "manual_location": record.manual_location,
            "photo_url": record.photo_url,
        },
    }


@router.get("/my-attendance", response_model=dict)
def get_my_admin_attendance(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin fetches their own attendance history."""
    if getattr(current_user, "is_superadmin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superadmins do not have personal attendance records.",
        )

    total = db.query(AdminAttendance).filter(AdminAttendance.admin_id == current_user.id).count()
    records = (
        db.query(AdminAttendance)
        .filter(AdminAttendance.admin_id == current_user.id)
        .order_by(AdminAttendance.marked_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    all_records = (
        db.query(AdminAttendance)
        .filter(AdminAttendance.admin_id == current_user.id)
        .all()
    )
    return {
        "total": total,
        "completion": build_attendance_completion(
            current_user.created_at,
            [r.marked_at for r in all_records],
        ),
        "records": [
            {
                "id": r.id,
                "admin_id": r.admin_id,
                "admin_email": current_user.email,
                "marked_at": r.marked_at.isoformat(),
                "latitude": r.latitude,
                "longitude": r.longitude,
                "notes": r.notes,
                "manual_location": r.manual_location,
                "photo_url": r.photo_url,
            }
            for r in records
        ],
    }


@router.get("/all-attendance", response_model=dict)
def get_all_admin_attendance(
    admin_id: Optional[int] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Superadmin: view all admin attendance records."""
    if not current_user.is_superadmin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Superadmin only")

    query = db.query(AdminAttendance)
    if admin_id is not None:
        query = query.filter(AdminAttendance.admin_id == admin_id)
    if date_from:
        query = query.filter(AdminAttendance.marked_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        from datetime import time as dtime
        query = query.filter(AdminAttendance.marked_at <= datetime.combine(date_to, dtime(23, 59, 59)))

    admin_query = db.query(User).filter(User.is_superadmin == False)
    if admin_id is not None:
        admin_query = admin_query.filter(User.id == admin_id)
    admins = admin_query.all()

    total = query.count()
    records = query.order_by(AdminAttendance.marked_at.desc()).offset(skip).limit(limit).all()

    admin_emails: dict[int, str] = {}
    for r in records:
        if r.admin_id not in admin_emails:
            admin = db.query(User).filter(User.id == r.admin_id).first()
            admin_emails[r.admin_id] = admin.email if admin else f"admin#{r.admin_id}"

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "completion_summary": _admin_completion_summary(db, admins),
        "records": [
            {
                "id": r.id,
                "admin_id": r.admin_id,
                "admin_email": admin_emails.get(r.admin_id, f"admin#{r.admin_id}"),
                "marked_at": r.marked_at.isoformat(),
                "latitude": r.latitude,
                "longitude": r.longitude,
                "notes": r.notes,
                "manual_location": r.manual_location,
                "photo_url": r.photo_url,
            }
            for r in records
        ],
    }
