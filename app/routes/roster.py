from datetime import date, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_fully_verified_user
from app.core.security import get_current_user
from app.crud.job import sync_job_roster_defaults
from app.database import get_db
from app.model.attendance import DailyAttendance
from app.model.ip import IPAdminAssignment, ip
from app.model.job import Job
from app.model.roster import JobRosterEntry, RosterSlotSetting
from app.model.user import User
from app.utils.attendance_policy import now_ist, slot_check_in_window
from app.utils.ip_assignment import is_admin_allowed_for_ip
from app.utils.roster_day import roster_entry_window

admin_router = APIRouter(prefix="/admin/roster", tags=["Admin Roster"])
ip_router = APIRouter(prefix="/dashboard/roster", tags=["Dashboard Roster"])


class RosterEntryCreate(BaseModel):
    job_id: int = Field(gt=0)
    ip_user_id: int = Field(gt=0)
    work_date: date
    slot_number: int = Field(ge=1, le=2)


class RosterEntryUpdate(BaseModel):
    ip_user_id: int = Field(gt=0)


class RosterSlotUpdate(BaseModel):
    start_time: time
    end_time: time

    @model_validator(mode="after")
    def validate_order(self):
        if self.end_time <= self.start_time:
            raise ValueError("Slot end must be after slot start")
        return self


def _date_range(date_from: date | None, date_to: date | None) -> tuple[date, date]:
    start = date_from or now_ist().date()
    end = date_to or start + timedelta(days=6)
    if end < start:
        raise HTTPException(
            status_code=422, detail="date_to must be on or after date_from"
        )
    if (end - start).days > 41:
        raise HTTPException(
            status_code=422, detail="Roster range cannot exceed 42 days"
        )
    return start, end


def _job_query(db: Session, current_user: User):
    query = db.query(Job).options(joinedload(Job.customer))
    if not current_user.is_superadmin:
        query = query.filter(Job.admin_assigned == current_user.id)
    return query


def _ip_query(db: Session, admin_id: int):
    return (
        db.query(ip)
        .join(IPAdminAssignment)
        .filter(
            ip.is_id_verified.is_(True),
            IPAdminAssignment.admin_id == admin_id,
        )
        .distinct()
    )


def _slot_payload(slot: RosterSlotSetting) -> dict:
    return {
        "slot_number": slot.slot_number,
        "start_time": slot.start_time.isoformat(timespec="minutes"),
        "end_time": slot.end_time.isoformat(timespec="minutes"),
    }


def _job_payload(job: Job) -> dict:
    return {
        "id": job.id,
        "name": job.name or f"Job #{job.id}",
        "type": job.type,
        "status": job.status,
        "customer_city": job.city,
        "start_date": job.start_date,
        "delivery_date": job.delivery_date,
        "slot_start": job.slot_start.isoformat(timespec="minutes")
        if job.slot_start
        else None,
        "slot_end": job.slot_end.isoformat(timespec="minutes")
        if job.slot_end
        else None,
        "assigned_ip_id": job.assigned_ip_id,
        "assigned_ip_name": (
            " ".join(
                part
                for part in (job.assigned_ip.first_name, job.assigned_ip.last_name)
                if part
            )
            or job.assigned_ip.phone_number
        )
        if job.assigned_ip
        else None,
    }


def _ip_payload(ip_user: ip) -> dict:
    return {
        "id": ip_user.id,
        "name": " ".join(
            part for part in (ip_user.first_name, ip_user.last_name) if part
        )
        or ip_user.phone_number,
        "phone_number": ip_user.phone_number,
        "city": ip_user.city,
    }


def _validated_roster_ip(db: Session, job: Job, ip_user_id: int) -> ip:
    ip_user = db.get(ip, ip_user_id)
    if not ip_user:
        raise HTTPException(status_code=404, detail="IP not found")
    if not ip_user.is_id_verified:
        raise HTTPException(status_code=409, detail="Only verified IPs can be rostered")
    if not job.admin_assigned or not is_admin_allowed_for_ip(
        db, ip_user.id, job.admin_assigned
    ):
        raise HTTPException(
            status_code=409,
            detail="The IP is not mapped to this job's supervisor",
        )
    return ip_user


def _entry_status(
    entry: JobRosterEntry,
    attendance: list[DailyAttendance],
    span: list[JobRosterEntry],
) -> str:
    """Status of the DAY this entry belongs to. A job holding both slots is one visit:
    the IP checks in during the first half, so the second half mirrors it rather than
    reporting its own missed check-in."""
    check_in = next(
        (row for row in attendance if row.attendance_type == "check_in"), None
    )
    check_out = next(
        (row for row in attendance if row.attendance_type == "check_out"), None
    )
    now = now_ist()
    today = now.date()
    span_start, span_end = span[0].slot_start, span[-1].slot_end
    if check_out:
        return "auto_closed" if check_out.checkout_source == "auto" else "completed"
    if check_in:
        # The slot end only reads as "not yet" on the day itself; an older open check-in
        # is always overdue, whatever the clock says right now.
        overdue = entry.work_date < today or now.time() >= span_end
        return "report_due" if overdue else "checked_in"
    if entry.job.status != "in_progress":
        return "blocked"
    if entry.work_date < today:
        return "missed"
    if entry.work_date > today:
        return "scheduled"
    window_start, window_end = slot_check_in_window(span_start)
    if window_start <= now.time() <= window_end:
        return "check_in_open"
    return "scheduled" if now.time() < window_start else "missed"


def _serialize_entries(db: Session, entries: list[JobRosterEntry]) -> list[dict]:
    entry_ids = [entry.id for entry in entries]
    attendance_by_entry: dict[int, list[DailyAttendance]] = {}
    if entry_ids:
        for row in db.query(DailyAttendance).filter(
            DailyAttendance.roster_entry_id.in_(entry_ids)
        ):
            attendance_by_entry.setdefault(row.roster_entry_id, []).append(row)
    # One IP on one job for one date is a single visit however many slots it spans, so
    # the whole span shares the attendance recorded against its first half.
    spans: dict[tuple[int, int, date], list[JobRosterEntry]] = {}
    for entry in entries:
        spans.setdefault((entry.ip_user_id, entry.job_id, entry.work_date), []).append(
            entry
        )
    for span in spans.values():
        span.sort(key=lambda item: item.slot_number)
    return [
        {
            "id": entry.id,
            "job_id": entry.job_id,
            "ip_user_id": entry.ip_user_id,
            "work_date": entry.work_date,
            "slot_number": entry.slot_number,
            "slot_start": entry.slot_start.isoformat(timespec="minutes"),
            "slot_end": entry.slot_end.isoformat(timespec="minutes"),
            "is_job_default": entry.is_job_default,
            # The whole day marks attendance once, on this entry, in the first half.
            "attendance_entry_id": spans[
                (entry.ip_user_id, entry.job_id, entry.work_date)
            ][0].id,
            "status": _entry_status(
                entry,
                attendance_by_entry.get(
                    spans[(entry.ip_user_id, entry.job_id, entry.work_date)][0].id, []
                ),
                spans[(entry.ip_user_id, entry.job_id, entry.work_date)],
            ),
            "job": _job_payload(entry.job),
            "ip": _ip_payload(entry.ip_user),
        }
        for entry in entries
    ]


@admin_router.get("")
def get_admin_roster(
    admin_id: int | None = Query(default=None, gt=0),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    start, end = _date_range(date_from, date_to)
    supervisors = (
        db.query(User)
        .filter(
            User.is_superadmin.is_(False),
            User.is_active.is_(True),
            User.is_approved.is_(True),
        )
        .order_by(User.name, User.email)
        .all()
    )
    if current_user.is_superadmin:
        selected_admin_id = admin_id or (supervisors[0].id if supervisors else None)
        if selected_admin_id and not any(
            item.id == selected_admin_id for item in supervisors
        ):
            raise HTTPException(status_code=404, detail="Supervisor not found")
    else:
        if admin_id is not None and admin_id != current_user.id:
            raise HTTPException(
                status_code=403, detail="Admins can only view their own roster"
            )
        selected_admin_id = current_user.id

    jobs = (
        db.query(Job)
        .options(joinedload(Job.customer), joinedload(Job.assigned_ip))
        .filter(Job.admin_assigned == selected_admin_id)
        .all()
        if selected_admin_id
        else []
    )
    mapped_ips = _ip_query(db, selected_admin_id).all() if selected_admin_id else []

    entries = (
        db.query(JobRosterEntry)
        .options(
            joinedload(JobRosterEntry.job).joinedload(Job.customer),
            joinedload(JobRosterEntry.ip_user),
        )
        .filter(
            JobRosterEntry.job_id.in_([job.id for job in jobs] or [-1]),
            JobRosterEntry.work_date.between(start, end),
        )
        .order_by(JobRosterEntry.work_date, JobRosterEntry.slot_number)
        .all()
    )
    # A job already booked in this window stays on the grid even when its dates no longer
    # overlap it, otherwise the booking is invisible but still holds the IP's slot.
    scheduled_job_ids = {entry.job_id for entry in entries}
    roster_jobs = [
        job
        for job in jobs
        if job.id in scheduled_job_ids
        or (
            (job.start_date is None or job.start_date <= end)
            and (job.delivery_date is None or job.delivery_date >= start)
        )
    ]
    return {
        "date_from": start,
        "date_to": end,
        "admins": [
            {"id": item.id, "name": item.name or item.email, "email": item.email}
            for item in supervisors
        ]
        if current_user.is_superadmin
        else [],
        "selected_admin_id": selected_admin_id,
        "slots": [
            _slot_payload(slot)
            for slot in db.query(RosterSlotSetting).order_by(
                RosterSlotSetting.slot_number
            )
        ],
        "jobs": [_job_payload(job) for job in roster_jobs],
        "ips": [_ip_payload(ip_user) for ip_user in mapped_ips],
        "entries": _serialize_entries(db, entries),
    }


@admin_router.post("/entries", status_code=201)
def create_roster_entry(
    payload: RosterEntryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = _job_query(db, current_user).filter(Job.id == payload.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found in your admin scope")
    ip_user = _validated_roster_ip(db, job, payload.ip_user_id)
    if job.status not in {"created", "in_progress", "paused"}:
        raise HTTPException(
            status_code=409,
            detail=f"A {job.status.replace('_', ' ')} job cannot be scheduled",
        )
    if payload.work_date < now_ist().date():
        raise HTTPException(
            status_code=409, detail="Past roster dates cannot be changed"
        )
    if job.start_date and payload.work_date < job.start_date:
        raise HTTPException(
            status_code=409, detail="Roster date is before the job start date"
        )
    if job.delivery_date and payload.work_date > job.delivery_date:
        raise HTTPException(
            status_code=409, detail="Roster date is after the job delivery date"
        )
    slot = db.get(RosterSlotSetting, payload.slot_number)
    if not slot:
        raise HTTPException(
            status_code=409, detail="Roster slot settings are incomplete"
        )

    slot_start, slot_end = roster_entry_window(job, slot)
    entry = JobRosterEntry(
        **payload.model_dump(),
        slot_start=slot_start,
        slot_end=slot_end,
        created_by_admin_id=current_user.id,
    )
    # The direct job assignment is the default IP. A dated roster row may deliberately
    # override it for one visit without reassigning every other day on the job.
    assigned_default = job.assigned_ip_id is None
    if assigned_default:
        job.assigned_ip_id = ip_user.id
        if job.status == "in_progress":
            ip_user.is_assigned = True
    db.add(entry)
    if assigned_default:
        sync_job_roster_defaults(db, job, current_user.id)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="That IP or job is already assigned in this day and slot.",
        ) from exc
    entry = (
        db.query(JobRosterEntry)
        .options(
            joinedload(JobRosterEntry.job).joinedload(Job.customer),
            joinedload(JobRosterEntry.ip_user),
        )
        .filter(JobRosterEntry.id == entry.id)
        .one()
    )
    return _serialize_entries(db, [entry])[0]


@admin_router.put("/entries/{entry_id}")
def replace_roster_entry_ip(
    entry_id: int,
    payload: RosterEntryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Swap one stored day/slot without changing the job's default IP."""
    entry = (
        db.query(JobRosterEntry)
        .options(
            joinedload(JobRosterEntry.job).joinedload(Job.customer),
            joinedload(JobRosterEntry.ip_user),
        )
        .filter(JobRosterEntry.id == entry_id)
        .first()
    )
    if not entry or (
        not current_user.is_superadmin and entry.job.admin_assigned != current_user.id
    ):
        raise HTTPException(
            status_code=404, detail="Roster entry not found in your admin scope"
        )
    if entry.ip_user_id == payload.ip_user_id:
        return _serialize_entries(db, [entry])[0]
    if entry.job.status not in {"created", "in_progress", "paused"}:
        raise HTTPException(
            status_code=409,
            detail=f"A {entry.job.status.replace('_', ' ')} job cannot be rescheduled",
        )
    if entry.work_date < now_ist().date():
        raise HTTPException(
            status_code=409, detail="Past roster entries cannot be changed"
        )
    if (
        db.query(DailyAttendance.id)
        .filter(DailyAttendance.roster_entry_id == entry.id)
        .first()
    ):
        raise HTTPException(
            status_code=409,
            detail="This slot cannot be swapped after attendance has been recorded",
        )

    _validated_roster_ip(db, entry.job, payload.ip_user_id)
    conflict = (
        db.query(JobRosterEntry.id)
        .filter(
            JobRosterEntry.id != entry.id,
            JobRosterEntry.ip_user_id == payload.ip_user_id,
            JobRosterEntry.work_date == entry.work_date,
            JobRosterEntry.slot_number == entry.slot_number,
        )
        .first()
    )
    if conflict:
        raise HTTPException(
            status_code=409,
            detail="That IP is already assigned in this day and slot.",
        )

    entry.ip_user_id = payload.ip_user_id
    entry.is_job_default = False
    entry.notified_at = None
    entry.reminder_sent_at = None
    entry.notified_status = None
    entry.reminder_status = None
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="That IP is already assigned in this day and slot.",
        ) from exc
    entry = (
        db.query(JobRosterEntry)
        .options(
            joinedload(JobRosterEntry.job).joinedload(Job.customer),
            joinedload(JobRosterEntry.ip_user),
        )
        .filter(JobRosterEntry.id == entry_id)
        .one()
    )
    return _serialize_entries(db, [entry])[0]


@admin_router.delete("/entries/{entry_id}", status_code=204)
def delete_roster_entry(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = (
        db.query(JobRosterEntry)
        .options(joinedload(JobRosterEntry.job))
        .filter(JobRosterEntry.id == entry_id)
        .first()
    )
    if not entry or (
        not current_user.is_superadmin and entry.job.admin_assigned != current_user.id
    ):
        raise HTTPException(
            status_code=404, detail="Roster entry not found in your admin scope"
        )
    if entry.work_date < now_ist().date():
        raise HTTPException(
            status_code=409, detail="Past roster entries cannot be removed"
        )
    if (
        db.query(DailyAttendance.id)
        .filter(DailyAttendance.roster_entry_id == entry.id)
        .first()
    ):
        raise HTTPException(
            status_code=409, detail="Attendance already exists for this roster entry"
        )
    # The job keeps its IP: dated rows mirror the assignment, they do not own it.
    # Dropping the last day means "nothing scheduled yet", not "unassigned".
    db.delete(entry)
    db.commit()


@admin_router.put("/slots/{slot_number}")
def update_roster_slot(
    slot_number: int,
    payload: RosterSlotUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.is_superadmin:
        raise HTTPException(
            status_code=403, detail="Only a superadmin can change global roster hours"
        )
    if slot_number not in (1, 2):
        raise HTTPException(status_code=404, detail="Only roster slots 1 and 2 exist")
    slot = db.get(RosterSlotSetting, slot_number)
    other = db.get(RosterSlotSetting, 2 if slot_number == 1 else 1)
    if not slot or not other:
        raise HTTPException(
            status_code=409, detail="Roster slot settings are incomplete"
        )
    if (slot_number == 1 and payload.end_time > other.start_time) or (
        slot_number == 2 and payload.start_time < other.end_time
    ):
        raise HTTPException(
            status_code=409, detail="The two roster slots cannot overlap"
        )
    slot.start_time = payload.start_time
    slot.end_time = payload.end_time
    slot.updated_by_admin_id = current_user.id
    db.commit()
    db.refresh(slot)
    return _slot_payload(slot)


@ip_router.get("")
def get_my_roster(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    current_user: ip = Depends(get_fully_verified_user),
    db: Session = Depends(get_db),
):
    start, end = _date_range(date_from, date_to)
    entries = (
        db.query(JobRosterEntry)
        .options(
            joinedload(JobRosterEntry.job).joinedload(Job.customer),
            joinedload(JobRosterEntry.ip_user),
        )
        .filter(
            JobRosterEntry.ip_user_id == current_user.id,
            JobRosterEntry.work_date.between(start, end),
        )
        .order_by(JobRosterEntry.work_date, JobRosterEntry.slot_number)
        .all()
    )
    return {
        "date_from": start,
        "date_to": end,
        "slots": [
            _slot_payload(slot)
            for slot in db.query(RosterSlotSetting).order_by(
                RosterSlotSetting.slot_number
            )
        ],
        "entries": _serialize_entries(db, entries),
    }
