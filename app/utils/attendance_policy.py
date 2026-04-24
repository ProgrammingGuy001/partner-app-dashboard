from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status

ATTENDANCE_TIMEZONE = ZoneInfo("Asia/Kolkata")
ATTENDANCE_CUTOFF = time(10, 30)


def now_ist() -> datetime:
    return datetime.now(ATTENDANCE_TIMEZONE)


def ensure_attendance_window_open() -> None:
    """Attendance cannot be marked after 10:30 AM IST."""
    if now_ist().time() > ATTENDANCE_CUTOFF:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Attendance can only be marked until 10:30 AM IST.",
        )


def to_ist_date(value: datetime):
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(ATTENDANCE_TIMEZONE).date()


def build_attendance_completion(registered_at: datetime | None, attendance_times: list[datetime]) -> dict:
    start = registered_at or now_ist()
    if attendance_times:
        earliest_attendance = min(attendance_times)
        if to_ist_date(earliest_attendance) < to_ist_date(start):
            start = earliest_attendance

    start_date = to_ist_date(start)
    today = now_ist().date()
    if start_date > today:
        start_date = today

    total_days = (today - start_date).days + 1
    completed_dates = {
        to_ist_date(marked_at)
        for marked_at in attendance_times
        if start_date <= to_ist_date(marked_at) <= today
    }
    completed_days = len(completed_dates)
    missing_days = max(total_days - completed_days, 0)
    percentage = round((completed_days / total_days) * 100, 2) if total_days else 0.0

    return {
        "registered_at": start.isoformat(),
        "total_days": total_days,
        "completed_days": completed_days,
        "missing_days": missing_days,
        "completion_percentage": percentage,
    }
