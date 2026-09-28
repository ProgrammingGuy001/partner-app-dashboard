from datetime import date, time

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session

import app.model  # noqa: F401 - register every referenced table
from app.crud.job import _validate_ip_for_supervisor, create_job, update_job
from app.database import Base
from app.model.ip import IPAdminAssignment, ip
from app.model.job import Customer, Job
from app.model.roster import JobRosterEntry, RosterSlotSetting
from app.model.user import User
from app.schemas.job import JobCreate, JobUpdate


@compiles(ARRAY, "sqlite")
def compile_array_for_sqlite(_type, _compiler, **_kwargs):
    return "JSON"


def _session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def _admins(db: Session) -> tuple[User, User]:
    supervisor = User(
        email="supervisor@example.com", is_active=True, is_approved=True
    )
    superadmin = User(
        email="boss@example.com",
        is_superadmin=True,
        is_active=True,
        is_approved=True,
    )
    db.add_all([supervisor, superadmin])
    db.commit()
    return supervisor, superadmin


def test_job_ip_must_be_mapped_but_global_active_status_does_not_block_it():
    with _session() as db:
        supervisor, _ = _admins(db)
        mapped = ip(phone_number="9000000001", is_id_verified=True)
        unmapped = ip(phone_number="9000000002", is_id_verified=True)
        db.add_all([mapped, unmapped])
        db.flush()
        db.add(IPAdminAssignment(admin_id=supervisor.id, ip_id=mapped.id))
        db.commit()

        assert _validate_ip_for_supervisor(db, mapped.id, supervisor.id).id == mapped.id

        try:
            _validate_ip_for_supervisor(db, unmapped.id, supervisor.id)
        except HTTPException as exc:
            assert exc.status_code == 403
        else:
            raise AssertionError("unmapped IP was accepted")

        mapped.is_assigned = True
        db.commit()
        assert _validate_ip_for_supervisor(db, mapped.id, supervisor.id).id == mapped.id


def _job_with_external_ip(supervisor_id: int) -> JobCreate:
    return JobCreate(
        customer_name="Acme Interiors",
        address_line_1="12 Main St",
        city="Pune",
        state="MH",
        pincode=411001,
        type="grn",
        delivery_date="2026-10-01",
        admin_assigned=supervisor_id,
        external_ip={"name": "Ravi Kumar", "phone_number": "+91 98765 43210"},
    )


def test_superadmin_can_create_map_and_assign_an_external_ip_with_the_job():
    with _session() as db:
        supervisor, superadmin = _admins(db)

        job = create_job(
            db,
            _job_with_external_ip(supervisor.id),
            user_id=superadmin.id,
            is_superadmin=True,
        )

        external_ip = db.get(ip, job.assigned_ip_id)
        assert external_ip is not None
        assert (external_ip.first_name, external_ip.last_name) == ("Ravi", "Kumar")
        assert external_ip.phone_number == "919876543210"
        assert external_ip.is_internal is False
        assert external_ip.is_id_verified is True
        assert db.query(IPAdminAssignment).filter_by(
            ip_id=external_ip.id, admin_id=supervisor.id
        ).count() == 1

        second_job = create_job(
            db,
            _job_with_external_ip(supervisor.id),
            user_id=superadmin.id,
            is_superadmin=True,
        )
        assert second_job.assigned_ip_id == external_ip.id
        assert db.query(ip).filter_by(phone_number="919876543210").count() == 1


def test_regular_admin_cannot_add_an_external_ip_with_a_job():
    with _session() as db:
        supervisor, _ = _admins(db)

        with pytest.raises(HTTPException) as error:
            create_job(
                db,
                _job_with_external_ip(supervisor.id),
                user_id=supervisor.id,
                is_superadmin=False,
            )
        assert error.value.status_code == 403


def test_external_ip_cannot_relabel_an_internal_contact():
    with _session() as db:
        supervisor, superadmin = _admins(db)
        internal_ip = ip(
            phone_number="919876543210",
            first_name="Internal",
            last_name="Employee",
            is_internal=True,
            is_id_verified=True,
        )
        db.add(internal_ip)
        db.commit()

        with pytest.raises(HTTPException) as error:
            create_job(
                db,
                _job_with_external_ip(supervisor.id),
                user_id=superadmin.id,
                is_superadmin=True,
            )
        assert error.value.status_code == 409


def test_external_ip_requires_a_job_supervisor():
    with _session() as db:
        _, superadmin = _admins(db)
        job = Job(status="created", job_type="grn", delivery_date=date(2026, 10, 1))
        db.add(job)
        db.commit()

        with pytest.raises(HTTPException) as error:
            update_job(
                db,
                job.id,
                JobUpdate(
                    external_ip={"name": "Ravi Kumar", "phone_number": "9876543210"}
                ),
                admin_id=superadmin.id,
                is_superadmin=True,
            )
        assert error.value.status_code == 400


def test_adding_an_external_ip_to_an_existing_job_updates_its_roster():
    with _session() as db:
        supervisor, superadmin = _admins(db)
        job = Job(
            status="created",
            job_type="grn",
            admin_assigned=supervisor.id,
            start_date=date(2026, 10, 1),
            delivery_date=date(2026, 10, 1),
        )
        db.add_all(
            [
                job,
                RosterSlotSetting(
                    slot_number=1, start_time=time(10), end_time=time(14)
                ),
            ]
        )
        db.commit()

        updated = update_job(
            db,
            job.id,
            JobUpdate(
                external_ip={"name": "Ravi Kumar", "phone_number": "9876543210"}
            ),
            admin_id=superadmin.id,
            is_superadmin=True,
        )

        entry = db.query(JobRosterEntry).filter_by(job_id=job.id).one()
        assert entry.ip_user_id == updated.assigned_ip_id


def test_superadmin_can_edit_the_existing_customer_attached_to_a_job():
    with _session() as db:
        supervisor, superadmin = _admins(db)
        customer = Customer(
            name="Webhook Lead",
            phone_number="919000000001",
            address_line_1="Old address",
            city="Pune",
            state="MH",
            pincode=411001,
        )
        job = Job(
            customer=customer,
            status="pending_approval",
            job_type="grn",
            admin_assigned=supervisor.id,
            crm_lead_id=42,
            crm_stage_id=16,
        )
        db.add(job)
        db.commit()

        updated = update_job(
            db,
            job.id,
            JobUpdate(
                customer_id=customer.id,
                customer_name="Corrected Lead",
                customer_phone="9876543210",
                address_line_1="New address",
                city="Mumbai",
                state="Maharashtra",
                pincode=400001,
            ),
            admin_id=superadmin.id,
            is_superadmin=True,
        )

        assert updated.customer_id == customer.id
        assert updated.customer.name == "Corrected Lead"
        assert updated.customer.phone_number == "919876543210"
        assert updated.customer.address_line_1 == "New address"
        assert updated.customer.city == "Mumbai"
        assert updated.customer.state == "Maharashtra"
        assert updated.customer.pincode == 400001
