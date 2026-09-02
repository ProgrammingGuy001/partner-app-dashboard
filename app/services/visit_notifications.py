"""The two WhatsApp notices a customer gets about a site visit.

One when the visit is scheduled - the job's IP is assigned, or a dated roster row is
added or swapped - and one an hour before the slot starts. Both are claimed before the
external call, so each is attempted once per visit however many times a sweep runs.
A visit that spans both slots of a day is one visit, and gets one notice, timed off the
first slot.
"""

import logging
from datetime import datetime, timedelta

from sqlalchemy import update
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.database import SessionLocal
from app.model.job import Job
from app.model.roster import JobRosterEntry
from app.services.interakt_service import send_ip_visit_notification
from app.utils.attendance_policy import ATTENDANCE_TIMEZONE, now_ist
from app.utils.job_documents import job_type_label

logger = logging.getLogger("uvicorn.error")

REMINDER_LEAD = timedelta(hours=1)
ACTIVE_JOB_STATUSES = ("created", "in_progress", "paused")


def _entry_query(db: Session):
    return db.query(JobRosterEntry).options(
        joinedload(JobRosterEntry.job).joinedload(Job.customer),
        joinedload(JobRosterEntry.ip_user),
    )


def _day_entries(db: Session, entry: JobRosterEntry) -> list[JobRosterEntry]:
    """Every slot this IP works on this job that day, earliest first."""
    return (
        _entry_query(db)
        .filter(
            JobRosterEntry.job_id == entry.job_id,
            JobRosterEntry.ip_user_id == entry.ip_user_id,
            JobRosterEntry.work_date == entry.work_date,
        )
        .order_by(JobRosterEntry.slot_number)
        .all()
    )


def visit_payload(entry: JobRosterEntry) -> dict:
    """The four body values both templates take, plus who to send them to."""
    job = entry.job
    customer = job.customer
    ip_user = entry.ip_user
    return {
        "customer_phone": customer.phone_number if customer else None,
        "customer_name": customer.name if customer else "Customer",
        "ip_name": " ".join(
            part for part in (ip_user.first_name, ip_user.last_name) if part
        )
        or (ip_user.phone_number or "Your technician"),
        "job_type": job_type_label(job.type),
        "ip_phone": ip_user.phone_number,
        "work_date": entry.work_date,
    }


def _claim(db: Session, entries: list[JobRosterEntry], field: str) -> bool:
    """Stamp the whole visit, but only while every slot of it is still unstamped.

    The stamp is the flag, and claiming it before the send is what makes one send the
    only send: a second sweep - the cron and a NOTIFY landing together, or another
    worker's listener - updates no rows and gives up here instead of messaging twice.
    """
    ids = [entry.id for entry in entries]
    claimed = (
        db.execute(
            update(JobRosterEntry)
            .where(JobRosterEntry.id.in_(ids), getattr(JobRosterEntry, field).is_(None))
            .values({field: now_ist()})
            .returning(JobRosterEntry.id)
        )
        .scalars()
        .all()
    )
    db.commit()
    return len(claimed) == len(ids)


def _record_attempt(
    db: Session, entries: list[JobRosterEntry], field: str, queued: bool
) -> None:
    """Keep the claim permanent and expose whether Interakt accepted the request."""
    status_field = "notified_status" if field == "notified_at" else "reminder_status"
    db.execute(
        update(JobRosterEntry)
        .where(JobRosterEntry.id.in_([entry.id for entry in entries]))
        .values({status_field: "queued" if queued else "not_queued"})
    )
    db.commit()


def notify_assignment(db: Session, entry: JobRosterEntry) -> bool:
    """Tell the customer who is coming and when. Once per job, IP and date."""
    day = _day_entries(db, entry) or [entry]
    if not _claim(db, day, "notified_at"):
        return False
    queued = send_ip_visit_notification(
        **visit_payload(day[0]), callback_ref=f"{day[0].id}:assignment"
    )
    _record_attempt(db, day, "notified_at", queued)
    return queued


def send_pending_assignments(db: Session) -> int:
    """Notices for visits scheduled outside a request - a job assigned its IP."""
    today = now_ist().date()
    pending = (
        _entry_query(db)
        .join(Job, Job.id == JobRosterEntry.job_id)
        .filter(
            JobRosterEntry.notified_at.is_(None),
            JobRosterEntry.work_date >= today,
            Job.status.in_(ACTIVE_JOB_STATUSES),
        )
        .order_by(JobRosterEntry.work_date, JobRosterEntry.slot_number)
        .all()
    )
    seen: set[tuple[int, int, object]] = set()
    sent = 0
    for entry in pending:
        key = (entry.job_id, entry.ip_user_id, entry.work_date)
        if key in seen:
            continue
        seen.add(key)
        if notify_assignment(db, entry):
            sent += 1
    return sent


def send_due_reminders(db: Session) -> int:
    """The hour-before nudge, for visits whose first slot starts within the lead time."""
    now = now_ist()
    today = now.date()
    due = (
        _entry_query(db)
        .join(Job, Job.id == JobRosterEntry.job_id)
        .filter(
            JobRosterEntry.reminder_sent_at.is_(None),
            JobRosterEntry.work_date == today,
            Job.status.in_(ACTIVE_JOB_STATUSES),
        )
        .order_by(JobRosterEntry.slot_number)
        .all()
    )
    sent = 0
    seen: set[tuple[int, int, object]] = set()
    for entry in due:
        key = (entry.job_id, entry.ip_user_id, entry.work_date)
        if key in seen:
            continue
        day = _day_entries(db, entry)
        starts_at = datetime.combine(
            entry.work_date, day[0].slot_start, tzinfo=ATTENDANCE_TIMEZONE
        )
        if not now <= starts_at <= now + REMINDER_LEAD:
            continue
        seen.add(key)
        if not _claim(db, day, "reminder_sent_at"):
            continue
        queued = send_ip_visit_notification(
            **visit_payload(day[0]),
            template_name=settings.INTERAKT_REMINDER_TEMPLATE_NAME,
            callback_ref=f"{day[0].id}:reminder",
        )
        _record_attempt(db, day, "reminder_sent_at", queued)
        if queued:
            sent += 1
    return sent


def run_visit_notifications() -> None:
    """Scheduler entrypoint - runs outside the request lifecycle, owns its session."""
    try:
        with SessionLocal() as db:
            assignments = send_pending_assignments(db)
            reminders = send_due_reminders(db)
            if assignments or reminders:
                logger.info(
                    "Visit notification sweep queued assignments=%d reminders=%d",
                    assignments,
                    reminders,
                )
    except Exception as exc:
        logger.exception("Visit notification sweep failed: %s", exc)
