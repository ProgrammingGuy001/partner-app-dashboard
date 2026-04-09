from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from app.database import get_db
from app.model.ip import ip
from app.model.job import ChecklistItem
from app.schemas.job import JobResponse
from app.schemas.checklist import (
    JobChecklistItemStatusUpdate,
    JobChecklistItemStatusResponse
)
from app.schemas.job_status_log import JobStatusLogResponse, JobStatusLogCreate
from app.api.deps import get_fully_verified_user
from app.services.s3_service import upload_file_to_s3
from app.services.upload_service import read_validated_upload
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
from datetime import datetime

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

    return {
        "message": "Checklist items fetched successfully",
        "job_id": job_id,
        "checklist": {
            "id": checklist.id,
            "name": checklist.name,
            "description": checklist.description,
            "items": items_with_status
        }
    }


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
