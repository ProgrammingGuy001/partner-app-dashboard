from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo


ATTENDANCE_TIMEZONE = ZoneInfo("Asia/Kolkata")
CHECK_OUT_CUTOFF = time(19, 0)


def now_ist() -> datetime:
    return datetime.now(ATTENDANCE_TIMEZONE)


def attendance_business_date():
    return now_ist().date()


def is_sunday(business_date) -> bool:
    return business_date.weekday() == 6


def check_in_window(job_type: str | None, slot_start: time | None) -> tuple[time, time]:
    """Attendance is available throughout the scheduled business day."""
    return time.min, time.max


def ensure_attendance_window_open(
    attendance_type: str = "check_in",
    job_type: str | None = None,
    slot_start: time | None = None,
) -> None:
    """No time-of-day restriction; callers still enforce assignment and date rules."""
    return None


def filter_attendance_time(query, column, time_from: time | None, time_to: time | None):
    """Filter recorded time in IST, including ranges crossing midnight."""
    from sqlalchemy import Time, cast, func, or_

    if time_from is None and time_to is None:
        return query
    if query.session.get_bind().dialect.name == "sqlite":
        local_time = func.strftime("%H:%M:%S", column, "+5 hours", "+30 minutes")
        start = time_from.isoformat(timespec="seconds") if time_from else None
        end = time_to.isoformat(timespec="seconds") if time_to else None
    else:
        local_time = cast(func.timezone("Asia/Kolkata", column), Time)
        start, end = time_from, time_to
    if start is not None and end is not None and start > end:
        return query.filter(or_(local_time >= start, local_time <= end))
    if start is not None:
        query = query.filter(local_time >= start)
    if end is not None:
        query = query.filter(local_time <= end)
    return query


def to_ist_date(value: datetime):
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(ATTENDANCE_TIMEZONE).date()


def build_attendance_completion(
    registered_at: datetime | None, attendance_times: list[datetime]
) -> dict:
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
