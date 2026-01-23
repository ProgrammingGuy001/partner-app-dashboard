import logging
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.model.ip import ip
from app.model.job import Job, JobChecklist, ChecklistItem, JobChecklistItemStatus
from app.schemas.job import JobResponse
from app.schemas.checklist import (
    ChecklistWithItemsAndStatusResponse,
    JobChecklistItemStatusUpdate,
    JobChecklistItemStatusResponse
)
from app.schemas.job_status_log import JobStatusLogResponse
from app.api.deps import get_verified_user
from app.services.s3_service import upload_file_to_s3
from app.crud.checklist import update_job_checklist_item_status
from app.crud.job import get_job_status_history
from typing import List

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dashboard/jobs", tags=["Dashboard"])


# ✅ Get all jobs (only if verified)
@router.get("", response_model=dict)
def get_all_jobs(
    current_user: ip = Depends(get_verified_user),
    db: Session = Depends(get_db)
):
    """Get all jobs assigned to current user"""
    jobs = db.query(Job).filter(Job.assigned_ip_id == current_user.id).all()
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
    current_user: ip = Depends(get_verified_user),
    db: Session = Depends(get_db)
):
    """Get a single job - only if assigned to current user"""
    job = db.query(Job).filter(
        Job.id == job_id,
        Job.assigned_ip_id == current_user.id
    ).first()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found or not assigned to you"
        )

    return {
        "message": "Job retrieved successfully",
        "job": JobResponse.model_validate(job)
    }


@router.get("/{job_id}/history", response_model=List[JobStatusLogResponse])
def get_job_history(
    job_id: int,
    current_user: ip = Depends(get_verified_user),
    db: Session = Depends(get_db)
):
    """Get job status history for a specific job"""
    job = db.query(Job).filter(Job.id == job_id, Job.assigned_ip_id == current_user.id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found or not assigned to you"
        )
    
    return get_job_status_history(db, job_id)


@router.get("/{job_id}/progress", response_model=dict)
def get_job_progress(
    job_id: int,
    current_user: ip = Depends(get_verified_user),
    db: Session = Depends(get_db)
):
    """Get job progress uploads (placeholder - no progress table yet)"""
    job = db.query(Job).filter(Job.id == job_id, Job.assigned_ip_id == current_user.id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found or not assigned to you"
        )
    
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
    current_user: ip = Depends(get_verified_user),
    db: Session = Depends(get_db)
):
    """Upload a file for job progress - with validation"""
    # Authorization: verify job belongs to current user
    job = db.query(Job).filter(
        Job.id == job_id,
        Job.assigned_ip_id == current_user.id
    ).first()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found or not assigned to you"
        )
    
    # Validate file extension
    file_ext = Path(file.filename).suffix.lower() if file.filename else ""
    if file_ext not in settings.allowed_extensions_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: {', '.join(settings.allowed_extensions_list)}"
        )
    
    # Read file content and validate size
    file_content = await file.read()
    max_size_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(file_content) > max_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size: {settings.MAX_UPLOAD_SIZE_MB}MB"
        )
    
    file_url = upload_file_to_s3(
        file_content=file_content,
        filename=file.filename,
        content_type=file.content_type
    )

    return {
        "message": "File uploaded successfully",
        "file_url": file_url
    }


@router.get("/{job_id}/completed", response_model=dict)
def complete_job(
    job_id: int,
    current_user: ip = Depends(get_verified_user),
    db: Session = Depends(get_db)
):
    """Mark a job as completed - only if assigned to current user"""
    job = db.query(Job).filter(
        Job.id == job_id,
        Job.assigned_ip_id == current_user.id
    ).first()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found or not assigned to you"
        )

    job.status = "completed"
    db.commit()
    db.refresh(job)

    return {
        "message": "Job marked as completed",
        "job": JobResponse.model_validate(job)
    }


# ✅ Get job checklists (Metadata only)
@router.get("/{job_id}/checklists", response_model=dict)
def get_job_checklists(
    job_id: int,
    current_user: ip = Depends(get_verified_user),
    db: Session = Depends(get_db)
):
    """Get list of checklists assigned to a job (without items)"""
    # Verify job exists and belongs to current user
    job = db.query(Job).filter(
        Job.id == job_id,
        Job.assigned_ip_id == current_user.id
    ).first()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found or not assigned to you"
        )

    # Get all checklists assigned to the job
    job_checklists = db.query(JobChecklist).filter(JobChecklist.job_id == job_id).all()
    
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
    current_user: ip = Depends(get_verified_user),
    db: Session = Depends(get_db)
):
    """Get items and status for a specific checklist within a job"""
    # Verify job exists and belongs to current user
    job = db.query(Job).filter(
        Job.id == job_id,
        Job.assigned_ip_id == current_user.id
    ).first()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found or not assigned to you"
        )

    # Verify checklist is actually assigned to this job
    job_checklist_link = db.query(JobChecklist).filter(
        JobChecklist.job_id == job_id,
        JobChecklist.checklist_id == checklist_id
    ).first()

    if not job_checklist_link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Checklist not assigned to this job"
        )

    # Get checklist details
    checklist = job_checklist_link.checklist

    # Get all items for the checklist
    items = db.query(ChecklistItem).filter(
        ChecklistItem.checklist_id == checklist_id
    ).order_by(ChecklistItem.position).all()
    
    # Fetch all item statuses for this job in a single query (N+1 fix)
    item_ids = [item.id for item in items]
    all_statuses = db.query(JobChecklistItemStatus).filter(
        JobChecklistItemStatus.job_id == job_id,
        JobChecklistItemStatus.checklist_item_id.in_(item_ids)
    ).all()
    
    # Create a lookup dictionary for O(1) status access
    status_map = {s.checklist_item_id: s for s in all_statuses}
    
    items_with_status = []
    for item in items:
        # Get status from lookup instead of querying DB
        item_status = status_map.get(item.id)
        
        items_with_status.append({
            "id": item.id,
            "checklist_id": item.checklist_id,
            "text": item.text,
            "position": item.position,
            "created_at": item.created_at,
            "updated_at": item.updated_at,
            "status": {
                "id": item_status.id if item_status else None,
                "job_id": item_status.job_id if item_status else job_id,
                "checklist_item_id": item_status.checklist_item_id if item_status else item.id,
                "checked": item_status.checked if item_status else False,
                "is_approved": item_status.is_approved if item_status else False,
                "comment": item_status.comment if item_status else None,
                "admin_comment": item_status.admin_comment if item_status else None,
                "document_link": item_status.document_link if item_status else None,
                "created_at": item_status.created_at if item_status else None,
                "updated_at": item_status.updated_at if item_status else None,
            } if item_status or True else None
        })

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
    current_user: ip = Depends(get_verified_user),
    db: Session = Depends(get_db)
):
    """Update checklist item status - IP users can mark as checked and add comments"""
    # Verify job exists and belongs to current user
    job = db.query(Job).filter(
        Job.id == job_id,
        Job.assigned_ip_id == current_user.id
    ).first()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found or not assigned to you"
        )

    # Verify checklist item exists
    item = db.query(ChecklistItem).filter(ChecklistItem.id == item_id).first()
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
