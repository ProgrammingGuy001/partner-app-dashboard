from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from pathlib import Path
from app.database import get_db
from app.schemas.job import (
    JobStart, JobPause, JobFinish, JobCreate, JobUpdate, JobResponse,
    JobStartWithOTP, JobFinishWithOTP, OTPResponse
)
from app.schemas.job_status_log import JobStatusLogResponse
from app.schemas.checklist import JobChecklistItemStatusUpdate, JobChecklistItemStatusResponse
from app.crud.job import (
    get_job_by_id, get_all_jobs, create_job, update_job, delete_job,
    start_job, pause_job, finish_job, get_job_status_history
)
from app.crud.checklist import update_job_checklist_item_status
from app.core.security import get_current_user
from app.services.polling_service import trigger_polling_on_crud
from app.services.customer_otp_service import CustomerOTPService
from app.services.s3_service import upload_file_to_s3
from app.config import settings
import app.model as models

router = APIRouter(prefix="/jobs", tags=["Jobs"])

@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
def create_new_job(job: JobCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Create a new job. Validates that assigned IP has is_assigned=False before assignment."""
    is_superadmin = getattr(current_user, 'is_superadmin', False)
    result = create_job(db, job, user_id=current_user.id, is_superadmin=is_superadmin)
    background_tasks.add_task(trigger_polling_on_crud)
    return result

@router.get("", response_model=List[JobResponse])
def read_jobs(skip: int = 0, limit: int = 100, status: str = None, type: str = None, search: str = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Get all jobs with pagination. Superadmins see all jobs, regular admins see only their jobs."""
    # Superadmin can see all jobs, regular admin only sees their own jobs
    # Use getattr with fallback for backwards compatibility until migration is run
    is_superadmin = getattr(current_user, 'is_superadmin', False)
    user_id = None if is_superadmin else current_user.id
    return get_all_jobs(db, skip=skip, limit=limit, status=status, type=type, search=search, user_id=user_id)

@router.get("/{job_id}", response_model=JobResponse)
def read_job(job_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Get a specific job by ID."""
    return get_job_by_id(db, job_id)

@router.put("/{job_id}", response_model=JobResponse)
def update_existing_job(job_id: int, job_update: JobUpdate, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Update a job. Handles IP reassignment and validates is_assigned=False for new IPs."""
    get_job_by_id(db, job_id)
    is_superadmin = getattr(current_user, 'is_superadmin', False)
    result = update_job(db, job_id, job_update, admin_id=current_user.id, is_superadmin=is_superadmin)
    background_tasks.add_task(trigger_polling_on_crud)
    return result

@router.delete("/{job_id}", status_code=status.HTTP_200_OK)
def delete_existing_job(job_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Delete a job and unassign its IP."""
    get_job_by_id(db, job_id)
    is_superadmin = getattr(current_user, 'is_superadmin', False)
    result = delete_job(db, job_id, admin_id=current_user.id, is_superadmin=is_superadmin)
    background_tasks.add_task(trigger_polling_on_crud)
    return result

# ============ OTP Flow Endpoints ============

@router.post("/{job_id}/request-start-otp", response_model=OTPResponse)
def request_start_otp(job_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Send OTP to customer phone for job start verification"""
    job = get_job_by_id(db, job_id)
    if not job.customer_phone:
        raise HTTPException(status_code=400, detail="Customer phone not set for this job")
    
    result = CustomerOTPService.send_start_otp(db, job_id, job.customer_phone, job.customer_name)
    return OTPResponse(success=result["success"], message=result["message"])

@router.post("/{job_id}/verify-start-otp", response_model=JobResponse)
def verify_start_otp_and_start(job_id: int, otp_data: JobStartWithOTP, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Verify start OTP and start the job"""
    job = get_job_by_id(db, job_id)
    
    # Skip OTP verification if no customer phone set (backward compatibility)
    if job.customer_phone:
        if not CustomerOTPService.verify_start_otp(db, job_id, otp_data.otp):
            raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    
    is_superadmin = getattr(current_user, 'is_superadmin', False)
    return start_job(db, job_id, admin_id=current_user.id, is_superadmin=is_superadmin, notes=otp_data.notes)

@router.post("/{job_id}/request-end-otp", response_model=OTPResponse)
def request_end_otp(job_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Send OTP to customer phone for job completion verification"""
    job = get_job_by_id(db, job_id)
    if not job.customer_phone:
        raise HTTPException(status_code=400, detail="Customer phone not set for this job")
    
    result = CustomerOTPService.send_end_otp(db, job_id, job.customer_phone, job.customer_name)
    return OTPResponse(success=result["success"], message=result["message"])

@router.post("/{job_id}/verify-end-otp", response_model=JobResponse)
def verify_end_otp_and_finish(job_id: int, otp_data: JobFinishWithOTP, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Verify end OTP and complete the job"""
    job = get_job_by_id(db, job_id)
    
    # Skip OTP verification if no customer phone set (backward compatibility)
    if job.customer_phone:
        if not CustomerOTPService.verify_end_otp(db, job_id, otp_data.otp):
            raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    
    is_superadmin = getattr(current_user, 'is_superadmin', False)
    return finish_job(db, job_id, admin_id=current_user.id, is_superadmin=is_superadmin, notes=otp_data.notes)

# ============ Legacy Endpoints (without OTP) ============

@router.post("/{job_id}/start", response_model=JobResponse)
def start_existing_job(job_id: int, job_start: JobStart = JobStart(), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Start or resume a job (legacy - no OTP). Use verify-start-otp for OTP flow."""
    job = get_job_by_id(db, job_id)
    # If customer phone is set, require OTP flow
    if job.customer_phone:
        raise HTTPException(
            status_code=400, 
            detail="This job requires OTP verification. Use /request-start-otp then /verify-start-otp"
        )
    is_superadmin = getattr(current_user, 'is_superadmin', False)
    return start_job(db, job_id, admin_id=current_user.id, is_superadmin=is_superadmin, notes=job_start.notes)

@router.post("/{job_id}/pause", response_model=JobResponse)
def pause_existing_job(job_id: int, job_pause: JobPause = JobPause(), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Pause a job. Changes status to 'paused' and tracks paused_date. Logs the action with optional notes."""
    get_job_by_id(db, job_id)
    is_superadmin = getattr(current_user, 'is_superadmin', False)
    return pause_job(db, job_id, admin_id=current_user.id, is_superadmin=is_superadmin, notes=job_pause.notes)

@router.post("/{job_id}/finish", response_model=JobResponse)
def finish_existing_job(job_id: int, job_finish: JobFinish = JobFinish(), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Finish a job (legacy - no OTP). Use verify-end-otp for OTP flow."""
    job = get_job_by_id(db, job_id)
    # If customer phone is set, require OTP flow
    if job.customer_phone:
        raise HTTPException(
            status_code=400, 
            detail="This job requires OTP verification. Use /request-end-otp then /verify-end-otp"
        )
    is_superadmin = getattr(current_user, 'is_superadmin', False)
    return finish_job(db, job_id, admin_id=current_user.id, is_superadmin=is_superadmin, notes=job_finish.notes)

@router.get("/{job_id}/history", response_model=List[JobStatusLogResponse])
def get_job_history(job_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Get complete status change history for a job, including all pauses and resumes."""
    get_job_by_id(db, job_id)
    return get_job_status_history(db, job_id)

@router.put("/{job_id}/checklists/items/{item_id}/approve", response_model=JobChecklistItemStatusResponse)
def approve_checklist_item(
    job_id: int,
    item_id: int,
    status_update: JobChecklistItemStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Admin endpoint to approve/reject checklist items and add admin comments"""
    # Verify job exists
    job = get_job_by_id(db, job_id)
    
    # Admin can update is_approved and admin_comment
    return update_job_checklist_item_status(db, job_id, item_id, status_update)


@router.post("/upload-file", response_model=dict)
async def upload_job_file(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user)
):
    """Upload a file (e.g. Final Drawing) and return the S3 URL"""
    # Validate file extension
    allowed = settings.allowed_extensions_list
    file_ext = Path(file.filename).suffix.lower() if file.filename else ""
    if file_ext not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: {', '.join(allowed)}"
        )
    
    # Read content
    file_content = await file.read()
    
    # Validate size
    max_size = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(file_content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size: {settings.MAX_UPLOAD_SIZE_MB}MB"
        )
        
    # Upload
    file_url = upload_file_to_s3(
        file_content=file_content,
        filename=file.filename,
        content_type=file.content_type
    )
    
    return {"url": file_url}