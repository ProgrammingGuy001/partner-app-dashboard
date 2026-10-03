"""Regression checks for mapped operations, PDF completion and account removal."""

import asyncio
from datetime import datetime, time
from io import BytesIO
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session
from starlette.datastructures import UploadFile

import app.model  # noqa: F401
from app.database import Base
from app.model.user import User, CityOpsSupervisor
from app.model.ip import ip, IPFinancial, IPAdminAssignment
from app.model.job import Job, Checklist, ChecklistItem, JobChecklist
from app.model.roster import JobRosterEntry, RosterSlotSetting, SupervisorRosterEntry
from app.model.admin_attendance import AdminAttendance
from app.model.dev_audit_log import DevAuditLog
from app.crud.job import get_job_by_id, get_all_jobs
from app.crud.checklist import checklist_items_pending
from app.routes.dev import AccountRemoval, remove_account
from app.routes.roster import (
    get_admin_roster,
    create_supervisor_visit,
    SupervisorVisitCreate,
)
from app.utils.attendance_policy import filter_attendance_time, now_ist


def test_crm_lead_lookup_and_city_job_creation():
    from app.services.odoo_service import OdooService
    from app.schemas.job import JobCreate
    from app.crud.job import create_job

    lead = {"id": 123, "name": "Site A", "contact_name": "Client", "phone": "919000000000",
            "street": "Site road", "city": "Pune", "state_id": [1, "Maharashtra"], "zip": "411001"}
    with patch.object(OdooService, "_execute_kw", return_value=[lead]):
        result = OdooService.lookup_crm_lead(123)
        assert result["customer_name"] == "Client"
        assert result["state"] == "Maharashtra"
        assert result["pincode"] == 411001
        with session() as db:
            sup, other, city, _ = users(db)
            payload = JobCreate(crm_lead_id=123, customer_name=result["customer_name"],
                                customer_phone=result["phone"], address_line_1=result["address_line_1"],
                                city=result["city"], state=result["state"], pincode=result["pincode"],
                                type="grn", delivery_date=now_ist().date(), admin_assigned=sup.id)
            job = create_job(db, payload, city.id, is_superadmin=True)
            assert db.get(Job, job.id).crm_lead_id == 123
            assert job.admin_assigned == sup.id
            payload.admin_assigned = other.id
            with pytest.raises(HTTPException) as error:
                create_job(db, payload, city.id, is_superadmin=True)
            assert error.value.status_code == 403
    with patch.object(OdooService, "_execute_kw", return_value=[]):
        with pytest.raises(HTTPException) as error:
            OdooService.lookup_crm_lead(123)
        assert error.value.status_code == 404


@compiles(ARRAY, "sqlite")
def _array(_type, _compiler, **_kwargs):
    return "JSON"


def session():
    engine = create_engine("sqlite:///:memory:")

    @event.listens_for(engine, "connect")
    def foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    return Session(engine)


def users(db):
    sup, other, city, dev = [
        User(
            email=f"{name}@test.com",
            is_active=True,
            is_approved=True,
            is_city_ops=name == "city",
            is_dev=name == "dev",
        )
        for name in ["sup", "other", "city", "dev"]
    ]
    db.add_all([sup, other, city, dev])
    db.flush()
    db.add(CityOpsSupervisor(city_ops_id=city.id, supervisor_id=sup.id))
    db.commit()
    return sup, other, city, dev


def test_city_scope_and_all_roster_excludes_blank_jobs():
    with session() as db:
        sup, other, city, dev = users(db)
        worker = ip(phone_number="919000000001", is_id_verified=True)
        db.add(worker)
        db.flush()
        db.add(IPAdminAssignment(ip_id=worker.id, admin_id=sup.id))
        db.add(RosterSlotSetting(slot_number=1, start_time=time(9), end_time=time(13)))
        owned, blank, outside = [
            Job(admin_assigned=owner, status="in_progress", job_type="installation")
            for owner in [sup.id, sup.id, other.id]
        ]
        db.add_all([owned, blank, outside])
        db.flush()
        db.add(
            JobRosterEntry(
                job_id=owned.id,
                ip_user_id=worker.id,
                work_date=now_ist().date(),
                slot_number=1,
                slot_start=time(9),
                slot_end=time(13),
                created_by_admin_id=dev.id,
            )
        )
        db.commit()
        assert get_job_by_id(db, owned.id, city.id).id == owned.id
        with pytest.raises(HTTPException):
            get_job_by_id(db, outside.id, city.id)
        assert {j.id for j in get_all_jobs(db, user_id=city.id)} == {owned.id, blank.id}
        result = get_admin_roster(
            admin_id=None,
            date_from=now_ist().date(),
            date_to=now_ist().date(),
            current_user=city,
            db=db,
        )
        assert [j["id"] for j in result["jobs"]] == [owned.id]
        superadmin = User(email="super@test.com", is_superadmin=True, is_active=True, is_approved=True)
        db.add(superadmin)
        db.commit()
        for manager in (dev, superadmin):
            result = get_admin_roster(admin_id=None, date_from=now_ist().date(),
                                      date_to=now_ist().date(), current_user=manager, db=db)
            assert [j["id"] for j in result["jobs"]] == [owned.id]
        with pytest.raises(HTTPException):
            get_admin_roster(
                admin_id=other.id,
                date_from=None,
                date_to=None,
                current_user=city,
                db=db,
            )
        payload = SupervisorVisitCreate(
            supervisor_id=sup.id,
            job_id=owned.id,
            work_date=now_ist().date(),
            slot_number=1,
        )
        create_supervisor_visit(payload, current_user=city, db=db)
        with pytest.raises(HTTPException):
            create_supervisor_visit(payload, current_user=other, db=db)
        with pytest.raises(HTTPException):
            create_supervisor_visit(payload, current_user=sup, db=db)
        assert db.query(SupervisorRosterEntry).count() == 1
        payload.slot_number = 2
        db.add(RosterSlotSetting(slot_number=2, start_time=time(14), end_time=time(18)))
        db.commit()
        create_supervisor_visit(payload, current_user=sup, db=db)
        assert db.query(SupervisorRosterEntry).count() == 2
        db.query(CityOpsSupervisor).delete()
        db.commit()
        assert get_all_jobs(db, user_id=city.id) == []
        with pytest.raises(HTTPException):
            get_job_by_id(db, owned.id, city.id)


def test_time_filter_uses_ist_and_wraps_midnight():
    with session() as db:
        sup, _, _, _ = users(db)
        db.add_all(
            [
                AdminAttendance(admin_id=sup.id, marked_at=datetime(2026, 10, 1, h, m))
                for h, m in [(4, 30), (5, 30), (18, 0)]
            ]
        )
        db.commit()
        query = db.query(AdminAttendance)
        assert (
            filter_attendance_time(
                query, AdminAttendance.marked_at, time(10), time(10)
            ).count()
            == 1
        )
        assert (
            filter_attendance_time(
                query, AdminAttendance.marked_at, time(23), time(1)
            ).count()
            == 1
        )


@pytest.mark.parametrize("actor_type", ["ip", "supervisor"])
def test_uploaded_pdf_bypasses_items_but_url_does_not(actor_type):
    from app.api.v1.jobs import (
        upload_checklist_document,
        update_checklist_document,
        ChecklistDocumentUpdate,
    )

    with session() as db:
        sup, _, _, _ = users(db)
        worker = ip(phone_number="919000000001", is_id_verified=True)
        db.add(worker)
        db.flush()
        job = Job(
            assigned_ip_id=worker.id, admin_assigned=sup.id, job_type="installation", status="in_progress"
        )
        checklist = Checklist(name="Example")
        db.add_all([job, checklist])
        db.flush()
        db.add(ChecklistItem(checklist_id=checklist.id, text="Required", position=1))
        db.add(JobChecklist(job_id=job.id, checklist_id=checklist.id))
        db.commit()
        assert checklist_items_pending(db, [job.id])[job.id] == 1
        from app.routes.checklist import upload_job_checklist_document
        upload = upload_checklist_document if actor_type == "ip" else upload_job_checklist_document
        module = "app.api.v1.jobs" if actor_type == "ip" else "app.routes.checklist"
        with patch(
            f"{module}.async_upload_file_to_s3",
            return_value="https://files.test/completed.pdf",
        ):
            response = asyncio.run(
                upload(
                    job_id=job.id,
                    checklist_id=checklist.id,
                    file=UploadFile(
                        BytesIO(b"%PDF-1.7 completed"), filename="completed.pdf"
                    ),
                    current_user=worker if actor_type == "ip" else sup,
                    db=db,
                )
            )
        assert response["completed_by_pdf"] is True
        assert checklist_items_pending(db, [job.id])[job.id] == 0
        update_checklist_document(
            job.id,
            checklist.id,
            ChecklistDocumentUpdate(document_link="https://files.test/another.pdf"),
            worker,
            db,
        )
        assert checklist_items_pending(db, [job.id])[job.id] == 1


def test_dev_removes_accounts_preserving_jobs_and_audit():
    with session() as db:
        sup, _, _, dev = users(db)
        worker = ip(phone_number="919000000001")
        db.add(worker)
        db.flush()
        db.add(IPFinancial(user_id=worker.id))
        db.add(IPAdminAssignment(ip_id=worker.id, admin_id=sup.id))
        job = Job(admin_assigned=sup.id, assigned_ip_id=worker.id)
        db.add(job)
        db.flush()
        db.add(RosterSlotSetting(slot_number=1, start_time=time(9), end_time=time(13)))
        db.flush()
        # Another IP's historical visit must survive removal of its author.
        remaining_worker = ip(phone_number="919000000002")
        db.add(remaining_worker)
        db.flush()
        db.add(JobRosterEntry(job_id=job.id, ip_user_id=remaining_worker.id,
                              work_date=now_ist().date(), slot_number=1,
                              slot_start=time(9), slot_end=time(13), created_by_admin_id=sup.id))
        db.commit()
        worker_id = worker.id
        remove_account(
            "ip",
            worker_id,
            AccountRemoval(
                confirmation=worker.phone_number, reason="Duplicate account"
            ),
            db,
            dev,
        )
        db.expire_all()
        assert db.get(ip, worker_id) is None
        assert db.get(Job, job.id).assigned_ip_id is None
        remove_account(
            "admin",
            sup.id,
            AccountRemoval(confirmation=sup.email, reason="Left company"),
            db,
            dev,
        )
        db.expire_all()
        assert db.get(Job, job.id).admin_assigned is None
        assert db.query(JobRosterEntry).one().created_by_admin_id is None
        assert db.query(DevAuditLog).filter_by(action="remove_account").count() == 2
        with pytest.raises(HTTPException):
            remove_account(
                "admin",
                dev.id,
                AccountRemoval(confirmation=dev.email, reason="No self deletion"),
                db,
                dev,
            )
