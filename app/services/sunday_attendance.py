"""Sunday attendance parked for superadmin approval.

Marking attendance on a Sunday used to be refused outright, leaving the person to
file a request by hand and come back once it was granted. Now the attempt itself
raises the request and travels with it: the GPS fix, photo and location are parked
on the SundayWorkRequest, and approval replays them as a real attendance row.

Same shape as JobApprovalRequest (app/routes/job.py::_execute_approved_request),
which likewise stores what the requester submitted so the approver executes exactly
that and nothing else.
"""
import logging
from datetime import datetime

from sqlalchemy.orm import Session

from app.model.admin_attendance import AdminAttendance
from app.model.attendance import DailyAttendance
from app.model.sunday_work_request import SundayWorkRequest
from app.utils.attendance_policy import now_ist

logger = logging.getLogger(__name__)

AUTO_REASON = "Raised automatically from a Sunday attendance attempt."


def find_request(
    db: Session,
    business_date,
    *,
    ip_user_id: int | None = None,
    admin_id: int | None = None,
) -> SundayWorkRequest | None:
    """The requester's request for that exact Sunday, whatever its status."""
    query = db.query(SundayWorkRequest).filter(SundayWorkRequest.request_date == business_date)
    if ip_user_id is not None:
        query = query.filter(SundayWorkRequest.ip_user_id == ip_user_id)
    else:
        query = query.filter(SundayWorkRequest.admin_id == admin_id)
    return query.first()


def park_attendance(
    db: Session,
    business_date,
    payload: dict,
    *,
    ip_user_id: int | None = None,
    admin_id: int | None = None,
    reason: str | None = None,
) -> SundayWorkRequest:
    """File the pending request carrying this attempt. The caller commits."""
    payload = {**payload, "attempted_at": now_ist().isoformat()}
    request = SundayWorkRequest(
        ip_user_id=ip_user_id,
        admin_id=admin_id,
        request_date=business_date,
        reason=(reason or "").strip() or AUTO_REASON,
        status="pending",
        attendance_payload=payload,
    )
    db.add(request)
    return request


def _attempted_at(payload: dict) -> datetime:
    stamp = payload.get("attempted_at")
    if not stamp:
        return now_ist()
    try:
        return datetime.fromisoformat(stamp)
    except ValueError:
        return now_ist()


def record_parked_attendance(db: Session, request: SundayWorkRequest) -> bool:
    """Replay the parked attempt as attendance. The caller commits.

    Returns whether a row was written. A request filed ahead of the Sunday carries no
    payload — approving it only unlocks the day, exactly as it did before.
    """
    payload = request.attendance_payload
    if not payload:
        return False

    if request.ip_user_id is not None:
        already = (
            db.query(DailyAttendance.id)
            .filter(
                DailyAttendance.ip_user_id == request.ip_user_id,
                DailyAttendance.job_id == payload.get("job_id"),
                DailyAttendance.attendance_date == request.request_date,
                DailyAttendance.attendance_type == "check_in",
            )
            .first()
        )
        if already:
            logger.info(
                "Sunday request %s already has a check-in for %s; not duplicating",
                request.id,
                request.request_date,
            )
            return False
        db.add(
            DailyAttendance(
                job_id=payload.get("job_id"),
                ip_user_id=request.ip_user_id,
                attendance_date=request.request_date,
                phone=payload["phone"],
                attendance_type="check_in",
                latitude=payload["latitude"],
                longitude=payload["longitude"],
                manual_location=payload.get("manual_location"),
                distance_meters=payload.get("distance_meters"),
                within_geofence=payload.get("within_geofence"),
                photo_url=payload.get("photo_url"),
            )
        )
    else:
        db.add(
            AdminAttendance(
                admin_id=request.admin_id,
                # The moment they stood at the site, not the moment approval landed.
                marked_at=_attempted_at(payload),
                latitude=payload.get("latitude"),
                longitude=payload.get("longitude"),
                manual_location=payload.get("manual_location"),
                matched_job_id=payload.get("matched_job_id"),
                distance_meters=payload.get("distance_meters"),
                within_geofence=payload.get("within_geofence"),
                photo_url=payload.get("photo_url"),
                notes=payload.get("notes"),
            )
        )

    logger.info(
        "Sunday request %s approved: recorded %s attendance for %s",
        request.id,
        request.requester_type,
        request.request_date,
    )
    return True
