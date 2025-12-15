from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from app.database import get_db
from app.model.ip import ip
from app.model.job import Job
from app.api.deps import get_verified_user
from app.services.s3_service import upload_file_to_s3

router = APIRouter(prefix="/dashboard/jobs", tags=["Dashboard"])


# ✅ Get all jobs (only if verified)
@router.get("")
def get_all_jobs(
    current_user: ip = Depends(get_verified_user),
    db: Session = Depends(get_db)
):
    # jobs = db.query(Job).all()
    jobs = db.query(Job).filter(Job.assigned_ip_id == current_user.id).all()
    print("Jobs fetched:", jobs)

    return {
        "message": "Jobs fetched successfully",
        "total": len(jobs),
        "jobs": jobs
    } 


# ✅ Get single job by ID
@router.get("/{job_id}")
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
        "job": job
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
@router.get("/{job_id}/completed")
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
        "job": job
    }
