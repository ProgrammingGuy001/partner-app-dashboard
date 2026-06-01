from datetime import date
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database import get_db
from app.model.daily_update import DailyJobUpdate
from app.model.user import User
from app.schemas.daily_update import DailyJobUpdateResponse

router = APIRouter(prefix="/jobs", tags=["Daily Updates (Admin)"])


@router.get("/{job_id}/daily-updates", response_model=dict)
def get_job_daily_updates(
    job_id: Annotated[int, Path(gt=0)],
    update_date: Optional[date] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin: Get all daily updates for a job, optionally filtered by date."""
    query = db.query(DailyJobUpdate).filter(DailyJobUpdate.job_id == job_id)
    if update_date:
        query = query.filter(DailyJobUpdate.update_date == update_date)

    updates = (
        query.order_by(DailyJobUpdate.update_date.desc(), DailyJobUpdate.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return {
        "job_id": job_id,
        "total": len(updates),
        "updates": [DailyJobUpdateResponse.model_validate(u) for u in updates],
    }


@router.get("/daily-updates/all", response_model=dict)
def get_all_daily_updates(
    update_date: Optional[date] = Query(None),
    submitted_by_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin: Get all daily updates across all jobs with optional filters."""
    query = db.query(DailyJobUpdate)
    if update_date:
        query = query.filter(DailyJobUpdate.update_date == update_date)
    if submitted_by_id:
        query = query.filter(DailyJobUpdate.submitted_by_id == submitted_by_id)

    updates = (
        query.order_by(DailyJobUpdate.update_date.desc(), DailyJobUpdate.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return {
        "total": len(updates),
        "updates": [DailyJobUpdateResponse.model_validate(u) for u in updates],
    }
