from datetime import date, datetime, time
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session

import app.model  # noqa: F401 - register every referenced table
from app.crud.ip import unassign_ip
from app.crud.job import sync_job_roster_defaults
from app.database import Base
from app.model.ip import IPAdminAssignment, ip
from app.model.job import Customer, Job
from app.model.roster import JobRosterEntry, RosterSlotSetting
from app.model.user import User
from app.routes.roster import get_admin_roster, get_my_roster
from app.utils.attendance_policy import ATTENDANCE_TIMEZONE


@compiles(ARRAY, "sqlite")
def compile_array_for_sqlite(_type, _compiler, **_kwargs):
    return "JSON"


def test_job_assignment_is_the_same_persisted_schedule_in_both_rosters():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        supervisor = User(
            email="supervisor@example.com", is_active=True, is_approved=True
        )
        worker = ip(phone_number="9000000001", first_name="Asha", is_id_verified=True)
        customer = Customer(name="Customer")
        db.add_all([supervisor, worker, customer])
        db.flush()
        job = Job(
            customer_id=customer.id,
            admin_assigned=supervisor.id,
            assigned_ip_id=worker.id,
            job_type="installation",
            status="created",
            start_date=date(2026, 8, 25),
            delivery_date=date(2026, 8, 26),
        )
        db.add_all(
            [
                job,
                IPAdminAssignment(admin_id=supervisor.id, ip_id=worker.id),
                RosterSlotSetting(
                    slot_number=1, start_time=time(10), end_time=time(14)
                ),
                RosterSlotSetting(
                    slot_number=2, start_time=time(15), end_time=time(18)
                ),
            ]
        )
        db.flush()

        fixed_now = datetime(2026, 8, 24, 9, tzinfo=ATTENDANCE_TIMEZONE)
        with patch("app.crud.job.now_ist", return_value=fixed_now):
            sync_job_roster_defaults(db, job, supervisor.id)
            db.commit()
        with patch("app.routes.roster.now_ist", return_value=fixed_now):
            admin_roster = get_admin_roster(
                admin_id=None,
                date_from=date(2026, 8, 25),
                date_to=date(2026, 8, 26),
                current_user=supervisor,
                db=db,
            )
            ip_roster = get_my_roster(
                date_from=date(2026, 8, 25),
                date_to=date(2026, 8, 26),
                current_user=worker,
                db=db,
            )

        admin_entries = admin_roster["entries"]
        assert [entry["id"] for entry in admin_entries] == [
            entry["id"] for entry in ip_roster["entries"]
        ]
        assert len(admin_entries) == 4
        assert all(entry["is_job_default"] for entry in admin_entries)
        assert [
            (entry["slot_start"], entry["slot_end"]) for entry in admin_entries[:2]
        ] == [
            ("10:00", "14:00"),
            ("15:00", "18:00"),
        ]

        stamp = datetime(2026, 8, 24, 9, tzinfo=ATTENDANCE_TIMEZONE)
        for entry in db.query(JobRosterEntry):
            entry.notified_at = stamp
            entry.reminder_sent_at = stamp
            entry.notified_status = "delivered"
            entry.reminder_status = "read"
        db.commit()
        with patch("app.crud.job.now_ist", return_value=fixed_now):
            sync_job_roster_defaults(db, job, supervisor.id)
            db.commit()
        preserved = db.query(JobRosterEntry).all()
        assert all(
            entry.notified_at is not None
            and entry.reminder_sent_at is not None
            and entry.notified_status == "delivered"
            and entry.reminder_status == "read"
            for entry in preserved
        )

        job.job_type = "measurement"
        job.slot_start = time(19)
        job.slot_end = time(20)
        with patch("app.crud.job.now_ist", return_value=fixed_now):
            sync_job_roster_defaults(db, job, supervisor.id)
            db.commit()

        entries = db.query(JobRosterEntry).order_by(JobRosterEntry.work_date).all()
        assert len(entries) == 2
        assert all(
            (entry.slot_start, entry.slot_end) == (time(19), time(20))
            for entry in entries
        )
        assert all(entry.slot_number == 2 for entry in entries)


def test_job_assignment_uses_date_and_slot_instead_of_global_ip_status():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        supervisor = User(
            email="supervisor@example.com", is_active=True, is_approved=True
        )
        worker = ip(phone_number="9000000001", is_id_verified=True, is_assigned=True)
        customer = Customer(name="Customer")
        db.add_all([supervisor, worker, customer])
        db.flush()
        jobs = [
            Job(
                customer_id=customer.id,
                admin_assigned=supervisor.id,
                assigned_ip_id=worker.id,
                job_type="measurement",
                status="created",
                start_date=date(2026, 8, 25),
                delivery_date=date(2026, 8, 25),
                slot_start=slot_start,
                slot_end=slot_end,
            )
            for slot_start, slot_end in (
                (time(10), time(14)),
                (time(15), time(18)),
                (time(10), time(14)),
            )
        ]
        db.add_all(
            [
                *jobs,
                IPAdminAssignment(admin_id=supervisor.id, ip_id=worker.id),
                RosterSlotSetting(
                    slot_number=1, start_time=time(10), end_time=time(14)
                ),
                RosterSlotSetting(
                    slot_number=2, start_time=time(15), end_time=time(18)
                ),
            ]
        )
        db.flush()

        fixed_now = datetime(2026, 8, 24, 9, tzinfo=ATTENDANCE_TIMEZONE)
        with patch("app.crud.job.now_ist", return_value=fixed_now):
            sync_job_roster_defaults(db, jobs[0], supervisor.id)
            sync_job_roster_defaults(db, jobs[1], supervisor.id)
            with pytest.raises(HTTPException, match="already on Job"):
                sync_job_roster_defaults(db, jobs[2], supervisor.id)

        entries = db.query(JobRosterEntry).order_by(JobRosterEntry.slot_number).all()
        assert [(entry.job_id, entry.slot_number) for entry in entries] == [
            (jobs[0].id, 1),
            (jobs[1].id, 2),
        ]

        jobs[0].status = "in_progress"
        jobs[1].status = "in_progress"
        unassign_ip(
            db,
            worker.id,
            supervisor.id,
            commit=False,
            excluding_job_id=jobs[0].id,
        )
        assert worker.is_assigned is True

        jobs[0].status = "paused"
        unassign_ip(
            db,
            worker.id,
            supervisor.id,
            commit=False,
            excluding_job_id=jobs[1].id,
        )
        assert worker.is_assigned is False
