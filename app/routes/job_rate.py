import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database import get_db
from app.model.job import JobRate
from app.model.user import User
from app.schemas.job import JobRateCreate, JobRateResponse

router = APIRouter(prefix="/job-rates", tags=["Job Rates"])

logger = logging.getLogger(__name__)


def _require_superadmin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Only superadmins can manage job rates")
    return current_user


@router.get("", response_model=List[JobRateResponse])
def list_job_rates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Rate cards any admin can pick from when creating a job."""
    return db.scalars(
        select(JobRate).order_by(JobRate.job_type_name, JobRate.location)
    ).all()


@router.post("", response_model=JobRateResponse, status_code=status.HTTP_201_CREATED)
def create_job_rate(
    payload: JobRateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_superadmin),
):
    """Add a rate card. Only superadmins set what work is worth."""
    rate = JobRate(**payload.model_dump())
    db.add(rate)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"A rate for '{payload.job_type_name}' at "
                f"'{payload.location or 'any location'}' already exists"
            ),
        )
    db.refresh(rate)
    return rate
