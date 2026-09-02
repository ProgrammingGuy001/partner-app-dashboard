"""A rostered day, not a rostered slot.

A job can occupy both slots of one day for the same IP - an installation runs the
full eight hours. That is still ONE visit: the IP checks in during the first half
and closes at the end of the last slot. These helpers answer "what does this IP's
day on this job look like" so the attendance window, the report cutoff and the
roster grid all read it the same way.
"""
from datetime import date, time

from sqlalchemy import func
from sqlalchemy.orm import Session, aliased

from app.model.roster import JobRosterEntry
from app.utils.job_documents import normalize_job_type


def roster_entry_window(job, slot) -> tuple[time, time]:
    """Use a job's service time; installation alone follows the global shift."""
    if normalize_job_type(job.type) != "installation" and job.slot_start and job.slot_end:
        return job.slot_start, job.slot_end
    return slot.start_time, slot.end_time


def day_entries(
    db: Session, *, ip_user_id: int, job_id: int, work_date: date
) -> list[JobRosterEntry]:
    """Every slot this IP works on this job that day, earliest slot first."""
    return (
        db.query(JobRosterEntry)
        .filter(
            JobRosterEntry.ip_user_id == ip_user_id,
            JobRosterEntry.job_id == job_id,
            JobRosterEntry.work_date == work_date,
        )
        .order_by(JobRosterEntry.slot_number)
        .all()
    )


def day_window(entries: list[JobRosterEntry]) -> tuple[time, time]:
    """Check-in opens with the first slot; the day is not over until the last one ends."""
    return entries[0].slot_start, entries[-1].slot_end


def day_end_by_entry(db: Session, entry_ids) -> dict[int, time]:
    """Map each entry id to the end of ITS day, not the end of its own slot.

    A check-in recorded against the first half of a two-slot day is not overdue at
    14:00; it is overdue when the second slot ends.
    """
    entry_ids = [entry_id for entry_id in entry_ids if entry_id]
    if not entry_ids:
        return {}
    sibling = aliased(JobRosterEntry)
    rows = (
        db.query(JobRosterEntry.id, func.max(sibling.slot_end))
        .join(
            sibling,
            (sibling.ip_user_id == JobRosterEntry.ip_user_id)
            & (sibling.job_id == JobRosterEntry.job_id)
            & (sibling.work_date == JobRosterEntry.work_date),
        )
        .filter(JobRosterEntry.id.in_(entry_ids))
        .group_by(JobRosterEntry.id)
        .all()
    )
    return dict(rows)
