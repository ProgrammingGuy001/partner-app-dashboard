from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from app.database import get_db
from app.model.ip import ip
from app.model.job import Job, JobChecklist, ChecklistItem, JobChecklistItemStatus
from app.schemas.job import JobResponse
from app.schemas.checklist import (
    ChecklistWithItemsAndStatusResponse,
    JobChecklistItemStatusUpdate,
    JobChecklistItemStatusResponse
)
from app.api.deps import get_verified_user
from app.services.s3_service import upload_file_to_s3
from app.crud.checklist import update_job_checklist_item_status

router = APIRouter(prefix="/dashboard/jobs", tags=["Dashboard"])


# ✅ Get all jobs (only if verified)
@router.get("", response_model=dict)
def get_all_jobs(
    current_user: ip = Depends(get_verified_user),
    db: Session = Depends(get_db)
):
    jobs = db.query(Job).filter(Job.assigned_ip_id == current_user.id).all()
    
    # Manually serialize using JobResponse if needed, or just rely on response_model
    # Since we want to return a wrapper object, we can't easily use response_model=List[JobResponse] directly for the whole thing
    # But FastAPI can handle it if we define a proper schema for the wrapper.
    # For now, let's just make sure we are not returning raw SQLAlchemy objects if possible.
    
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
    job = db.query(Job).filter(Job.id == job_id).first()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )

    return {
        "message": "Job retrieved successfully",
        "job": JobResponse.model_validate(job)
    }




@router.post("/{job_id}/upload")
async def upload_progress_update(
    job_id: int,
    file: UploadFile = File(...),
    current_user: ip = Depends(get_verified_user),
    db: Session = Depends(get_db)
):
    job = db.query(Job).filter(Job.id == job_id).first()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
        )

    # Read file content
    file_content = await file.read()
    file_url = upload_file_to_s3(
        file_content=file_content,
        filename=file.filename,
        content_type=file.content_type
    )

    # Save the uploaded file link to DB later (if you have a table)
    # job.progress_images.append(file_url) — later phase

    return {
        "message": "File uploaded successfully",
        "file_url": file_url
    }


# ✅ Complete job
@router.get("/{job_id}/completed", response_model=dict)
def complete_job(
    job_id: int,
    current_user: ip = Depends(get_verified_user),
    db: Session = Depends(get_db)
):
    job = db.query(Job).filter(Job.id == job_id).first()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found"
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
    
    items_with_status = []
    for item in items:
        # Get status for each item for this job
        item_status = db.query(JobChecklistItemStatus).filter(
            JobChecklistItemStatus.job_id == job_id,
            JobChecklistItemStatus.checklist_item_id == item.id
        ).first()
        
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
