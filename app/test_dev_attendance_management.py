"""Dev-only attendance corrections and deletion regressions."""
from datetime import date, timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from slowapi.errors import RateLimitExceeded
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.model  # noqa: F401 — register every table on Base.metadata
from app.core.security import get_current_user, hash_password
from app.database import Base, get_db
from app.model.admin_attendance import AdminAttendance
from app.model.attendance import DailyAttendance
from app.model.dev_audit_log import DevAuditLog
from app.model.ip import ip
from app.model.job import Job
from app.model.user import User
from app.routes.dev import router as dev_router
from app.utils.rate_limiter import limiter, rate_limit_exceeded_handler


@compiles(ARRAY, "sqlite")
def _compile_array_for_sqlite(_type, _compiler, **_kwargs):
    return "JSON"


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, autoflush=False)()
    try:
        yield session
    finally:
        session.close()


def _user(db, email: str, *, is_dev: bool = False) -> User:
    user = User(
        email=email,
        password=hash_password("initial-password"),
        is_active=True,
        is_approved=True,
        is_dev=is_dev,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _client(db, acting_user: User) -> TestClient:
    api = FastAPI()
    api.state.limiter = limiter
    api.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
    api.include_router(dev_router)
    api.dependency_overrides[get_db] = lambda: db
    api.dependency_overrides[get_current_user] = lambda: acting_user
    return TestClient(api)


def test_dev_created_attendance_has_normal_location_fields(db):
    dev = _user(db, "dev@test.com", is_dev=True)
    worker = ip(phone_number="919000000001")
    db.add(worker)
    db.commit()
    job = Job(
        status="in_progress", assigned_ip_id=worker.id,
        latitude=18.52, longitude=73.85,
    )
    db.add(job)
    db.commit()
    attendance_date = date.today() - timedelta(days=1)

    response = _client(db, dev).post("/dev/attendance", json={
        "subject_type": "ip",
        "subject_id": worker.id,
        "job_id": job.id,
        "attendance_date": attendance_date.isoformat(),
        "attendance_type": "check_in",
        "manual_location": "Warehouse Gate",
        "latitude": 18.521,
        "longitude": 73.852,
        "reason": "Phone died on site",
    })

    assert response.status_code == 201
    record = db.query(DailyAttendance).one()
    assert (record.latitude, record.longitude) == (18.521, 73.852)
    assert record.manual_location == "Warehouse Gate"
    assert record.distance_meters is not None
    assert "Phone died on site" not in record.manual_location
    audit = db.query(DevAuditLog).filter_by(action="backfill_attendance").one()
    assert "Phone died on site" in audit.detail


def test_dev_create_validates_coordinates(db):
    dev = _user(db, "dev@test.com", is_dev=True)
    supervisor = _user(db, "supervisor@test.com")

    response = _client(db, dev).post("/dev/attendance", json={
        "subject_type": "admin",
        "subject_id": supervisor.id,
        "attendance_date": date.today().isoformat(),
        "manual_location": "Project office",
        "latitude": 91,
        "longitude": 73.85,
        "reason": "App failed",
    })

    assert response.status_code == 422
    assert db.query(AdminAttendance).count() == 0


def test_dev_delete_removes_ip_attendance_and_keeps_audit_snapshot(db):
    dev = _user(db, "dev@test.com", is_dev=True)
    record = DailyAttendance(
        phone="919000000001",
        attendance_date=date.today(),
        attendance_type="check_in",
        latitude=18.52,
        longitude=73.85,
        manual_location="Warehouse Gate",
    )
    db.add(record)
    db.commit()
    record_id = record.id

    response = _client(db, dev).request(
        "DELETE", f"/dev/attendance/ip/{record_id}", json={"reason": "Duplicate entry"}
    )

    assert response.status_code == 200
    assert db.get(DailyAttendance, record_id) is None
    audit = db.query(DevAuditLog).filter_by(action="delete_attendance").one()
    assert audit.target_email == "919000000001"
    assert "Duplicate entry" in audit.detail
    assert "Warehouse Gate" in audit.detail


def test_dev_delete_handles_admin_records_and_missing_ids(db):
    dev = _user(db, "dev@test.com", is_dev=True)
    supervisor = _user(db, "supervisor@test.com")
    record = AdminAttendance(
        admin_id=supervisor.id,
        latitude=18.52,
        longitude=73.85,
        manual_location="Project office",
    )
    db.add(record)
    db.commit()
    record_id = record.id
    client = _client(db, dev)

    deleted = client.request(
        "DELETE", f"/dev/attendance/admin/{record_id}", json={"reason": "Wrong date"}
    )

    assert deleted.status_code == 200
    assert db.get(AdminAttendance, record_id) is None
    assert client.request(
        "DELETE", "/dev/attendance/admin/9999", json={"reason": "Wrong date"}
    ).status_code == 404


def test_non_dev_cannot_delete_attendance(db):
    admin = _user(db, "admin@test.com")
    record = DailyAttendance(
        phone="919000000001",
        attendance_date=date.today(),
        attendance_type="check_in",
        latitude=18.52,
        longitude=73.85,
    )
    db.add(record)
    db.commit()

    response = _client(db, admin).request(
        "DELETE", f"/dev/attendance/ip/{record.id}", json={"reason": "Not allowed"}
    )

    assert response.status_code == 403
    assert db.get(DailyAttendance, record.id) is not None
