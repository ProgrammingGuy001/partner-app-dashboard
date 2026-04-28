from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Response
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from app.database import get_db
from app.model.ip import ip
from app.model.job import ChecklistItem, JobChecklist
from app.schemas.job import JobResponse
from app.schemas.checklist import (
    JobChecklistItemStatusUpdate,
    JobChecklistItemStatusResponse
)
from app.schemas.job_status_log import JobStatusLogResponse, JobStatusLogCreate
from app.api.deps import get_fully_verified_user
from app.services.s3_service import upload_file_to_s3
from app.services.upload_service import read_validated_upload
from app.services.billing_service import BillingService
from app.utils.attendance_policy import ensure_attendance_window_open
from app.services.invoice_request_service import (
    create_invoice_request as create_invoice_request_record,
    get_invoice_requests,
    get_latest_invoice_request,
    serialize_invoice_request,
)
from app.crud.checklist import update_job_checklist_item_status
from app.crud.job import (
    get_ip_job_by_id,
    get_job_checklist_items_with_status,
    get_job_checklists_overview,
    get_job_status_history,
    get_jobs_for_ip,
)
from typing import List
from app.model.media_document import MediaDocument
from app.model.job_status_log import JobStatusLog
from app.model.attendance import DailyAttendance
from app.schemas.attendance import DailyAttendanceResponse
from datetime import datetime


def _get_invoice_request(db: Session, job_id: int):
    return get_latest_invoice_request(db, job_id)


def _serialize_invoice_request(req) -> dict | None:
    return serialize_invoice_request(req)


class CreateInvoiceRequestRequest(BaseModel):
    completion_percentage: int | None = Field(default=None, ge=0, le=100)
    notes: str | None = None

router = APIRouter(prefix="/dashboard/jobs", tags=["Dashboard"])


# ✅ Get all jobs (only if verified)
@router.get("", response_model=dict)
def get_all_jobs(
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db)
):
    """Get all jobs assigned to current user"""
    jobs = get_jobs_for_ip(db, current_user.id)
    serialized_jobs = [JobResponse.model_validate(j) for j in jobs]

    return {
        "message": "Jobs fetched successfully",
        "total": len(serialized_jobs),
        "jobs": serialized_jobs
    }


# ✅ Get single job by ID
@router.get("/{job_id}", response_model=dict)
def get_single_job(
    job_id: int,
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
    job_id: int,
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db)
):
    """Get job status history for a specific job"""
    get_ip_job_by_id(db, job_id, current_user.id)
    return get_job_status_history(db, job_id, verify_exists=False)


@router.post("/{job_id}/notes", response_model=dict)
def add_job_note(
    job_id: int,
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
        created_at=datetime.utcnow()
    )
    db.add(job_status_log)
    db.commit()
    db.refresh(job_status_log)

    return {
        "message": "Note added successfully",
        "note": JobStatusLogResponse.model_validate(job_status_log)
    }


@router.post("/{job_id}/attendance", response_model=dict)
async def record_attendance(
    job_id: int,
    phone: str | None = Form(None),
    latitude: float = Form(...),
    longitude: float = Form(...),
    manual_location: str | None = Form(None),
    photo: UploadFile = File(...),
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db)
):
    """Record daily attendance with authenticated IP identity, GPS location, and mandatory photo"""
    ensure_attendance_window_open()

    get_ip_job_by_id(db, job_id, current_user.id)

    upload = await read_validated_upload(photo)
    photo_url = upload_file_to_s3(
        file_content=upload.content,
        filename=upload.filename,
        content_type=upload.content_type,
    )

    record = DailyAttendance(
        job_id=job_id,
        phone=(phone or current_user.phone_number).strip(),
        latitude=latitude,
        longitude=longitude,
        manual_location=manual_location.strip() if manual_location else None,
        photo_url=photo_url,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {
        "message": "Attendance recorded successfully",
        "attendance": DailyAttendanceResponse.model_validate(record)
    }


@router.get("/{job_id}/attendance", response_model=dict)
def get_attendance(
    job_id: int,
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db)
):
    """Get daily attendance records for a job"""
    get_ip_job_by_id(db, job_id, current_user.id)
    records = (
        db.query(DailyAttendance)
        .filter(DailyAttendance.job_id == job_id)
        .order_by(DailyAttendance.recorded_at.desc())
        .all()
    )
    return {
        "message": "Attendance records fetched",
        "job_id": job_id,
        "records": [DailyAttendanceResponse.model_validate(r) for r in records]
    }


@router.get("/{job_id}/progress", response_model=dict)
def get_job_progress(
    job_id: int,
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
    job_id: int,
    file: UploadFile = File(...),
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


def _complete_ip_job(job_id: int, current_user: ip, db: Session):
    job = get_ip_job_by_id(db, job_id, current_user.id)
    job.status = "completed"
    db.commit()
    db.refresh(job)

    return {
        "message": "Job marked as completed",
        "job": JobResponse.model_validate(job)
    }


@router.post("/{job_id}/complete", response_model=dict)
def complete_job(
    job_id: int,
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db)
):
    """Mark a job as completed - only if assigned to current user."""
    return _complete_ip_job(job_id, current_user, db)


@router.get("/{job_id}/completed", response_model=dict, deprecated=True)
def complete_job_legacy(
    job_id: int,
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db)
):
    """Backward-compatible alias for older clients. Prefer POST /complete."""
    return _complete_ip_job(job_id, current_user, db)


# ✅ Get job checklists (Metadata only)
@router.get("/{job_id}/checklists", response_model=dict)
def get_job_checklists(
    job_id: int,
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
    job_id: int,
    checklist_id: int,
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
            "items": items_with_status
        }
    }


# ✅ Save checklist-level document link
@router.put("/{job_id}/checklists/{checklist_id}/document", response_model=dict)
def update_checklist_document(
    job_id: int,
    checklist_id: int,
    body: dict,
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db)
):
    """Store a document URL against the job's checklist record"""
    get_ip_job_by_id(db, job_id, current_user.id)

    document_link = body.get("document_link")
    if not document_link:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="document_link is required")

    job_checklist = db.query(JobChecklist).filter(
        JobChecklist.job_id == job_id,
        JobChecklist.checklist_id == checklist_id
    ).first()

    if not job_checklist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Checklist not found for this job")

    job_checklist.document_link = document_link
    db.commit()

    return {"message": "Checklist document updated", "document_link": document_link}


# ✅ Update checklist item status (for IP user)
@router.put("/{job_id}/checklists/items/{item_id}/status", response_model=dict)
def update_checklist_item_status(
    job_id: int,
    item_id: int,
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

    filtered_update = JobChecklistItemStatusUpdate(**update_data)

    updated_status = update_job_checklist_item_status(db, job_id, item_id, filtered_update)

    return {
        "message": "Checklist item status updated successfully",
        "status": JobChecklistItemStatusResponse.model_validate(updated_status)
    }


@router.get("/{job_id}/billing", response_model=dict)
def get_billing(
    job_id: int,
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db),
):
    """Get billing / invoice-request status for a job (external IPs only)."""
    job = get_ip_job_by_id(db, job_id, current_user.id)
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
    job_id: int,
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db),
):
    """Create an invoice request (external IPs only). Blocks if one is already pending."""
    get_ip_job_by_id(db, job_id, current_user.id)
    if current_user.is_internal:
        raise HTTPException(status_code=403, detail="Billing is only available for external IPs")
    req = create_invoice_request_record(db, job_id=job_id)
    return {
        "message": "Invoice request submitted successfully",
        "invoice_request": _serialize_invoice_request(req),
    }


@router.post("/{job_id}/invoice-requests", response_model=dict)
def create_additional_invoice_request(
    job_id: int,
    body: CreateInvoiceRequestRequest,
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db),
):
    """Create another invoice request for completion-based or phase-based billing."""
    get_ip_job_by_id(db, job_id, current_user.id)
    if current_user.is_internal:
        raise HTTPException(status_code=403, detail="Billing is only available for external IPs")

    req = create_invoice_request_record(
        db,
        job_id=job_id,
        completion_percentage=body.completion_percentage,
        notes=body.notes,
    )
    return {
        "message": "Additional invoice request submitted successfully",
        "invoice_request": _serialize_invoice_request(req),
    }


@router.get("/{job_id}/invoice-request/download")
def download_invoice_bill(
    job_id: int,
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
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
