from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.schemas.analytics import PayoutSummary, JobStageCount, PayoutByIP
from app.crud.analytics import get_payout_analytics, get_job_stage_summary, get_ip_performance
from app.core.security import get_current_user

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/payout", response_model=PayoutSummary)
def get_payout_report(
    period: str = Query(..., description="Period type: 'week', 'month', 'quarter', or 'year'"),
    year: Optional[int] = Query(None, description="Specific year (optional, defaults to current)"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Specific month (1-12, required for 'month' period with specific year)"),
    quarter: Optional[int] = Query(None, ge=1, le=4, description="Specific quarter (1-4, required for 'quarter' period with specific year)"),
    week: Optional[int] = Query(None, ge=1, le=53, description="Specific week number (1-53, required for 'week' period with specific year)"),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """
    Get comprehensive payout analytics for a specific period.
    
    Examples:
    - Current week: ?period=week
    - Current month: ?period=month
    - Current quarter: ?period=quarter
    - Current year: ?period=year
    - Specific month: ?period=month&year=2024&month=3
    - Specific quarter: ?period=quarter&year=2024&quarter=2
    - Specific week: ?period=week&year=2024&week=10
    - Specific year: ?period=year&year=2023
    
    Returns:
    - Total jobs in the period
    - Total payout
    - Job count and payout by status
    - Job count and payout by IP
    """
    return get_payout_analytics(db, period, year, month, quarter, week)


@router.get("/job-stages", response_model=List[JobStageCount])
def get_job_stages(
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """
    Get current count of jobs in each stage (all time).
    Shows how many jobs are created, in_progress, paused, completed.
    """
    return get_job_stage_summary(db)


@router.get("/ip-performance", response_model=List[PayoutByIP])
def get_all_ip_performance(
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """
    Get performance metrics for all IPs (all time).
    Shows total jobs and total payout per IP.
    """
    return get_ip_performance(db)