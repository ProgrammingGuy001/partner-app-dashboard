from datetime import date, datetime, time, timedelta

from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session

import app.model  # noqa: F401 - register every referenced table
from app.database import Base
from app.model.ip import IPAdminAssignment, ip
from app.model.job import Customer, Job
from app.model.roster import JobRosterEntry, RosterSlotSetting
from app.model.user import User
from app.routes.roster import RosterEntryUpdate, replace_roster_entry_ip


@compiles(ARRAY, "sqlite")
def compile_array_for_sqlite(_type, _compiler, **_kwargs):
    return "JSON"


def test_roster_swap_changes_only_the_dated_slot():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as db:
        supervisor = User(email="admin@example.com", is_active=True, is_approved=True)
        first = ip(phone_number="9000000001", first_name="First", is_id_verified=True)
        replacement = ip(
            phone_number="9000000002", first_name="Replacement", is_id_verified=True
        )
        customer = Customer(name="Customer", phone_number="9000000003")
        db.add_all([supervisor, first, replacement, customer])
        db.flush()
        db.add_all(
            [
                IPAdminAssignment(ip_id=first.id, admin_id=supervisor.id),
                IPAdminAssignment(ip_id=replacement.id, admin_id=supervisor.id),
                RosterSlotSetting(
                    slot_number=1, start_time=time(10), end_time=time(14)
                ),
            ]
        )
        job = Job(
            customer_id=customer.id,
            admin_assigned=supervisor.id,
            assigned_ip_id=first.id,
            status="created",
            delivery_date=date.today() + timedelta(days=2),
        )
        db.add(job)
        db.flush()
        entry = JobRosterEntry(
            job_id=job.id,
            ip_user_id=first.id,
            work_date=date.today() + timedelta(days=1),
            slot_number=1,
            slot_start=time(10),
            slot_end=time(14),
            created_by_admin_id=supervisor.id,
            is_job_default=True,
            notified_at=datetime.now().astimezone(),
            reminder_sent_at=datetime.now().astimezone(),
            notified_status="delivered",
            reminder_status="read",
        )
        db.add(entry)
        db.commit()

        result = replace_roster_entry_ip(
            entry.id,
            RosterEntryUpdate(ip_user_id=replacement.id),
            supervisor,
            db,
        )

        assert result["ip_user_id"] == replacement.id
        assert result["is_job_default"] is False
        assert db.get(Job, job.id).assigned_ip_id == first.id
        swapped = db.get(JobRosterEntry, entry.id)
        assert swapped.notified_at is None
        assert swapped.reminder_sent_at is None
        assert swapped.notified_status is None
        assert swapped.reminder_status is None
