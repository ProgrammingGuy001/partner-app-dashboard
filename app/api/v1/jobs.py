from typing import Annotated, List, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, Form, HTTPException, status, UploadFile, File, Path, Query, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, ValidationError
from app.config import settings
from app.database import get_db
from app.model.ip import ip
from app.model.job import ChecklistItem, JobChecklist
from app.schemas.job import (
    JobFinish,
    JobFinishWithOTP,
    JobResponse,
    JobStart,
    JobStartWithOTP,
    OTPResponse,
)
from app.schemas.checklist import (
    JobChecklistItemStatusUpdate,
    JobChecklistItemStatusResponse
)
from app.schemas.job_status_log import JobStatusLogResponse, JobStatusLogCreate
from app.api.deps import get_fully_verified_user
from app.services.customer_otp_service import CustomerOTPService
from app.services.s3_service import upload_file_to_s3
from app.services.upload_service import read_validated_upload
from app.services.billing_service import BillingService
from app.services.invoice_request_service import (
    create_invoice_request as create_invoice_request_record,
    get_invoice_requests,
    get_latest_invoice_request,
    serialize_invoice_request,
)
from app.crud.checklist import (
    get_assigned_job_checklist,
    get_job_checklists_status,
    update_job_checklist_item_status,
)
from app.services.checklist_export_service import checklist_export_pdf
from app.services.checklist_template_service import checklist_pdf_template
from app.crud.job import (
    finish_job,
    get_ip_job_by_id,
    start_job,
    validate_job_completion,
    validate_job_start,
    get_job_checklist_items_with_status,
    get_job_checklists_overview,
    get_job_status_history,
    get_jobs_for_ip,
)
from app.model.media_document import MediaDocument
from app.model.job_status_log import JobStatusLog
from app.model.attendance import DailyAttendance
from app.schemas.attendance import DailyAttendanceResponse, DailyInstallationReportData
# Same photo rules the attendance path applies, as approval.py already reuses.
from app.api.v1.attendance import ATTENDANCE_PHOTO_CONTENT_TYPES, ATTENDANCE_PHOTO_EXTENSIONS
from app.services.installation_report_service import (
    MAX_PHOTOS,
    MAX_PHOTO_UPLOAD_MB,
    generate_daily_installation_report,
)
from app.utils.attendance_policy import attendance_business_date
from app.utils.error_text import sanitize_validation_errors
from app.utils.job_documents import closure_documents, site_report_slot
from datetime import date, datetime

def _get_invoice_request(db: Session, job_id: int):
    return get_latest_invoice_request(db, job_id)


def _serialize_invoice_request(req) -> dict | None:
    return serialize_invoice_request(req)


class CreateInvoiceRequestRequest(BaseModel):
    completion_percentage: int | None = Field(default=None, ge=0, le=100)
    notes: str | None = Field(default=None, max_length=1000)


class ChecklistDocumentUpdate(BaseModel):
    document_link: str = Field(..., min_length=1, max_length=2048)


router = APIRouter(prefix="/dashboard/jobs", tags=["Dashboard"])


# ✅ Get all jobs (only if verified)
@router.get("", response_model=dict)
def get_all_jobs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db)
):
    """Get all jobs assigned to current user"""
    jobs = get_jobs_for_ip(db, current_user.id, skip=skip, limit=limit)
    serialized_jobs = [JobResponse.model_validate(j) for j in jobs]

    return {
        "message": "Jobs fetched successfully",
        "total": len(serialized_jobs),
        "skip": skip,
        "limit": limit,
        "jobs": serialized_jobs
    }


# ✅ Get single job by ID
@router.get("/{job_id}", response_model=dict)
def get_single_job(
    job_id: Annotated[int, Path(gt=0)],
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db)
):
    """Get a single job - only if assigned to current user"""
    job = get_ip_job_by_id(db, job_id, current_user.id)

    return {
        "message": "Job retrieved successfully",
        "job": JobResponse.model_validate(job)
    }


@router.get("/{job_id}/history", response_model=List[JobStatusLogResponse])
def get_job_history(
    job_id: Annotated[int, Path(gt=0)],
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db)
):
    """Get job status history for a specific job"""
    get_ip_job_by_id(db, job_id, current_user.id)
    return get_job_status_history(db, job_id, verify_exists=False)


# ============ Start (same rights as the job's supervisor) ============


@router.post("/{job_id}/request-start-otp", response_model=OTPResponse)
def request_start_otp(
    job_id: Annotated[int, Path(gt=0)],
    background_tasks: BackgroundTasks,
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db),
):
    """Send the customer the start OTP for a job this IP is on."""
    job = validate_job_start(db, job_id, ip_id=current_user.id)
    if not job.customer_phone:
        raise HTTPException(status_code=400, detail="Customer phone not set for this job")

    otp = CustomerOTPService.create_start_otp(db, job_id)
    background_tasks.add_task(
        CustomerOTPService.send_customer_sms,
        job.customer_phone,
        job.customer_name or "Customer",
        otp,
        "start",
    )
    return OTPResponse(success=True, message="OTP generated and SMS queued")


@router.post("/{job_id}/verify-start-otp", response_model=JobResponse)
def verify_start_otp_and_start(
    job_id: Annotated[int, Path(gt=0)],
    otp_data: JobStartWithOTP,
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db),
):
    """Verify the customer OTP and start the job."""
    job = get_ip_job_by_id(db, job_id, current_user.id)

    # Jobs with no customer phone never got an OTP; the legacy /start covers them.
    if job.customer_phone and not CustomerOTPService.verify_start_otp(db, job_id, otp_data.otp):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    return start_job(db, job_id, ip_id=current_user.id, notes=otp_data.notes)


@router.post("/{job_id}/start", response_model=JobResponse)
def start_assigned_job(
    job_id: Annotated[int, Path(gt=0)],
    job_start: JobStart = JobStart(),
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db),
):
    """Start or resume a job with no customer phone on file (no OTP possible)."""
    job = get_ip_job_by_id(db, job_id, current_user.id)
    if job.customer_phone:
        raise HTTPException(
            status_code=400,
            detail="This job requires OTP verification. Use /request-start-otp then /verify-start-otp",
        )
    return start_job(db, job_id, ip_id=current_user.id, notes=job_start.notes)


# ============ Finish (same rights as the job's supervisor) ============


@router.post("/{job_id}/request-end-otp", response_model=OTPResponse)
def request_end_otp(
    job_id: Annotated[int, Path(gt=0)],
    background_tasks: BackgroundTasks,
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db),
):
    """Send the customer the completion OTP for a job this IP is on."""
    job = get_ip_job_by_id(db, job_id, current_user.id)
    if not job.customer_phone:
        raise HTTPException(status_code=400, detail="Customer phone not set for this job")

    otp = CustomerOTPService.create_end_otp(db, job_id)
    background_tasks.add_task(
        CustomerOTPService.send_customer_sms,
        job.customer_phone,
        job.customer_name or "Customer",
        otp,
        "complete",
    )
    return OTPResponse(success=True, message="OTP generated and SMS queued")


@router.post("/{job_id}/verify-end-otp", response_model=JobResponse)
def verify_end_otp_and_finish(
    job_id: Annotated[int, Path(gt=0)],
    otp_data: JobFinishWithOTP,
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db),
):
    """Verify the customer OTP and complete the job."""
    job = get_ip_job_by_id(db, job_id, current_user.id)

    # Jobs with no customer phone never got an OTP; the legacy /finish covers them.
    if job.customer_phone:
        # Checked before the OTP is consumed, so a missing document does not burn it.
        validate_job_completion(
            db,
            job_id,
            ip_id=current_user.id,
            handover_document_link=otp_data.handover_document_link,
            ncr_document_link=otp_data.ncr_document_link,
            project_report_document_link=otp_data.project_report_document_link,
            site_report_document_link=otp_data.site_report_document_link,
        )
        if not CustomerOTPService.verify_end_otp(db, job_id, otp_data.otp):
            raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    return finish_job(
        db,
        job_id,
        ip_id=current_user.id,
        notes=otp_data.notes,
        handover_document_link=otp_data.handover_document_link,
        ncr_document_link=otp_data.ncr_document_link,
        project_report_document_link=otp_data.project_report_document_link,
        site_report_document_link=otp_data.site_report_document_link,
    )


@router.post("/{job_id}/finish", response_model=JobResponse)
def finish_assigned_job(
    job_id: Annotated[int, Path(gt=0)],
    job_finish: JobFinish = JobFinish(),
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db),
):
    """Finish a job with no customer phone on file (no OTP possible)."""
    job = get_ip_job_by_id(db, job_id, current_user.id)
    if job.customer_phone:
        raise HTTPException(
            status_code=400,
            detail="This job requires OTP verification. Use /request-end-otp then /verify-end-otp",
        )
    return finish_job(
        db,
        job_id,
        ip_id=current_user.id,
        notes=job_finish.notes,
        handover_document_link=job_finish.handover_document_link,
        ncr_document_link=job_finish.ncr_document_link,
        project_report_document_link=job_finish.project_report_document_link,
        site_report_document_link=job_finish.site_report_document_link,
    )


@router.post("/{job_id}/notes", response_model=dict)
def add_job_note(
    job_id: Annotated[int, Path(gt=0)],
    note_data: JobStatusLogCreate,
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db)
):
    """Add a note to job history - IP users can add notes to track progress"""
    job = get_ip_job_by_id(db, job_id, current_user.id)

    if not note_data.notes or not note_data.notes.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Note cannot be empty"
        )

    job_status_log = JobStatusLog(
        job_id=job_id,
        status=job.status,
        notes=note_data.notes.strip(),
        created_at=datetime.utcnow(),
        actor_type="ip",
        actor_id=current_user.id,
    )
    db.add(job_status_log)
    db.commit()
    db.refresh(job_status_log)

    return {
        "message": "Note added successfully",
        "note": JobStatusLogResponse.model_validate(job_status_log)
    }


@router.get("/{job_id}/attendance", response_model=dict)
def get_attendance(
    job_id: Annotated[int, Path(gt=0)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db)
):
    """Get daily attendance records for a job"""
    get_ip_job_by_id(db, job_id, current_user.id)
    records = (
        db.query(DailyAttendance)
        .filter(
            DailyAttendance.job_id == job_id,
            DailyAttendance.ip_user_id == current_user.id,
        )
        .order_by(DailyAttendance.recorded_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return {
        "message": "Attendance records fetched",
        "job_id": job_id,
        "skip": skip,
        "limit": limit,
        "records": [DailyAttendanceResponse.model_validate(r) for r in records]
    }


@router.get("/{job_id}/progress", response_model=dict)
def get_job_progress(
    job_id: Annotated[int, Path(gt=0)],
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db)
):
    """Get job progress uploads (placeholder - no progress table yet)"""
    get_ip_job_by_id(db, job_id, current_user.id)

    # TODO: Implement progress upload tracking table
    # For now, return empty uploads list
    return {
        "message": "Progress fetched successfully",
        "job_id": job_id,
        "uploads": []
    }




@router.post("/{job_id}/upload")
async def upload_progress_update(
    job_id: Annotated[int, Path(gt=0)],
    file: Annotated[UploadFile, File()],
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db)
):
    """Upload a file for job progress - with validation"""
    get_ip_job_by_id(db, job_id, current_user.id)
    upload = await read_validated_upload(file)

    file_url = upload_file_to_s3(
        file_content=upload.content,
        filename=upload.filename,
        content_type=upload.content_type,
    )

    db.add(
        MediaDocument(
            owner_type="job",
            owner_id=job_id,
            status="progress_upload",
            doc_link=file_url,
        )
    )
    db.commit()

    return {
        "message": "File uploaded successfully",
        "file_url": file_url
    }


@router.post("/{job_id}/completion-documents/{document_type}", response_model=dict)
async def upload_completion_document(
    job_id: Annotated[int, Path(gt=0)],
    document_type: str,
    file: Annotated[UploadFile, File()],
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db),
):
    """Upload or replace completion evidence for a job assigned to this IP."""
    job = get_ip_job_by_id(db, job_id, current_user.id)
    if document_type not in closure_documents(job.type):
        raise HTTPException(
            status_code=422,
            detail="This document is not required for this job type",
        )
    upload = await read_validated_upload(
        file,
        allowed_extensions=(
            [*settings.allowed_extensions_list, ".xlsx"]
            if document_type == "project_report"
            else None
        ),
    )
    file_url = upload_file_to_s3(
        file_content=upload.content,
        filename=upload.filename,
        content_type=upload.content_type,
    )
    document = (
        db.query(MediaDocument)
        .filter(
            MediaDocument.owner_type == "job_completion",
            MediaDocument.owner_id == job_id,
            MediaDocument.status == document_type,
        )
        .order_by(MediaDocument.uploaded_at.desc())
        .first()
    )
    if document:
        document.doc_link = file_url
        document.uploaded_at = datetime.utcnow()
    else:
        db.add(
            MediaDocument(
                owner_type="job_completion",
                owner_id=job_id,
                status=document_type,
                doc_link=file_url,
            )
        )
    column = (
        "site_report_document_link"
        if document_type == site_report_slot(job.type)
        else f"{document_type}_document_link"
    )
    setattr(job, column, file_url)
    db.commit()
    return {
        "message": "Completion document uploaded",
        "document_type": document_type,
        "document_link": file_url,
    }


# ✅ Get job checklists (Metadata only)
@router.get("/{job_id}/checklists", response_model=dict)
def get_job_checklists(
    job_id: Annotated[int, Path(gt=0)],
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db)
):
    """Get list of checklists assigned to a job (without items)"""
    get_ip_job_by_id(db, job_id, current_user.id)
    job_checklists = get_job_checklists_overview(db, job_id)

    result = []
    for jc in job_checklists:
        checklist = jc.checklist
        result.append({
            "id": checklist.id,
            "name": checklist.name,
            "description": checklist.description,
            "created_at": checklist.created_at,
            "updated_at": checklist.updated_at,
        })

    return {
        "message": "Checklists fetched successfully",
        "job_id": job_id,
        "checklists": result
    }


# ✅ Get items for a specific checklist in a job
@router.get("/{job_id}/checklists/{checklist_id}/items", response_model=dict)
def get_job_checklist_items(
    job_id: Annotated[int, Path(gt=0)],
    checklist_id: Annotated[int, Path(gt=0)],
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db)
):
    """Get items and status for a specific checklist within a job"""
    get_ip_job_by_id(db, job_id, current_user.id)
    checklist, items_with_status = get_job_checklist_items_with_status(db, job_id, checklist_id)

    job_checklist = db.query(JobChecklist).filter(
        JobChecklist.job_id == job_id,
        JobChecklist.checklist_id == checklist_id
    ).first()

    return {
        "message": "Checklist items fetched successfully",
        "job_id": job_id,
        "checklist": {
            "id": checklist.id,
            "name": checklist.name,
            "description": checklist.description,
            "document_link": job_checklist.document_link if job_checklist else None,
            "template_available": bool(
                job_checklist and checklist_pdf_template(checklist.name)
            ),
            "items": items_with_status
        }
    }


@router.get("/{job_id}/checklists/{checklist_id}/template")
def download_checklist_template(
    job_id: Annotated[int, Path(gt=0)],
    checklist_id: Annotated[int, Path(gt=0)],
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db),
):
    """Download this checklist's supplied printable PDF."""
    get_ip_job_by_id(db, job_id, current_user.id)
    job_checklist = get_assigned_job_checklist(db, job_id, checklist_id)
    template = checklist_pdf_template(job_checklist.checklist.name)
    if not template:
        raise HTTPException(status_code=404, detail="This checklist has no PDF template")
    return FileResponse(
        template,
        filename=template.name,
        media_type="application/pdf",
    )


@router.post("/{job_id}/daily-report")
async def generate_daily_report(
    job_id: Annotated[int | Literal["manual"], Path()],
    report_date: Annotated[date, Form()],
    report_data: Annotated[str, Form()],
    project_name: Annotated[str | None, Form(max_length=255)] = None,
    sales_order: Annotated[str | None, Form(max_length=100)] = None,
    project_supervisor: Annotated[str | None, Form(max_length=255)] = None,
    site_address: Annotated[str | None, Form(max_length=1000)] = None,
    progress_photos: Annotated[list[UploadFile] | None, File()] = None,
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db),
):
    """Build the Daily Installation Report on demand and hand it straight back.

    Separate from check-out: no attendance row is read or written and nothing is
    stored, so an IP can produce the document for any of their jobs and any date.
    Marking attendance still generates and files its own copy.
    """
    manual_project = None
    if job_id == "manual":
        name = (project_name or "").strip()
        if not name:
            raise HTTPException(status_code=422, detail="Project name is required for a manual job.")
        supervisor = (project_supervisor or "").strip() or (
            f"{current_user.first_name or ''} {current_user.last_name or ''}".strip()
            or current_user.phone_number
        )
        manual_project = {
            "projectName": name,
            "salesOrder": (sales_order or "").strip(),
            "projectSupervisor": supervisor,
            "siteAddress": (site_address or "").strip(),
        }
        job = None
    else:
        if job_id <= 0:
            raise HTTPException(status_code=422, detail="job_id must be greater than zero.")
        job = get_ip_job_by_id(db, job_id, current_user.id)
    if report_date > attendance_business_date():
        raise HTTPException(status_code=400, detail="report_date cannot be in the future.")

    try:
        details = DailyInstallationReportData.model_validate_json(report_data)
    except ValidationError as exc:
        # exc.errors() carries an "input" key holding the caller's raw values;
        # raising it as an HTTPException skips main.py's validation scrubber.
        raise HTTPException(
            status_code=422, detail=sanitize_validation_errors(exc.errors())
        ) from exc

    # Progress photos become pages 2+ of the report, one page each, so the count
    # is capped before any of them is decoded.
    supplied = [item for item in (progress_photos or []) if item and item.filename]
    if len(supplied) > MAX_PHOTOS:
        raise HTTPException(status_code=400, detail=f"Attach at most {MAX_PHOTOS} progress photos.")
    photos = []
    for item in supplied:
        validated = await read_validated_upload(
            item,
            allowed_extensions=ATTENDANCE_PHOTO_EXTENSIONS,
            allowed_content_types=ATTENDANCE_PHOTO_CONTENT_TYPES,
            max_size_mb=MAX_PHOTO_UPLOAD_MB,
        )
        photos.append({"bytes": validated.content, "filename": validated.filename})

    document = await generate_daily_installation_report(
        job,
        report_date,
        details,
        photos=photos,
        project=manual_project,
    )
    return Response(
        content=document.content,
        media_type=document.content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{document.filename}"',
            "Content-Encoding": "identity",
        },
    )


@router.get("/{job_id}/checklists/{checklist_id}/export")
def export_checklist(
    job_id: Annotated[int, Path(gt=0)],
    checklist_id: Annotated[int, Path(gt=0)],
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db),
):
    """Export the supplied official PDF, falling back to the generated checklist."""
    job = get_ip_job_by_id(db, job_id, current_user.id)
    job_checklist = get_assigned_job_checklist(db, job_id, checklist_id)
    template = checklist_pdf_template(job_checklist.checklist.name)
    if template:
        return FileResponse(
            template,
            filename=template.name,
            media_type="application/pdf",
        )
    checklists = get_job_checklists_status(db, job_id, checklist_id=checklist_id)
    document = checklist_export_pdf(job, checklists[0])
    return Response(
        content=document.content,
        media_type=document.content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{document.filename}"',
            "Content-Encoding": "identity",
        },
    )


@router.post("/{job_id}/checklists/{checklist_id}/document", response_model=dict)
async def upload_checklist_document(
    job_id: Annotated[int, Path(gt=0)],
    checklist_id: Annotated[int, Path(gt=0)],
    file: Annotated[UploadFile, File()],
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db),
):
    """Upload a completed checklist document and attach it to the job checklist."""
    get_ip_job_by_id(db, job_id, current_user.id)
    job_checklist = get_assigned_job_checklist(db, job_id, checklist_id)
    upload = await read_validated_upload(
        file, allowed_extensions=[".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"]
    )
    file_url = upload_file_to_s3(
        file_content=upload.content,
        filename=upload.filename,
        content_type=upload.content_type,
    )
    job_checklist.document_link = file_url
    db.add(
        MediaDocument(
            owner_type="job_checklist",
            owner_id=job_checklist.id,
            status="uploaded",
            doc_link=file_url,
        )
    )
    db.commit()
    return {"message": "Checklist document uploaded", "document_link": file_url}


# ✅ Save checklist-level document link
@router.put("/{job_id}/checklists/{checklist_id}/document", response_model=dict)
def update_checklist_document(
    job_id: Annotated[int, Path(gt=0)],
    checklist_id: Annotated[int, Path(gt=0)],
    body: ChecklistDocumentUpdate,
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db)
):
    """Store a document URL against the job's checklist record"""
    get_ip_job_by_id(db, job_id, current_user.id)

    job_checklist = get_assigned_job_checklist(db, job_id, checklist_id)

    job_checklist.document_link = body.document_link
    db.commit()

    return {"message": "Checklist document updated", "document_link": body.document_link}


# ✅ Update checklist item status (for IP user)
@router.put("/{job_id}/checklists/items/{item_id}/status", response_model=dict)
def update_checklist_item_status(
    job_id: Annotated[int, Path(gt=0)],
    item_id: Annotated[int, Path(gt=0)],
    status_update: JobChecklistItemStatusUpdate,
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db)
):
    """Update checklist item status - IP users can mark as checked and add comments"""
    get_ip_job_by_id(db, job_id, current_user.id)

    # Verify checklist item exists
    item = db.get(ChecklistItem, item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Checklist item not found"
        )

    # IP users can only update checked, comment, and document_link
    # They cannot approve (is_approved) or add admin_comment
    update_data = status_update.model_dump(
        include={'checked', 'comment', 'document_link'},
        exclude_unset=True
    )
    if update_data.get('checked') is True:
        update_data.update(review_status='pending', is_approved=False)

    filtered_update = JobChecklistItemStatusUpdate(**update_data)

    updated_status = update_job_checklist_item_status(db, job_id, item_id, filtered_update)

    return {
        "message": "Checklist item status updated successfully",
        "status": JobChecklistItemStatusResponse.model_validate(updated_status)
    }


@router.get("/{job_id}/billing", response_model=dict)
def get_billing(
    job_id: Annotated[int, Path(gt=0)],
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db),
):
    """Get billing / invoice-request status for a job (external IPs only)."""
    get_ip_job_by_id(db, job_id, current_user.id, allow_roster=False)
    if current_user.is_internal:
        raise HTTPException(status_code=403, detail="Billing is only available for external IPs")
    invoice_req = _get_invoice_request(db, job_id)
    return {
        "job_id": job_id,
        "invoice_request": _serialize_invoice_request(invoice_req),
        "invoice_requests": [
            _serialize_invoice_request(req)
            for req in get_invoice_requests(db, job_id)
        ],
    }


@router.post("/{job_id}/invoice-request", response_model=dict)
def create_invoice_request(
    job_id: Annotated[int, Path(gt=0)],
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db),
):
    """Create an invoice request (external IPs only). Blocks if one is already pending."""
    get_ip_job_by_id(db, job_id, current_user.id, allow_roster=False)
    if current_user.is_internal:
        raise HTTPException(status_code=403, detail="Billing is only available for external IPs")
    req = create_invoice_request_record(db, job_id=job_id, requested_by_ip_id=current_user.id)
    return {
        "message": "Invoice request submitted successfully",
        "invoice_request": _serialize_invoice_request(req),
    }


@router.post("/{job_id}/invoice-requests", response_model=dict)
def create_additional_invoice_request(
    job_id: Annotated[int, Path(gt=0)],
    body: CreateInvoiceRequestRequest,
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db),
):
    """Create another invoice request for completion-based or phase-based billing."""
    get_ip_job_by_id(db, job_id, current_user.id, allow_roster=False)
    if current_user.is_internal:
        raise HTTPException(status_code=403, detail="Billing is only available for external IPs")

    req = create_invoice_request_record(
        db,
        job_id=job_id,
        requested_by_ip_id=current_user.id,
        completion_percentage=body.completion_percentage,
        notes=body.notes,
    )
    return {
        "message": "Additional invoice request submitted successfully",
        "invoice_request": _serialize_invoice_request(req),
    }


@router.get("/{job_id}/invoice-request/download")
def download_invoice_bill(
    job_id: Annotated[int, Path(gt=0)],
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db),
):
    """Download approved invoice bill using the project billing template."""
    xlsx_bytes = BillingService.generate_invoice_xlsx(
        db,
        job_id,
        ip_user_id=current_user.id,
    )
    filename = f"billing_invoice_{job_id}.xlsx"
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Encoding": "identity",
        },
    )


@router.get("/{job_id}/invoice-requests/{invoice_request_id}/download")
def download_invoice_request_bill(
    job_id: Annotated[int, Path(gt=0)],
    invoice_request_id: Annotated[int, Path(gt=0)],
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db),
):
    xlsx_bytes = BillingService.generate_invoice_xlsx(
        db,
        job_id,
        ip_user_id=current_user.id,
        invoice_request_id=invoice_request_id,
    )
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="billing_invoice_{invoice_request_id}.xlsx"',
            "Content-Encoding": "identity",
        },
    )
