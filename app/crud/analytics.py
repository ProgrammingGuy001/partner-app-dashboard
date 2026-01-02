from sqlalchemy.orm import Session
from sqlalchemy import func, extract, and_
from fastapi import HTTPException
from datetime import date, timedelta
from decimal import Decimal
from app.model.job import Job
from app.model.ip import ip
from app.schemas.analytics import JobStageCount, PayoutByIP, PayoutSummary
from app.core.cache import cached

def get_date_range(period: str, year: int = None, month: int = None, quarter: int = None, week: int = None):
    """Calculate start and end dates based on period type"""
    from datetime import datetime
    
    today = date.today()
    
    if period == "week":
        # Get current week or specific week
        if week and year:
            # Get the first day of the year
            jan_1 = date(year, 1, 1)
            # Calculate the start of the specified week
            start_date = jan_1 + timedelta(weeks=week-1)
            # Adjust to Monday
            start_date = start_date - timedelta(days=start_date.weekday())
            end_date = start_date + timedelta(days=6)
        else:
            # Current week (Monday to Sunday)
            start_date = today - timedelta(days=today.weekday())
            end_date = start_date + timedelta(days=6)
            
    elif period == "month":
        if month and year:
            start_date = date(year, month, 1)
            # Last day of month
            if month == 12:
                end_date = date(year, 12, 31)
            else:
                end_date = date(year, month + 1, 1) - timedelta(days=1)
        else:
            # Current month
            start_date = date(today.year, today.month, 1)
            if today.month == 12:
                end_date = date(today.year, 12, 31)
            else:
                end_date = date(today.year, today.month + 1, 1) - timedelta(days=1)
                
    elif period == "quarter":
        if quarter and year:
            if quarter == 1:
                start_date = date(year, 1, 1)
                end_date = date(year, 3, 31)
            elif quarter == 2:
                start_date = date(year, 4, 1)
                end_date = date(year, 6, 30)
            elif quarter == 3:
                start_date = date(year, 7, 1)
                end_date = date(year, 9, 30)
            else:  # quarter == 4
                start_date = date(year, 10, 1)
                end_date = date(year, 12, 31)
        else:
            # Current quarter
            current_quarter = (today.month - 1) // 3 + 1
            if current_quarter == 1:
                start_date = date(today.year, 1, 1)
                end_date = date(today.year, 3, 31)
            elif current_quarter == 2:
                start_date = date(today.year, 4, 1)
                end_date = date(today.year, 6, 30)
            elif current_quarter == 3:
                start_date = date(today.year, 7, 1)
                end_date = date(today.year, 9, 30)
            else:
                start_date = date(today.year, 10, 1)
                end_date = date(today.year, 12, 31)
                
    elif period == "year":
        if year:
            start_date = date(year, 1, 1)
            end_date = date(year, 12, 31)
        else:
            # Current year
            start_date = date(today.year, 1, 1)
            end_date = date(today.year, 12, 31)
    else:
        raise HTTPException(status_code=400, detail="Invalid period. Use 'week', 'month', 'quarter', or 'year'")
    
    return start_date, end_date


@cached(prefix="analytics:payout", ttl=900)
def get_payout_analytics(
    db: Session,
    period: str,
    year: int = None,
    month: int = None,
    quarter: int = None,
    week: int = None
):
    """
    Get comprehensive payout analytics for a given period
    - Total payout (calculated as rate * some area/quantity metric if you have one)
    - Jobs by stage
    - Payout per IP
    """
    try:
        # Get date range
        start_date, end_date = get_date_range(period, year, month, quarter, week)
        
        # Query jobs in the date range (using delivery_date as the reference)
        jobs_query = db.query(Job).filter(
            Job.delivery_date >= start_date,
            Job.delivery_date <= end_date
        )
        
        # Total jobs count
        total_jobs = jobs_query.count()
        
        # Calculate total payout (rate * size) for completed jobs only
        # If size is NULL, we'll default to 0 for that job
        total_payout = db.query(func.sum(Job.rate * func.coalesce(Job.size, 0))).filter(
            Job.delivery_date >= start_date,
            Job.delivery_date <= end_date,
            Job.status == 'completed'
        ).scalar() or Decimal(0)
        
        # Calculate total additional expenses for completed jobs
        total_additional_expense = db.query(func.sum(func.coalesce(Job.additional_expense, 0))).filter(
            Job.delivery_date >= start_date,
            Job.delivery_date <= end_date,
            Job.status == 'completed'
        ).scalar() or Decimal(0)
        
        # Jobs by stage with payout = rate * size and additional expenses
        job_stages = db.query(
            Job.status,
            func.count(Job.id).label('count'),
            func.sum(Job.rate * func.coalesce(Job.size, 0)).label('total_payout'),
            func.sum(func.coalesce(Job.additional_expense, 0)).label('total_additional_expense')
        ).filter(
            Job.delivery_date >= start_date,
            Job.delivery_date <= end_date
        ).group_by(Job.status).all()
        
        job_stage_list = [
            JobStageCount(
                status=stage.status,
                count=stage.count,
                total_payout=stage.total_payout or Decimal(0),
                total_additional_expense=stage.total_additional_expense or Decimal(0)
            )
            for stage in job_stages
        ]
        
        # Payout by IP with rate * size and additional expenses (completed jobs only)
        payout_by_ip = db.query(
            ip.id,
            (ip.first_name + ' ' + ip.last_name).label('ip_name'),
            func.count(Job.id).label('job_count'),
            func.sum(Job.rate * func.coalesce(Job.size, 0)).label('total_payout'),
            func.sum(func.coalesce(Job.additional_expense, 0)).label('total_additional_expense')
        ).join(
            Job, Job.assigned_ip_id == ip.id
        ).filter(
            Job.delivery_date >= start_date,
            Job.delivery_date <= end_date,
            Job.status == 'completed'
        ).group_by(ip.id, ip.first_name, ip.last_name).all()
        
        payout_by_ip_list = [
            PayoutByIP(
                ip_id=item.id,
                ip_name=item.ip_name,
                job_count=item.job_count,
                total_payout=item.total_payout or Decimal(0),
                total_additional_expense=item.total_additional_expense or Decimal(0)
            )
            for item in payout_by_ip
        ]
        
        # Create summary
        summary = PayoutSummary(
            period=period,
            start_date=start_date,
            end_date=end_date,
            total_jobs=total_jobs,
            total_payout=total_payout,
            total_additional_expense=total_additional_expense,
            job_stages=job_stage_list,
            payout_by_ip=payout_by_ip_list
        )
        
        return summary
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching analytics: {str(e)}")


@cached(prefix="analytics:job_stages", ttl=900)
def get_job_stage_summary(db: Session):
    """Get current count of jobs in each stage (all time) with payout = rate * size and additional expenses"""
    try:
        job_stages = db.query(
            Job.status,
            func.count(Job.id).label('count'),
            func.sum(Job.rate * func.coalesce(Job.size, 0)).label('total_payout'),
            func.sum(func.coalesce(Job.additional_expense, 0)).label('total_additional_expense')
        ).group_by(Job.status).all()
        
        return [
            JobStageCount(
                status=stage.status,
                count=stage.count,
                total_payout=stage.total_payout or Decimal(0),
                total_additional_expense=stage.total_additional_expense or Decimal(0)
            )
            for stage in job_stages
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching job stage summary: {str(e)}")


@cached(prefix="analytics:ip_performance", ttl=900)
def get_ip_performance(db: Session):
    """Get performance metrics for all IPs (all time) with payout = rate * size and additional expenses (completed jobs only)"""
    try:
        ip_stats = db.query(
            ip.id,
            (ip.first_name + ' ' + ip.last_name).label('ip_name'),
            func.count(Job.id).label('job_count'),
            func.sum(Job.rate * func.coalesce(Job.size, 0)).label('total_payout'),
            func.sum(func.coalesce(Job.additional_expense, 0)).label('total_additional_expense')
        ).outerjoin(
            Job, and_(Job.assigned_ip_id == ip.id, Job.status == 'completed')
        ).group_by(ip.id, ip.first_name, ip.last_name).all()
        
        return [
            PayoutByIP(
                ip_id=item.id,
                ip_name=item.ip_name,
                job_count=item.job_count or 0,
                total_payout=item.total_payout or Decimal(0),
                total_additional_expense=item.total_additional_expense or Decimal(0)
            )
            for item in ip_stats
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching IP performance: {str(e)}")