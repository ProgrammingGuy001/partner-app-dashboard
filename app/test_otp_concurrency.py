"""Run against a disposable PostgreSQL DB using PARTNER_AUDIT_DATABASE_URL."""
import os
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

import app.model  # noqa: F401
from app.config import settings
from app.database import Base
from app.model.ip import ip
from app.model.job import Customer, Job
from app.model.otp_session import OTPSession
from app.services.otp_service import OTPService
from app.services.customer_otp_service import CustomerOTPService


@pytest.fixture
def engine():
    url = os.environ.get("PARTNER_AUDIT_DATABASE_URL")
    if not url:
        pytest.skip("Needs an explicitly supplied disposable PostgreSQL database")
    engine = create_engine(url)
    # Isolate this test's tables; never modify application tables in public.
    schema = "audit_" + uuid4().hex
    with engine.begin() as connection:
        connection.exec_driver_sql(f'CREATE SCHEMA "{schema}"')
    scoped = engine.execution_options(schema_translate_map={None: schema})
    try:
        Base.metadata.create_all(scoped)
        yield scoped
    finally:
        with engine.begin() as connection:
            connection.exec_driver_sql(f'DROP SCHEMA "{schema}" CASCADE')
        engine.dispose()


@pytest.mark.parametrize("purpose", ["ip_login", "job_start", "job_end"])
@pytest.mark.parametrize("correct", [True, False])
def test_parallel_otp_attempts_are_serialized(engine, purpose, correct):
    phone = "919123456789"
    with Session(engine) as db:
        worker = ip(phone_number=phone, first_name="Audit")
        job = Job(job_type="installation", status="created",
                  customer=Customer(name="Audit Customer", phone_number=phone))
        db.add_all([worker, job])
        db.commit()
        job_id = job.id
        otp = (OTPService.generate_and_store_otp(db, phone) if purpose == "ip_login"
               else CustomerOTPService._generate_and_store(db, job_id, purpose))

    count = 2 if correct else settings.OTP_MAX_ATTEMPTS + 2
    ready = Barrier(count)
    code = otp if correct else ("000000" if otp != "000000" else "111111")

    def verify(_):
        with Session(engine) as db:
            ready.wait(timeout=10)
            if purpose == "ip_login":
                return OTPService.verify_otp(db, phone, code)
            return CustomerOTPService._verify(db, job_id, code, purpose,
                                              "start_otp_verified" if purpose == "job_start" else "end_otp_verified")

    with ThreadPoolExecutor(max_workers=count) as workers:
        results = list(workers.map(verify, range(count)))
    assert sum(results) == (1 if correct else 0)
    with Session(engine) as db:
        session = db.query(OTPSession).one()
        assert session.is_used
        assert session.attempt_count == (0 if correct else settings.OTP_MAX_ATTEMPTS)
