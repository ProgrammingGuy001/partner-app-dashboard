import logging
from datetime import datetime, time

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.model.attendance import DailyAttendance
from app.utils.attendance_policy import ATTENDANCE_TIMEZONE, attendance_business_date

logger = logging.getLogger(__name__)


def auto_close_open_checkins(db: Session) -> int:
    """Close every check-in left open past its own day, so no day is ever left dangling.

    The row is deliberately reportless: an auto clock-out is not a submitted Daily
    Installation Report, and `checkout_source='auto'` is what lets a supervisor tell
    the two apart. Idempotent - re-running finds nothing left open.
    """
    today = attendance_business_date()
    open_check_ins = (
        db.query(DailyAttendance)
        .filter(
            DailyAttendance.attendance_type == "check_in",
            DailyAttendance.attendance_date < today,
        )
        .order_by(DailyAttendance.attendance_date)
        .all()
    )
    if not open_check_ins:
        return 0

    closed_keys = {
        (ip_user_id, job_id, attendance_date)
        for ip_user_id, job_id, attendance_date in db.query(
            DailyAttendance.ip_user_id,
            DailyAttendance.job_id,
            DailyAttendance.attendance_date,
        ).filter(
            DailyAttendance.attendance_type == "check_out",
            DailyAttendance.attendance_date < today,
        )
    }

    created = 0
    for check_in in open_check_ins:
        key = (check_in.ip_user_id, check_in.job_id, check_in.attendance_date)
        if key in closed_keys:
            continue
        closed_keys.add(key)
        db.add(
            DailyAttendance(
                job_id=check_in.job_id,
                ip_user_id=check_in.ip_user_id,
                attendance_date=check_in.attendance_date,
                phone=check_in.phone,
                attendance_type="check_out",
                # lat/lng are NOT NULL; the check-in location is the only truth we have.
                # distance_meters/within_geofence stay NULL on purpose — nobody was
                # actually measured here, so claiming "inside the fence" would be a lie.
                latitude=check_in.latitude,
                longitude=check_in.longitude,
                manual_location="Auto clock-out",
                photo_url=None,
                report_document_url=None,
                report_data=None,
                checkout_source="auto",
                recorded_at=_midnight_after(check_in.attendance_date),
            )
        )
        created += 1

    if created:
        db.commit()
        logger.info("Auto clock-out: closed %d open check-in(s)", created)
    return created


def _midnight_after(business_date) -> datetime:
    """Stamp the auto check-out at the end of its own business day, not the sweep time."""
    return datetime.combine(business_date, time(23, 59, 59), tzinfo=ATTENDANCE_TIMEZONE)


def run_auto_close() -> None:
    """Scheduler entrypoint - runs outside the request lifecycle, owns its session."""
    try:
        with SessionLocal() as db:
            auto_close_open_checkins(db)
    except Exception as exc:
        logger.exception("Auto clock-out job failed: %s", exc)
