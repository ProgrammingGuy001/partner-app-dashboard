from datetime import date, timedelta
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.model.ip import ip
from app.model.job import Job, JobRate
from app.schemas.analytics import JobStageCount, PayoutByIP, PayoutSummary


def get_date_range(period: str, year: int = None, month: int = None, quarter: int = None, week: int = None):
    """Calculate start and end dates based on period type."""
    today = date.today()

    if period == "week":
        if week and year:
            jan_1 = date(year, 1, 1)
            start_date = jan_1 + timedelta(weeks=week - 1)
            start_date = start_date - timedelta(days=start_date.weekday())
            end_date = start_date + timedelta(days=6)
        else:
            start_date = today - timedelta(days=today.weekday())
            end_date = start_date + timedelta(days=6)
    elif period == "month":
        if month and year:
            start_date = date(year, month, 1)
            end_date = date(year, month + 1, 1) - timedelta(days=1) if month < 12 else date(year, 12, 31)
        else:
            start_date = date(today.year, today.month, 1)
            end_date = (
                date(today.year, today.month + 1, 1) - timedelta(days=1)
                if today.month < 12
                else date(today.year, 12, 31)
            )
    elif period == "quarter":
        if quarter and year:
            quarter_start = {1: (1, 1), 2: (4, 1), 3: (7, 1), 4: (10, 1)}.get(quarter)
            if not quarter_start:
                raise HTTPException(status_code=400, detail="Quarter must be between 1 and 4")
            start_date = date(year, quarter_start[0], quarter_start[1])
            if quarter == 4:
                end_date = date(year, 12, 31)
            else:
                end_date = date(year, quarter_start[0] + 3, 1) - timedelta(days=1)
        else:
            current_quarter = (today.month - 1) // 3 + 1
            start_month = {1: 1, 2: 4, 3: 7, 4: 10}[current_quarter]
            start_date = date(today.year, start_month, 1)
            end_date = date(today.year, 12, 31) if current_quarter == 4 else date(today.year, start_month + 3, 1) - timedelta(days=1)
    elif period == "year":
        target_year = year or today.year
        start_date = date(target_year, 1, 1)
        end_date = date(target_year, 12, 31)
    else:
        raise HTTPException(status_code=400, detail="Invalid period. Use 'week', 'month', 'quarter', or 'year'")

    return start_date, end_date


def _payout_expression():
    return func.coalesce(JobRate.base_rate, 0) * func.coalesce(Job.area, 0)


def get_payout_analytics(
    db: Session,
    period: str,
    year: int = None,
    month: int = None,
    quarter: int = None,
    week: int = None,
):
    """Get payout analytics for the given period."""
    try:
        start_date, end_date = get_date_range(period, year, month, quarter, week)

        base_filter = [Job.delivery_date >= start_date, Job.delivery_date <= end_date]

        total_jobs = db.query(Job).filter(*base_filter).count()

        total_payout = (
            db.query(func.sum(_payout_expression()))
            .outerjoin(JobRate, Job.job_rate_id == JobRate.id)
            .filter(*base_filter, Job.status == "completed")
            .scalar()
            or Decimal(0)
        )

        total_additional_expense = (
            db.query(func.sum(func.coalesce(Job.additional_expense, 0)))
            .filter(*base_filter, Job.status == "completed")
            .scalar()
            or Decimal(0)
        )

        job_stages = (
            db.query(
                Job.status,
                func.count(Job.id).label("count"),
                func.sum(_payout_expression()).label("total_payout"),
                func.sum(func.coalesce(Job.additional_expense, 0)).label("total_additional_expense"),
            )
            .outerjoin(JobRate, Job.job_rate_id == JobRate.id)
            .filter(*base_filter)
            .group_by(Job.status)
            .all()
        )

        job_stage_list = [
            JobStageCount(
                status=stage.status,
                count=stage.count,
                total_payout=stage.total_payout or Decimal(0),
                total_additional_expense=stage.total_additional_expense or Decimal(0),
            )
            for stage in job_stages
        ]

        payout_by_ip = (
            db.query(
                ip.id,
                (func.coalesce(ip.first_name, "") + " " + func.coalesce(ip.last_name, "")).label("ip_name"),
                func.count(Job.id).label("job_count"),
                func.sum(_payout_expression()).label("total_payout"),
                func.sum(func.coalesce(Job.additional_expense, 0)).label("total_additional_expense"),
            )
            .join(Job, Job.assigned_ip_id == ip.id)
            .outerjoin(JobRate, Job.job_rate_id == JobRate.id)
            .filter(*base_filter, Job.status == "completed")
            .group_by(ip.id, ip.first_name, ip.last_name)
            .all()
        )

        payout_by_ip_list = [
            PayoutByIP(
                ip_id=item.id,
                ip_name=item.ip_name.strip(),
                job_count=item.job_count,
                total_payout=item.total_payout or Decimal(0),
                total_additional_expense=item.total_additional_expense or Decimal(0),
            )
            for item in payout_by_ip
        ]

        return PayoutSummary(
            period=period,
            start_date=start_date,
            end_date=end_date,
            total_jobs=total_jobs,
            total_payout=total_payout,
            total_additional_expense=total_additional_expense,
            job_stages=job_stage_list,
            payout_by_ip=payout_by_ip_list,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching analytics: {str(e)}")


def get_job_stage_summary(db: Session):
    """Get job count/payout by stage."""
    try:
        job_stages = (
            db.query(
                Job.status,
                func.count(Job.id).label("count"),
                func.sum(_payout_expression()).label("total_payout"),
                func.sum(func.coalesce(Job.additional_expense, 0)).label("total_additional_expense"),
            )
            .outerjoin(JobRate, Job.job_rate_id == JobRate.id)
            .group_by(Job.status)
            .all()
        )

        return [
            JobStageCount(
                status=stage.status,
                count=stage.count,
                total_payout=stage.total_payout or Decimal(0),
                total_additional_expense=stage.total_additional_expense or Decimal(0),
            )
            for stage in job_stages
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching job stage summary: {str(e)}")


def get_ip_performance(db: Session):
    """Get all-time IP performance (completed jobs only)."""
    try:
        ip_stats = (
            db.query(
                ip.id,
                (func.coalesce(ip.first_name, "") + " " + func.coalesce(ip.last_name, "")).label("ip_name"),
                func.count(Job.id).label("job_count"),
                func.sum(_payout_expression()).label("total_payout"),
                func.sum(func.coalesce(Job.additional_expense, 0)).label("total_additional_expense"),
            )
            .outerjoin(Job, and_(Job.assigned_ip_id == ip.id, Job.status == "completed"))
            .outerjoin(JobRate, Job.job_rate_id == JobRate.id)
            .group_by(ip.id, ip.first_name, ip.last_name)
            .all()
        )

        return [
            PayoutByIP(
                ip_id=item.id,
                ip_name=item.ip_name.strip(),
                job_count=item.job_count or 0,
                total_payout=item.total_payout or Decimal(0),
                total_additional_expense=item.total_additional_expense or Decimal(0),
            )
            for item in ip_stats
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching IP performance: {str(e)}")
