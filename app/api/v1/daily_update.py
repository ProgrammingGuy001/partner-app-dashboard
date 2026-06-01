from datetime import date
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Path, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_fully_verified_user
from app.database import get_db
from app.crud.job import get_ip_job_by_id
from app.model.daily_update import DailyJobUpdate, DailyJobUpdatePhoto
from app.model.ip import ip
from app.schemas.daily_update import DailyJobUpdateResponse
from app.services.s3_service import upload_file_to_s3
from app.services.upload_service import read_validated_upload

router = APIRouter(prefix="/dashboard/jobs", tags=["Daily Updates"])

_PHOTO_EXTENSIONS = {".jpg", ".jpeg", ".png"}
_PHOTO_CONTENT_TYPES = {"image/jpeg", "image/png"}
_MAX_PHOTOS = 5


@router.post("/{job_id}/daily-updates", response_model=DailyJobUpdateResponse, status_code=status.HTTP_201_CREATED)
async def submit_daily_update(
    job_id: Annotated[int, Path(gt=0)],
    notes: Annotated[Optional[str], Form(max_length=2000)] = None,
    update_date: Annotated[Optional[date], Form()] = None,
    photos: Annotated[List[UploadFile], File()] = ...,
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db),
):
    """Submit a daily progress update with up to 5 photos and notes."""
    get_ip_job_by_id(db, job_id, current_user.id)

    if not photos or all(p.filename == "" for p in photos):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one photo is required")

    valid_photos = [p for p in photos if p.filename]
    if len(valid_photos) > _MAX_PHOTOS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum {_MAX_PHOTOS} photos allowed per update",
        )

    resolved_date = update_date or date.today()

    record = DailyJobUpdate(
        job_id=job_id,
        submitted_by_type="ip",
        submitted_by_id=current_user.id,
        update_date=resolved_date,
        notes=notes.strip() if notes else None,
    )
    db.add(record)
    db.flush()

    for photo_file in valid_photos:
        upload = await read_validated_upload(
            photo_file,
            allowed_extensions=_PHOTO_EXTENSIONS,
            allowed_content_types=_PHOTO_CONTENT_TYPES,
            max_size_mb=5,
        )
        url = upload_file_to_s3(
            file_content=upload.content,
            filename=upload.filename,
            content_type=upload.content_type,
        )
        db.add(DailyJobUpdatePhoto(update_id=record.id, photo_url=url))

    db.commit()
    db.refresh(record)
    return DailyJobUpdateResponse.model_validate(record)


@router.get("/{job_id}/daily-updates", response_model=dict)
def get_daily_updates(
    job_id: Annotated[int, Path(gt=0)],
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db),
):
    """Get all daily updates for a job submitted by the current IP user."""
    get_ip_job_by_id(db, job_id, current_user.id)

    updates = (
        db.query(DailyJobUpdate)
        .filter(
            DailyJobUpdate.job_id == job_id,
            DailyJobUpdate.submitted_by_id == current_user.id,
        )
        .order_by(DailyJobUpdate.update_date.desc(), DailyJobUpdate.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return {
        "job_id": job_id,
        "total": len(updates),
        "updates": [DailyJobUpdateResponse.model_validate(u) for u in updates],
    }
