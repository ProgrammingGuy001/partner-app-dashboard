from datetime import datetime, time, timedelta, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_fully_verified_user
from app.crud.job import get_ip_job_by_id
from app.database import get_db
from app.model.attendance import DailyAttendance
from app.model.ip import ip
from app.model.roster import JobRosterEntry
from app.schemas.attendance import DailyAttendanceResponse, DailyInstallationReportData
from app.services.installation_report_service import (
    MAX_PHOTOS,
    MAX_PHOTO_UPLOAD_MB,
    generate_daily_installation_report,
)
from app.services.s3_service import upload_file_to_s3
from app.services.sunday_attendance import (
    find_request as find_sunday_request,
    park_attendance as park_sunday_attendance,
)
from app.model.media_document import MediaDocument
from app.services.upload_service import read_validated_upload
from app.utils.attendance_policy import (
    ATTENDANCE_TIMEZONE,
    CHECK_OUT_CUTOFF,
    attendance_business_date,
    ensure_attendance_window_open,
    is_sunday,
    now_ist,
)
from app.utils.error_text import sanitize_validation_errors
from app.utils.job_documents import document_label, site_report_slot
from app.crud.checklist import checklist_items_pending
from app.utils.geo import geofence_status
from app.utils.roster_day import day_end_by_entry, day_entries, day_window

router = APIRouter(prefix="/dashboard/attendance", tags=["Dashboard Attendance"])

ATTENDANCE_PHOTO_EXTENSIONS = {".jpg", ".jpeg", ".png"}
ATTENDANCE_PHOTO_CONTENT_TYPES = {"image/jpeg", "image/png"}


def _recorded_ist(record: DailyAttendance):
    value = record.recorded_at
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(ATTENDANCE_TIMEZONE)


def _report_status(record: DailyAttendance, day_slot_end: time | None = None) -> str | None:
    if record.attendance_type != "check_out":
        return None
    if record.checkout_source == "auto":
        return "auto_closed"
    if not record.report_document_url:
        return None
    submitted_at = _recorded_ist(record)
    cutoff = CHECK_OUT_CUTOFF
    if record.roster_entry is not None:
        cutoff = (
            datetime.combine(record.attendance_date, day_slot_end or record.roster_entry.slot_end)
            + timedelta(minutes=30)
        ).time()
    late = submitted_at.date() > record.attendance_date or submitted_at.time() > cutoff
    return "submitted_late" if late else "submitted"


def _serialize(
    record: DailyAttendance,
    *,
    include_report_data: bool = True,
    day_slot_end: time | None = None,
) -> dict:
    exclude = None if include_report_data else {"report_data"}
    result = DailyAttendanceResponse.model_validate(record).model_dump(mode="json", exclude=exclude)
    result["report_status"] = _report_status(record, day_slot_end)
    return result


@router.post("", response_model=dict)
async def record_independent_attendance(
    job_id: Annotated[int | None, Form(gt=0)] = None,
    roster_entry_id: Annotated[int | None, Form(gt=0)] = None,
    phone: Annotated[str | None, Form()] = None,
    latitude: Annotated[float, Form(ge=-90, le=90)] = ...,
    longitude: Annotated[float, Form(ge=-180, le=180)] = ...,
    manual_location: Annotated[str, Form(min_length=1, max_length=255)] = ...,
    photo: Annotated[UploadFile, File()] = ...,
    attendance_type: Annotated[Literal["check_in", "check_out"], Form()] = "check_in",
    report_data: Annotated[str | None, Form()] = None,
    report_file: Annotated[UploadFile | None, File()] = None,
    progress_photos: Annotated[list[UploadFile] | None, File()] = None,
    # Why they are working this Sunday. Only read when the day needs approval.
    sunday_reason: Annotated[str | None, Form(max_length=500)] = None,
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db),
):
    """Record attendance, optionally against one assigned job."""
    business_date = attendance_business_date()
    roster_entry = None
    span_start = span_end = None
    if roster_entry_id is not None:
        roster_entry = db.query(JobRosterEntry).filter(
            JobRosterEntry.id == roster_entry_id,
            JobRosterEntry.ip_user_id == current_user.id,
            JobRosterEntry.work_date == business_date,
        ).first()
        if not roster_entry:
            raise HTTPException(status_code=404, detail="Today's roster assignment was not found")
        if job_id is not None and job_id != roster_entry.job_id:
            raise HTTPException(status_code=409, detail="Roster assignment does not match the selected job")
        job = roster_entry.job
        job_id = job.id
        # A job holding both slots today is one visit, not two. Attendance is marked
        # once, against the first half, and runs until the last slot ends.
        span = day_entries(
            db, ip_user_id=current_user.id, job_id=job_id, work_date=business_date
        )
        if roster_entry.id != span[0].id:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"This job runs both slots today. Mark attendance on the first half "
                    f"({span[0].slot_start.strftime('%H:%M')}-{span[0].slot_end.strftime('%H:%M')}); "
                    f"it covers the whole day."
                ),
            )
        span_start, span_end = day_window(span)
    else:
        job = get_ip_job_by_id(
            db, job_id, current_user.id, allow_roster=False
        ) if job_id is not None else None
    ensure_attendance_window_open(
        attendance_type,
        job_type=job.type if job else None,
        slot_start=span_start if roster_entry else (job.slot_start if job else None),
    )
    if job and job.status != "in_progress":
        raise HTTPException(status_code=409, detail="Attendance can only be recorded for a job in progress.")

    # Recorded, never enforced: a fix outside the fence still checks in, it just says so.
    fence_distance, fence_within = geofence_status(job, latitude, longitude) if job else (None, None)

    parsed_report = None
    uploaded_report = None
    report_photos: list[dict] = []
    record_date = business_date
    # Set when this Sunday check-in has to wait for a superadmin. The attempt is not
    # refused: it is parked below, once the photo is in S3, and replayed on approval.
    park_for_approval = False
    if attendance_type == "check_in":
        if is_sunday(business_date):
            sunday_request = find_sunday_request(db, business_date, ip_user_id=current_user.id)
            if sunday_request is None:
                park_for_approval = True
            elif sunday_request.status == "pending":
                # Nothing new to park, so return before paying for the photo upload.
                raise HTTPException(
                    status_code=409,
                    detail="Your Sunday work request is already with the superadmin. Your attendance will be recorded once it is approved.",
                )
            elif sunday_request.status == "rejected":
                raise HTTPException(
                    status_code=403,
                    detail="Your Sunday work request for today was rejected, so attendance cannot be marked.",
                )
        existing_query = db.query(DailyAttendance.id).filter(
            DailyAttendance.ip_user_id == current_user.id,
            DailyAttendance.attendance_date == business_date,
            DailyAttendance.attendance_type == "check_in",
        )
        existing_query = existing_query.filter(
            DailyAttendance.roster_entry_id == roster_entry_id
        ) if roster_entry_id else existing_query.filter(
            DailyAttendance.job_id == job_id,
            DailyAttendance.roster_entry_id.is_(None),
        )
        existing = existing_query.first()
        if existing:
            raise HTTPException(status_code=409, detail="Today's matching check-in is already recorded.")

    if attendance_type == "check_out":
        check_in_query = db.query(DailyAttendance).filter(
            DailyAttendance.ip_user_id == current_user.id,
            DailyAttendance.attendance_type == "check_in",
        )
        check_in_query = check_in_query.filter(
            DailyAttendance.roster_entry_id == roster_entry_id
        ) if roster_entry_id else check_in_query.filter(
            DailyAttendance.job_id == job_id,
            DailyAttendance.roster_entry_id.is_(None),
        )
        check_ins = check_in_query.order_by(DailyAttendance.attendance_date.desc()).all()
        check_out_query = db.query(DailyAttendance.attendance_date).filter(
            DailyAttendance.ip_user_id == current_user.id,
            DailyAttendance.attendance_type == "check_out",
        )
        check_out_query = check_out_query.filter(
            DailyAttendance.roster_entry_id == roster_entry_id
        ) if roster_entry_id else check_out_query.filter(
            DailyAttendance.job_id == job_id,
            DailyAttendance.roster_entry_id.is_(None),
        )
        closed_dates = {attendance_date for attendance_date, in check_out_query.all()}
        checked_in = next((record for record in check_ins if record.attendance_date not in closed_dates), None)
        if not checked_in:
            raise HTTPException(status_code=409, detail="No matching check-in is waiting for a daily report.")
        record_date = checked_in.attendance_date
        # Installation records a visit with the generated Daily Installation Report.
        # Measurement, readiness and validation each file their own report, uploaded by
        # the IP: it is a separate document from the job's checklist, and it is what
        # closes the job.
        report_slot = site_report_slot(job.type) if job is not None else None
        if report_slot and report_data:
            raise HTTPException(
                status_code=400,
                detail=f"The {document_label(report_slot)} is uploaded as a file, not filled in as the installation report form.",
            )
        if report_slot and not report_file:
            raise HTTPException(
                status_code=400,
                detail=f"Upload the {document_label(report_slot)} to check out of this job.",
            )
        if not report_slot and bool(report_data) == bool(report_file):
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

    if park_for_approval:
        request = park_sunday_attendance(
            db,
            business_date,
            {
                "job_id": job_id,
                "roster_entry_id": roster_entry_id,
                "phone": attendance_phone,
                "latitude": latitude,
                "longitude": longitude,
                "manual_location": manual_location,
                "photo_url": photo_url,
                "distance_meters": fence_distance,
                "within_geofence": fence_within,
            },
            ip_user_id=current_user.id,
            reason=sunday_reason,
        )
        db.commit()
        db.refresh(request)
        return JSONResponse(
            status_code=202,
            content={
                "status": "pending_approval",
                "message": "Approval request sent to superadmin. Your attendance will be recorded once it is approved.",
                "sunday_request_id": request.id,
            },
        )

    if attendance_type == "check_out" and report_document_url and job is not None:
        slot = site_report_slot(job.type)
        if slot:
            db.add(
                MediaDocument(
                    owner_type="job_completion",
                    owner_id=job.id,
                    status=slot,
                    doc_link=report_document_url,
                )
            )
            job.site_report_document_link = report_document_url

    record = DailyAttendance(
        job_id=job_id,
        roster_entry_id=roster_entry_id,
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

    response = {
        "message": "Check-in recorded successfully" if attendance_type == "check_in" else "Check-out and report submitted successfully",
        "attendance": _serialize(record, day_slot_end=span_end),
    }
    # The report is filed; the checklist is a separate deliverable. Say what is still
    # open rather than refusing the check-out over it.
    if attendance_type == "check_out" and job is not None:
        pending = checklist_items_pending(db, [job.id]).get(job.id, 0)
        if pending:
            response["warning"] = (
                f"{pending} checklist item{'s are' if pending > 1 else ' is'} still not approved "
                f"for this job. The report is filed, but the checklist has to be completed "
                f"before the job can be closed."
            )
    return response


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
        DailyAttendance.roster_entry_id,
        DailyAttendance.attendance_date,
        DailyAttendance.attendance_type,
        DailyAttendance.report_document_url,
    ).all()
    roster_slot_ends = day_end_by_entry(
        db, [record.roster_entry_id for record in attendance_rows]
    )
    checkouts = {
        (record.roster_entry_id, record.job_id, record.attendance_date): record
        for record in attendance_rows
        if record.attendance_type == "check_out" and record.report_document_url
    }
    current = now_ist()
    missing_reports = []
    for record in attendance_rows:
        key = (record.roster_entry_id, record.job_id, record.attendance_date)
        if record.attendance_type != "check_in" or key in checkouts:
            continue
        cutoff = roster_slot_ends.get(record.roster_entry_id, CHECK_OUT_CUTOFF)
        if record.roster_entry_id:
            cutoff = (datetime.combine(record.attendance_date, cutoff) + timedelta(minutes=30)).time()
        overdue = record.attendance_date < current.date() or current.time() > cutoff
        missing_reports.append({
            "job_id": record.job_id,
            "roster_entry_id": record.roster_entry_id,
            "attendance_date": record.attendance_date.isoformat(),
            "status": "overdue" if overdue else "missing",
        })

    page = base_query.order_by(DailyAttendance.recorded_at.desc()).offset(skip).limit(limit).all()
    page_day_ends = day_end_by_entry(db, [record.roster_entry_id for record in page])
    return {
        "message": "Attendance records fetched",
        "skip": skip,
        "limit": limit,
        "records": [
            _serialize(
                record,
                include_report_data=False,
                day_slot_end=page_day_ends.get(record.roster_entry_id),
            )
            for record in page
        ],
        "missing_reports": missing_reports,
    }
