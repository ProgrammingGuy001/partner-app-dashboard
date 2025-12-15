from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.schemas.job import JobStart,JobPause,JobFinish, JobCreate, JobUpdate, JobResponse
from app.schemas.job_status_log import JobStatusLogResponse
from app.crud.job import (
    get_job_by_id, get_all_jobs, create_job, update_job, delete_job,
    start_job, pause_job, finish_job, get_job_status_history
)
from app.core.security import get_current_user

router = APIRouter(prefix="/jobs", tags=["Jobs"])

@router.post("/", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
def create_new_job(job: JobCreate, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    """Create a new job. Validates that assigned IP has is_assigned=False before assignment."""
    return create_job(db, job)

@router.get("/", response_model=List[JobResponse])
def read_jobs(skip: int = 0, limit: int = 100, status: str = None, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    """Get all jobs with pagination. Optional filter by status."""
    return get_all_jobs(db, skip=skip, limit=limit, status=status)

@router.get("/{job_id}", response_model=JobResponse)
def read_job(job_id: int, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    """Get a specific job by ID."""
    return get_job_by_id(db, job_id)

@router.put("/{job_id}", response_model=JobResponse)
def update_existing_job(job_id: int, job_update: JobUpdate, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    """Update a job. Handles IP reassignment and validates is_assigned=False for new IPs."""
    return update_job(db, job_id, job_update)

@router.delete("/{job_id}", status_code=status.HTTP_200_OK)
def delete_existing_job(job_id: int, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    """Delete a job and unassign its IP."""
    return delete_job(db, job_id)

@router.post("/{job_id}/start", response_model=JobResponse)
def start_existing_job(job_id: int, job_start: JobStart = JobStart(), db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    """Start or resume a job. Changes status to 'in_progress' and tracks job_start_date. Logs the action."""
    return start_job(db, job_id, notes=job_start.notes)

@router.post("/{job_id}/pause", response_model=JobResponse)
def pause_existing_job(job_id: int, job_pause: JobPause = JobPause(), db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    """Pause a job. Changes status to 'paused' and tracks paused_date. Logs the action with optional notes."""
    return pause_job(db, job_id, notes=job_pause.notes)

@router.post("/{job_id}/finish", response_model=JobResponse)
def finish_existing_job(job_id: int, job_finish: JobFinish = JobFinish(), db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    """Finish a job. Changes status to 'completed' and tracks actual_delivery_date. Logs the action."""
    return finish_job(db, job_id, notes=job_finish.notes)

@router.get("/{job_id}/history", response_model=List[JobStatusLogResponse])
def get_job_history(job_id: int, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    """Get complete status change history for a job, including all pauses and resumes."""
    return get_job_status_history(db, job_id)