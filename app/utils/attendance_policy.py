from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status

ATTENDANCE_TIMEZONE = ZoneInfo("Asia/Kolkata")
CHECK_IN_CUTOFF = time(10, 30)
CHECK_OUT_EARLIEST = time(18, 30)
CHECK_OUT_CUTOFF = time(19, 0)
SLOT_CHECK_IN_GRACE = timedelta(minutes=30)


def now_ist() -> datetime:
    return datetime.now(ATTENDANCE_TIMEZONE)


def attendance_business_date():
    return now_ist().date()


def is_sunday(business_date) -> bool:
    return business_date.weekday() == 6


def slot_check_in_window(slot_start: time) -> tuple[time, time]:
    """The check-in window a job slot opens: its start plus 30 minutes."""
    end = (datetime.combine(date.min, slot_start) + SLOT_CHECK_IN_GRACE).time()
    # ponytail: a slot past 23:30 would wrap into the next day; clamp instead, since
    # daily_attendance stores a single attendance_date with no time-of-day column.
    if end <= slot_start:
        end = time(23, 59, 59)
    return slot_start, end


def ensure_attendance_window_open(
    attendance_type: str = "check_in", slot_start: time | None = None
) -> None:
    """Check-in closes at 10:30, or within a job's slot when one is set; check-out only
    opens at 18:30 and is flagged late past 19:00."""
    current_time = now_ist().time()
    if attendance_type == "check_in":
        if slot_start is not None:
            # The slot replaces the cutoff outright, so an early check-in is rejected too.
            window_start, window_end = slot_check_in_window(slot_start)
            if not window_start <= current_time <= window_end:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=(
                        f"Check-in for this job is open from {window_start.strftime('%H:%M')} "
                        f"to {window_end.strftime('%H:%M')} IST."
                    ),
                )
        elif current_time > CHECK_IN_CUTOFF:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Check-in can only be marked until 10:30 AM IST.",
            )
    # No date branch needed: the midnight sweep auto-closes any check-in left open,
    # so every manual check-out is necessarily for the current business day.
    if attendance_type == "check_out" and current_time < CHECK_OUT_EARLIEST:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Check-out can only be marked after 6:30 PM IST.",
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
