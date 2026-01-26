from sqlalchemy.orm import Session, joinedload
from app.model.job import Job, JobChecklist
from app.model.ip import ip
from app.model.job_status_log import JobStatusLog
from app.schemas.job import JobCreate, JobUpdate
from app.schemas.job_status_log import JobStatusLogCreate
from fastapi import HTTPException
from datetime import date, datetime
from app.crud.ip import assign_ip, unassign_ip, check_ip_available
from app.utils.ip_assignment import is_admin_allowed_for_ip

def get_job_by_id(db: Session, job_id: int, user_id: int = None):
    """Get a job by ID with error handling and authorization"""
    try:
        job = db.query(Job).options(joinedload(Job.assigned_ip)).filter(Job.id == job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail=f"Job with ID {job_id} not found")
        if user_id is not None and job.user_id != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to access this job")
        return job
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

def get_all_jobs(db: Session, skip: int = 0, limit: int = 100, status: str = None, type: str = None, search: str = None, user_id: int = None, admin_id: int = None):
    """Get all jobs with optional status, type, and search filters and error handling"""
    try:
        query = db.query(Job).options(joinedload(Job.assigned_ip))
        if user_id:
            query = query.filter(Job.user_id == user_id)
        if status:
            query = query.filter(Job.status == status)
        if type:
            query = query.filter(Job.type == type)
        if search:
            query = query.filter(
                (Job.name.ilike(f"{search}%")) |
                (Job.customer_name.ilike(f"{search}%")) |
                (Job.city.ilike(f"{search}%"))
            )
        return query.offset(skip).limit(limit).all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

def create_job(db: Session, job: JobCreate, user_id: int, is_superadmin: bool = False):
    """Create a new job with IP validation and error handling"""
    try:
        # Check if IP is assigned and already_assigned is False (only if IP is provided)
        if job.assigned_ip_id:
            ip_user = db.query(ip).filter(ip.id == job.assigned_ip_id).first()
            if not ip_user:
                raise HTTPException(status_code=404, detail=f"IP with ID {job.assigned_ip_id} not found")
            if ip_user.is_assigned:
                raise HTTPException(status_code=400, detail=f"IP {ip_user.id} is already assigned to another job")
            
            # Check if admin is assigned to this IP (superadmins can bypass)
            if not is_superadmin:
                if not is_admin_allowed_for_ip(db, job.assigned_ip_id, user_id):
                    raise HTTPException(status_code=403, detail=f"Admin {user_id} is not allowed to be assigned IP {job.assigned_ip_id}")
        
        job_data = job.model_dump()
        # Ensure checklist_ids and checklist_id are handled
        checklist_ids = job_data.pop('checklist_ids', [])
        job_data.pop('checklist_id', None) # Remove legacy field if present
        job_data.pop('user_id', None) # Remove user_id to avoid multiple values error
        
        db_job = Job(**job_data, user_id=user_id)
        db.add(db_job)
        db.flush()  # Flush to get the job ID

        # Create JobChecklist entries
        if checklist_ids:
            for c_id in checklist_ids:
                job_checklist = JobChecklist(job_id=db_job.id, checklist_id=c_id)
                db.add(job_checklist)
        
        # Log the job creation
        status_log = JobStatusLog(
            job_id=db_job.id,
            status="created",
            timestamp=datetime.utcnow(),
            notes="Job created"
        )
        db.add(status_log)
        
        db.commit()
        db.refresh(db_job)
        
        return db_job
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        print(f"ERROR: create_job failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error creating job: {str(e)}")

def update_job(db: Session, job_id: int, job_update: JobUpdate, admin_id: int = None, is_superadmin: bool = False):
    """Update a job - IP will be assigned/unassigned based on job status changes"""
    try:
        db_job = db.query(Job).filter(Job.id == job_id).first()
        if not db_job:
            raise HTTPException(status_code=404, detail=f"Job with ID {job_id} not found")
        
        update_data = job_update.model_dump(exclude_unset=True)
        
        # Handle IP assignment changes
        if 'assigned_ip_id' in update_data:
            new_ip_id = update_data['assigned_ip_id']
            old_ip_id = db_job.assigned_ip_id
            
            # Only handle IP reassignment if job is in_progress
            if db_job.status == "in_progress" and new_ip_id != old_ip_id:
                # Unassign old IP if exists
                if old_ip_id:
                    unassign_ip(db, old_ip_id, admin_id, is_superadmin, commit=False)
                
                # Assign new IP
                if new_ip_id:
                    assign_ip(db, new_ip_id, admin_id, is_superadmin, commit=False)

        # Handle Checklist changes
        if 'checklist_ids' in update_data:
            checklist_ids = update_data.pop('checklist_ids')
            # Remove existing checklists
            db.query(JobChecklist).filter(JobChecklist.job_id == job_id).delete()
            # Add new checklists
            if checklist_ids:
                for c_id in checklist_ids:
                    job_checklist = JobChecklist(job_id=job_id, checklist_id=c_id)
                    db.add(job_checklist)
        
        # Remove legacy field if present in update_data
        update_data.pop('checklist_id', None)
        
        # Update job fields individually to avoid issues with bulk update
        for key, value in update_data.items():
            if hasattr(db_job, key):
                setattr(db_job, key, value)
        
        db.commit()
        db.refresh(db_job)
        print(f"DEBUG: Job updated successfully. additional_expense = {db_job.additional_expense}")
        
        return db_job
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        print(f"ERROR: update_job failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error updating job: {str(e)}")

def delete_job(db: Session, job_id: int, admin_id: int = None, is_superadmin: bool = False):
    """Delete a job, its status logs, and unassign its IP with error handling"""
    try:
        db_job = db.query(Job).filter(Job.id == job_id).first()
        if not db_job:
            raise HTTPException(status_code=404, detail=f"Job with ID {job_id} not found")
        
        # Unassign IP if exists
        if db_job.assigned_ip_id:
            unassign_ip(db, db_job.assigned_ip_id, admin_id, is_superadmin, commit=False)
        
        # Delete all job checklists for this job
        db.query(JobChecklist).filter(JobChecklist.job_id == job_id).delete(synchronize_session=False)
        
        # Delete all status logs for this job
        db.query(JobStatusLog).filter(JobStatusLog.job_id == job_id).delete(synchronize_session=False)
        
        db.delete(db_job)
        db.commit()
        
        return {"message": "Job deleted successfully"}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting job: {str(e)}")

def start_job(db: Session, job_id: int, admin_id: int = None, is_superadmin: bool = False, notes: str = None):
    """Start a job - ASSIGNS the IP when starting"""
    try:
        db_job = db.query(Job).filter(Job.id == job_id).first()
        if not db_job:
            raise HTTPException(status_code=404, detail=f"Job with ID {job_id} not found")
        
        if db_job.status != "created" and db_job.status != "paused":
            raise HTTPException(status_code=400, detail=f"Job cannot be started. Current status: {db_job.status}")
        
        # Assign IP when starting or resuming
        if db_job.assigned_ip_id:
            assign_ip(db, db_job.assigned_ip_id, admin_id, is_superadmin, commit=False)
        else:
            raise HTTPException(status_code=400, detail="Cannot start job: No IP assigned. Please edit the job to assign an IP first.")
        
        db_job.status = "in_progress"
        
        # Log the status change
        status_log = JobStatusLog(
            job_id=job_id,
            status="in_progress",
            timestamp=datetime.utcnow(),
            notes=notes or ("Job resumed" if db_job.status == "paused" else "Job started")
        )
        db.add(status_log)
        
        db.commit()
        db.refresh(db_job)
        
        return db_job
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error starting job: {str(e)}")

def pause_job(db: Session, job_id: int, admin_id: int = None, is_superadmin: bool = False, notes: str = None):
    """Pause a job - UNASSIGNS the IP during pause"""
    try:
        db_job = db.query(Job).filter(Job.id == job_id).first()
        if not db_job:
            raise HTTPException(status_code=404, detail=f"Job with ID {job_id} not found")
        
        if db_job.status != "in_progress":
            raise HTTPException(status_code=400, detail=f"Only jobs in progress can be paused. Current status: {db_job.status}")
        
        if db_job.assigned_ip_id:
            unassign_ip(db, db_job.assigned_ip_id, admin_id, is_superadmin, commit=False)

        db_job.status = "paused"
        
        # Log the status change
        status_log = JobStatusLog(
            job_id=job_id,
            status="paused",
            timestamp=datetime.utcnow(),
            notes=notes or "Job paused"
        )
        db.add(status_log)
        
        db.commit()
        db.refresh(db_job)
        
        return db_job
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error pausing job: {str(e)}")

def finish_job(db: Session, job_id: int, admin_id: int = None, is_superadmin: bool = False, notes: str = None):
    """Finish a job - UNASSIGNS the IP when completing"""
    try:
        db_job = db.query(Job).filter(Job.id == job_id).first()
        if not db_job:
            raise HTTPException(status_code=404, detail=f"Job with ID {job_id} not found")
        
        if db_job.status != "in_progress":
            raise HTTPException(status_code=400, detail=f"Only jobs in progress can be finished. Current status: {db_job.status}")
        
        # Unassign IP when completing the job
        if db_job.assigned_ip_id:
            unassign_ip(db, db_job.assigned_ip_id, admin_id, is_superadmin, commit=False)
        
        db_job.status = "completed"
        
        # Log the status change
        status_log = JobStatusLog(
            job_id=job_id,
            status="completed",
            timestamp=datetime.utcnow(),
            notes=notes or "Job completed"
        )
        db.add(status_log)
        
        db.commit()
        db.refresh(db_job)
        
        return db_job
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error finishing job: {str(e)}")

def get_job_status_history(db: Session, job_id: int):
    """Get the complete status history of a job including all pauses and resumes"""
    try:
        # Check if job exists
        db_job = db.query(Job).filter(Job.id == job_id).first()
        if not db_job:
            raise HTTPException(status_code=404, detail=f"Job with ID {job_id} not found")
        
        # Get all status logs for this job, ordered by timestamp
        status_logs = db.query(JobStatusLog).filter(
            JobStatusLog.job_id == job_id
        ).order_by(JobStatusLog.timestamp.desc()).all()
        
        return status_logs
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching job status history: {str(e)}")