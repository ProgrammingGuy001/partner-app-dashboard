from datetime import datetime, date

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status, Path, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict, Field
from typing import Annotated, List, Optional
from app.database import get_db
from app.crud.ip import verify_ip_user, get_ip_by_phone, get_all_ips, get_approved_ips
from app.core.security import get_current_user
from app.model.user import User
from app.model.ip import ip, IPAdminAssignment
from app.model.attendance import DailyAttendance
from app.model.job import Customer, Job
from app.model.admin_attendance import AdminAttendance
from app.model.sunday_work_request import SundayWorkRequest
from app.services.attendance_export import build_attendance_workbook
from app.services.s3_service import upload_file_to_s3
from app.services.sunday_attendance import (
    find_request as find_sunday_request,
    park_attendance as park_sunday_attendance,
)
from app.services.upload_service import read_validated_upload
from app.api.v1.attendance import _report_status
from app.utils.attendance_policy import (
    CHECK_OUT_CUTOFF,
    attendance_business_date,
    build_attendance_completion,
    ensure_attendance_window_open,
    is_sunday,
    now_ist,
)
from app.utils.geo import nearest_job_status
from app.utils.ip_assignment import is_admin_allowed_for_ip

router = APIRouter(prefix="/admin", tags=["Admin"])

ATTENDANCE_PHOTO_EXTENSIONS = {".jpg", ".jpeg", ".png"}
ATTENDANCE_PHOTO_CONTENT_TYPES = {"image/jpeg", "image/png"}


class VerifyIPRequest(BaseModel):
    admin_ids: Optional[List[int]] = None


class AdminUserResponse(BaseModel):
    id: int
    email: str
    # Nullable on the model; dropdowns fall back to the email when it's unset.
    name: Optional[str] = None
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
        "is_internal": ip_user.is_internal,
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
    phone_number: Annotated[str, Path(min_length=10, max_length=15, pattern=r"^\+?\d+$")],
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

    if (
        not getattr(current_user, "is_superadmin", False)
        and not is_admin_allowed_for_ip(db, db_ip.id, current_user.id)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to verify this IP user",
        )

    if request.admin_ids and not getattr(current_user, "is_superadmin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only a superadmin can change IP admin assignments",
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
    ip_id: Annotated[int, Path(gt=0)],
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
def get_ip_admins(
    ip_id: Annotated[int, Path(gt=0)],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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
    attendance_type: str
    latitude: float
    longitude: float
    manual_location: Optional[str]
    photo_url: Optional[str]
    report_document_url: Optional[str]
    report_status: Optional[str]
    recorded_at: datetime

    model_config = ConfigDict(from_attributes=True)


@router.get("/attendance", response_model=dict)
def get_all_attendance(
    job_id: Optional[int] = Query(None, gt=0),
    phone: Optional[str] = Query(None, min_length=3, max_length=15),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
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
    attendance_rows = query.with_entities(
        DailyAttendance.ip_user_id,
        DailyAttendance.phone,
        DailyAttendance.job_id,
        DailyAttendance.attendance_date,
        DailyAttendance.attendance_type,
        DailyAttendance.report_document_url,
    ).all()

    job_ids = {r.job_id for r in attendance_rows if r.job_id}
    job_names: dict[Optional[int], Optional[str]] = {
        row.id: row.name
        for row in db.query(Job.id, Customer.name)
        .outerjoin(Customer, Job.customer_id == Customer.id)
        .filter(Job.id.in_(job_ids))
        .all()
    } if job_ids else {}

    checkouts = {
        (record.ip_user_id or record.phone, record.job_id, record.attendance_date): record
        for record in attendance_rows
        if record.attendance_type == "check_out" and record.report_document_url
    }
    current = now_ist()
    missing_reports = []
    for record in attendance_rows:
        key = (record.ip_user_id or record.phone, record.job_id, record.attendance_date)
        if record.attendance_type != "check_in" or key in checkouts:
            continue
        overdue = record.attendance_date < current.date() or current.time() > CHECK_OUT_CUTOFF
        missing_reports.append({
            "ip_user_id": record.ip_user_id,
            "phone": record.phone,
            "job_id": record.job_id,
            "job_name": job_names.get(record.job_id),
            "attendance_date": record.attendance_date.isoformat(),
            "status": "overdue" if overdue else "missing",
        })

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "completion_summary": _ip_completion_summary(db, visible_ips),
        "missing_reports": missing_reports,
        "records": [
            {
                "id": r.id,
                "job_id": r.job_id,
                "job_name": job_names.get(r.job_id),
                "phone": r.phone,
                "attendance_type": r.attendance_type,
                "latitude": r.latitude,
                "longitude": r.longitude,
                "distance_meters": r.distance_meters,
                "within_geofence": r.within_geofence,
                "manual_location": r.manual_location,
                "photo_url": r.photo_url,
                "report_document_url": r.report_document_url,
                "checkout_source": r.checkout_source,
                "report_status": _report_status(r),
                "recorded_at": r.recorded_at.isoformat(),
            }
            for r in records
        ],
    }


@router.get("/attendance/export")
def export_attendance_workbook(
    job_id: Optional[int] = Query(None, gt=0),
    phone: Optional[str] = Query(None, min_length=3, max_length=15),
    admin_id: Optional[int] = Query(None, gt=0),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download attendance as XLSX, including each record's geofence result."""
    is_superadmin = getattr(current_user, "is_superadmin", False)
    visible_ips = _visible_ip_users(db, current_user, phone=phone)
    # Superadmins are unscoped; everyone else is limited to their own IPs, exactly as
    # GET /admin/attendance already does.
    visible_phones = (
        None
        if is_superadmin
        else [ip_user.phone_number for ip_user in visible_ips if ip_user.phone_number]
    )
    phone_to_name = {
        ip_user.phone_number: f"{ip_user.first_name or ''} {ip_user.last_name or ''}".strip()
        for ip_user in visible_ips
        if ip_user.phone_number
    }

    xlsx_bytes = build_attendance_workbook(
        db,
        visible_phones=visible_phones,
        phone_to_name=phone_to_name,
        include_supervisors=is_superadmin,
        report_status=_report_status,
        job_id=job_id,
        phone=phone,
        admin_id=admin_id,
        date_from=date_from,
        date_to=date_to,
    )
    filename = f"attendance_{now_ist().date().isoformat()}.xlsx"
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Encoding": "identity",
        },
    )


class MarkAdminAttendanceRequest(BaseModel):
    notes: Optional[str] = Field(default=None, max_length=1000)
    manual_location: Optional[str] = Field(default=None, max_length=255)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)


def _validate_coordinates(latitude: float, longitude: float) -> None:
    if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
        raise HTTPException(status_code=422, detail="Latitude or longitude is out of range")


def _admin_attendance_job_names(db: Session, records) -> dict:
    """Names for whichever job pins the given fixes were matched against."""
    job_ids = {r.matched_job_id for r in records if r.matched_job_id}
    if not job_ids:
        return {}
    return {
        row.id: row.name
        for row in db.query(Job.id, Customer.name)
        .outerjoin(Customer, Job.customer_id == Customer.id)
        .filter(Job.id.in_(job_ids))
        .all()
    }


def _serialize_admin_attendance(record, admin_email: str, job_names: dict) -> dict:
    return {
        "id": record.id,
        "admin_id": record.admin_id,
        "admin_email": admin_email,
        "marked_at": record.marked_at.isoformat(),
        "latitude": record.latitude,
        "longitude": record.longitude,
        "matched_job_id": record.matched_job_id,
        "matched_job_name": job_names.get(record.matched_job_id),
        "distance_meters": record.distance_meters,
        "within_geofence": record.within_geofence,
        "notes": record.notes,
        "manual_location": record.manual_location,
        "photo_url": record.photo_url,
    }


def _limited_form_text(value, field_name: str, max_length: int) -> str | None:
    if value in (None, ""):
        return None
    text = str(value).strip()
    if len(text) > max_length:
        raise HTTPException(status_code=422, detail=f"{field_name} must be at most {max_length} characters")
    return text or None


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

    # Same handling as the IP check-in path (app/api/v1/attendance.py): an approved
    # request unlocks the day, an absent one is filed from this attempt and parked,
    # pending and rejected both stop here.
    business_date = attendance_business_date()
    park_for_approval = False
    if is_sunday(business_date):
        sunday_request = find_sunday_request(db, business_date, admin_id=current_user.id)
        if sunday_request is None:
            park_for_approval = True
        elif sunday_request.status == "pending":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Your Sunday work request is already with the superadmin. "
                    "Your attendance will be recorded once it is approved."
                ),
            )
        elif sunday_request.status == "rejected":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Your Sunday work request for today was rejected, "
                    "so attendance cannot be marked."
                ),
            )

    notes: str | None = None
    manual_location: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    photo_url: str | None = None

    content_type = request.headers.get("content-type", "")
    if content_type.startswith("multipart/form-data"):
        form = await request.form()
        notes = _limited_form_text(form.get("notes"), "notes", 1000)
        manual_location = _limited_form_text(form.get("manual_location"), "manual_location", 255)
        if not manual_location:
            raise HTTPException(status_code=422, detail="Manual location is required")
        latitude_value = form.get("latitude")
        longitude_value = form.get("longitude")
        if latitude_value in (None, "") or longitude_value in (None, ""):
            raise HTTPException(status_code=422, detail="Latitude and longitude are required")
        try:
            latitude = float(str(latitude_value))
            longitude = float(str(longitude_value))
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="Invalid latitude or longitude") from exc
        _validate_coordinates(latitude, longitude)

        photo = form.get("photo")
        if not photo or not getattr(photo, "filename", ""):
            raise HTTPException(status_code=422, detail="Attendance photo is required")
        upload = await read_validated_upload(
            photo,
            allowed_extensions=ATTENDANCE_PHOTO_EXTENSIONS,
            allowed_content_types=ATTENDANCE_PHOTO_CONTENT_TYPES,
            max_size_mb=5,
        )
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

    # No job_id is supplied, so the fix is matched against the nearest active site.
    # ponytail: python-side scan over active pinned jobs — a small set. Move to
    # PostGIS/earthdistance if that list ever reaches the thousands.
    candidate_jobs = (
        db.query(Job.id, Job.latitude, Job.longitude, Job.geofence_radius)
        .filter(
            Job.latitude.isnot(None),
            Job.longitude.isnot(None),
            Job.status != "completed",
        )
        .all()
    )
    matched_job_id, fence_distance, fence_within = nearest_job_status(
        candidate_jobs, latitude, longitude
    )

    if park_for_approval:
        request = park_sunday_attendance(
            db,
            business_date,
            {
                "latitude": latitude,
                "longitude": longitude,
                "manual_location": manual_location.strip() if manual_location else None,
                "matched_job_id": matched_job_id,
                "distance_meters": fence_distance,
                "within_geofence": fence_within,
                "photo_url": photo_url,
                "notes": notes.strip() if notes else None,
            },
            admin_id=current_user.id,
            reason=notes,
        )
        db.commit()
        db.refresh(request)
        return JSONResponse(
            status_code=status.HTTP_202_ACCEPTED,
            content={
                "status": "pending_approval",
                "message": (
                    "Approval request sent to superadmin. "
                    "Your attendance will be recorded once it is approved."
                ),
                "sunday_request_id": request.id,
            },
        )

    record = AdminAttendance(
        admin_id=current_user.id,
        latitude=latitude,
        longitude=longitude,
        matched_job_id=matched_job_id,
        distance_meters=fence_distance,
        within_geofence=fence_within,
        notes=notes.strip() if notes else None,
        manual_location=manual_location.strip() if manual_location else None,
        photo_url=photo_url,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {
        "message": "Attendance marked",
        "record": _serialize_admin_attendance(
            record, current_user.email, _admin_attendance_job_names(db, [record])
        ),
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
    all_marked_at = (
        db.query(AdminAttendance.marked_at)
        .filter(AdminAttendance.admin_id == current_user.id)
        .all()
    )
    job_names = _admin_attendance_job_names(db, records)
    return {
        "total": total,
        "completion": build_attendance_completion(
            current_user.created_at,
            [row.marked_at for row in all_marked_at],
        ),
        "records": [
            _serialize_admin_attendance(r, current_user.email, job_names) for r in records
        ],
    }


@router.get("/all-attendance", response_model=dict)
def get_all_admin_attendance(
    admin_id: Optional[int] = Query(None, gt=0),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
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

    record_admin_ids = {r.admin_id for r in records}
    admin_emails = {
        admin.id: admin.email
        for admin in db.query(User.id, User.email).filter(User.id.in_(record_admin_ids)).all()
    } if record_admin_ids else {}

    job_names = _admin_attendance_job_names(db, records)
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "completion_summary": _admin_completion_summary(db, admins),
        "records": [
            _serialize_admin_attendance(
                r, admin_emails.get(r.admin_id, f"admin#{r.admin_id}"), job_names
            )
            for r in records
        ],
    }
