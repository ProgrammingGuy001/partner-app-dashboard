from datetime import timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import ValidationError
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_fully_verified_user
from app.crud.job import get_ip_job_by_id
from app.database import get_db
from app.model.attendance import DailyAttendance
from app.model.ip import ip
from app.schemas.attendance import DailyAttendanceResponse, DailyInstallationReportData
from app.services.installation_report_service import (
    MAX_PHOTOS,
    MAX_PHOTO_UPLOAD_MB,
    generate_daily_installation_report,
)
from app.services.s3_service import upload_file_to_s3
from app.services.upload_service import read_validated_upload
from app.model.sunday_work_request import SundayWorkRequest
from app.utils.attendance_policy import (
    ATTENDANCE_TIMEZONE,
    CHECK_OUT_CUTOFF,
    attendance_business_date,
    ensure_attendance_window_open,
    is_sunday,
    now_ist,
)
from app.utils.error_text import sanitize_validation_errors
from app.utils.geo import geofence_status

router = APIRouter(prefix="/dashboard/attendance", tags=["Dashboard Attendance"])

ATTENDANCE_PHOTO_EXTENSIONS = {".jpg", ".jpeg", ".png"}
ATTENDANCE_PHOTO_CONTENT_TYPES = {"image/jpeg", "image/png"}


def _recorded_ist(record: DailyAttendance):
    value = record.recorded_at
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(ATTENDANCE_TIMEZONE)


def _report_status(record: DailyAttendance) -> str | None:
    if record.attendance_type != "check_out":
        return None
    if record.checkout_source == "auto":
        return "auto_closed"
    if not record.report_document_url:
        return None
    submitted_at = _recorded_ist(record)
    late = submitted_at.date() > record.attendance_date or submitted_at.time() > CHECK_OUT_CUTOFF
    return "submitted_late" if late else "submitted"


def _serialize(record: DailyAttendance, *, include_report_data: bool = True) -> dict:
    exclude = None if include_report_data else {"report_data"}
    result = DailyAttendanceResponse.model_validate(record).model_dump(mode="json", exclude=exclude)
    result["report_status"] = _report_status(record)
    return result


@router.post("", response_model=dict)
async def record_independent_attendance(
    job_id: Annotated[int | None, Form(gt=0)] = None,
    phone: Annotated[str | None, Form()] = None,
    latitude: Annotated[float, Form(ge=-90, le=90)] = ...,
    longitude: Annotated[float, Form(ge=-180, le=180)] = ...,
    manual_location: Annotated[str, Form(min_length=1, max_length=255)] = ...,
    photo: Annotated[UploadFile, File()] = ...,
    attendance_type: Annotated[Literal["check_in", "check_out"], Form()] = "check_in",
    report_data: Annotated[str | None, Form()] = None,
    report_file: Annotated[UploadFile | None, File()] = None,
    progress_photos: Annotated[list[UploadFile] | None, File()] = None,
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db),
):
    """Record attendance, optionally against one assigned job."""
    business_date = attendance_business_date()
    # Loaded before the window check: a job with a slot sets its own check-in window.
    job = get_ip_job_by_id(db, job_id, current_user.id) if job_id is not None else None
    ensure_attendance_window_open(attendance_type, slot_start=job.slot_start if job else None)
    if job and job.status != "in_progress":
        raise HTTPException(status_code=409, detail="Attendance can only be recorded for a job in progress.")

    # Recorded, never enforced: a fix outside the fence still checks in, it just says so.
    fence_distance, fence_within = geofence_status(job, latitude, longitude) if job else (None, None)

    parsed_report = None
    uploaded_report = None
    report_photos: list[dict] = []
    record_date = business_date
    if attendance_type == "check_in":
        if is_sunday(business_date):
            approved_request = db.query(SundayWorkRequest.id).filter(
                SundayWorkRequest.ip_user_id == current_user.id,
                SundayWorkRequest.request_date == business_date,
                SundayWorkRequest.status == "approved",
            ).first()
            if not approved_request:
                raise HTTPException(
                    status_code=403,
                    detail="Working on Sunday requires superadmin approval. Submit a Sunday work request first.",
                )
        existing = db.query(DailyAttendance.id).filter(
            DailyAttendance.ip_user_id == current_user.id,
            DailyAttendance.job_id == job_id,
            DailyAttendance.attendance_date == business_date,
            DailyAttendance.attendance_type == "check_in",
        ).first()
        if existing:
            raise HTTPException(status_code=409, detail="Today's matching check-in is already recorded.")

    if attendance_type == "check_out":
        check_ins = db.query(DailyAttendance).filter(
            DailyAttendance.ip_user_id == current_user.id,
            DailyAttendance.job_id == job_id,
            DailyAttendance.attendance_type == "check_in",
        ).order_by(DailyAttendance.attendance_date.desc()).all()
        closed_dates = {
            attendance_date for attendance_date, in db.query(DailyAttendance.attendance_date).filter(
                DailyAttendance.ip_user_id == current_user.id,
                DailyAttendance.job_id == job_id,
                DailyAttendance.attendance_type == "check_out",
            ).all()
        }
        checked_in = next((record for record in check_ins if record.attendance_date not in closed_dates), None)
        if not checked_in:
            raise HTTPException(status_code=409, detail="No matching check-in is waiting for a daily report.")
        record_date = checked_in.attendance_date
        if bool(report_data) == bool(report_file):
            raise HTTPException(
                status_code=400,
                detail="Choose either Daily Installation Report fields or one uploaded report file.",
            )
        if report_data:
            if job is None:
                raise HTTPException(
                    status_code=400,
                    detail="Generate the report on the Daily Report page, then upload it for check-out.",
                )
            try:
                parsed_report = DailyInstallationReportData.model_validate_json(report_data)
            except ValidationError as exc:
                # exc.errors() carries an "input" key holding the caller's raw values;
                # raising it as an HTTPException skips main.py's validation scrubber.
                raise HTTPException(
                    status_code=422, detail=sanitize_validation_errors(exc.errors())
                ) from exc
        else:
            uploaded_report = await read_validated_upload(report_file)

        # Progress photos become pages 2+ of the generated report. One page each,
        # so the count is capped before any of them is decoded.
        supplied_photos = [item for item in (progress_photos or []) if item and item.filename]
        if supplied_photos and parsed_report is None:
            raise HTTPException(
                status_code=400,
                detail="Progress photos can only be attached to a generated report.",
            )
        if len(supplied_photos) > MAX_PHOTOS:
            raise HTTPException(
                status_code=400,
                detail=f"Attach at most {MAX_PHOTOS} progress photos.",
            )
        for item in supplied_photos:
            validated = await read_validated_upload(
                item,
                allowed_extensions=ATTENDANCE_PHOTO_EXTENSIONS,
                allowed_content_types=ATTENDANCE_PHOTO_CONTENT_TYPES,
                max_size_mb=MAX_PHOTO_UPLOAD_MB,
            )
            report_photos.append({"bytes": validated.content, "filename": validated.filename})

    manual_location = manual_location.strip()
    attendance_phone = (current_user.phone_number or phone or "").strip()
    if not attendance_phone:
        raise HTTPException(status_code=400, detail="Authenticated user phone number is required for attendance.")

    upload = await read_validated_upload(
        photo,
        allowed_extensions=ATTENDANCE_PHOTO_EXTENSIONS,
        allowed_content_types=ATTENDANCE_PHOTO_CONTENT_TYPES,
        max_size_mb=5,
    )
    photo_url = upload_file_to_s3(upload.content, upload.filename, upload.content_type)

    report_document_url = None
    if parsed_report is not None:
        generated = await generate_daily_installation_report(
            job, record_date, parsed_report, photos=report_photos
        )
        report_document_url = upload_file_to_s3(
            generated.content,
            generated.filename,
            generated.content_type,
        )
    elif uploaded_report is not None:
        report_document_url = upload_file_to_s3(
            uploaded_report.content,
            uploaded_report.filename,
            uploaded_report.content_type,
        )

    record = DailyAttendance(
        job_id=job_id,
        ip_user_id=current_user.id,
        attendance_date=record_date,
        phone=attendance_phone,
        attendance_type=attendance_type,
        latitude=latitude,
        longitude=longitude,
        manual_location=manual_location,
        distance_meters=fence_distance,
        within_geofence=fence_within,
        photo_url=photo_url,
        report_document_url=report_document_url,
        report_data=parsed_report.model_dump() if parsed_report else None,
        checkout_source="manual" if attendance_type == "check_out" else None,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "message": "Check-in recorded successfully" if attendance_type == "check_in" else "Check-out and report submitted successfully",
        "attendance": _serialize(record),
    }


@router.get("", response_model=dict)
def get_independent_attendance(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db),
):
    """Return attendance history and any job/day with a missing report."""
    phone = (current_user.phone_number or "").strip()
    if not phone:
        return {"message": "Attendance records fetched", "records": [], "missing_reports": []}

    base_query = db.query(DailyAttendance).filter(or_(
        DailyAttendance.ip_user_id == current_user.id,
        (DailyAttendance.ip_user_id.is_(None)) & (DailyAttendance.phone == phone),
    ))
    attendance_rows = base_query.with_entities(
        DailyAttendance.job_id,
        DailyAttendance.attendance_date,
        DailyAttendance.attendance_type,
        DailyAttendance.report_document_url,
    ).all()
    checkouts = {
        (record.job_id, record.attendance_date): record
        for record in attendance_rows
        if record.attendance_type == "check_out" and record.report_document_url
    }
    current = now_ist()
    missing_reports = []
    for record in attendance_rows:
        key = (record.job_id, record.attendance_date)
        if record.attendance_type != "check_in" or key in checkouts:
            continue
        overdue = record.attendance_date < current.date() or current.time() > CHECK_OUT_CUTOFF
        missing_reports.append({
            "job_id": record.job_id,
            "attendance_date": record.attendance_date.isoformat(),
            "status": "overdue" if overdue else "missing",
        })

    page = base_query.order_by(DailyAttendance.recorded_at.desc()).offset(skip).limit(limit).all()
    return {
        "message": "Attendance records fetched",
        "skip": skip,
        "limit": limit,
        "records": [_serialize(record, include_report_data=False) for record in page],
        "missing_reports": missing_reports,
    }
