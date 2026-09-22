"""Unrelated edits to legacy jobs must not rewrite their attendance schedule."""
import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session

import app.model  # noqa: F401
from app.crud.job import update_job
from app.database import Base
from app.model.job import Job
from app.model.user import User
from app.schemas.job import JobUpdate


@compiles(ARRAY, "sqlite")
def compile_array(_type, _compiler, **_kwargs):
    return "JSON"


def test_legacy_job_allows_sales_order_edit_but_rejects_explicit_empty_slot():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        supervisor = User(email="audit@example.invalid", is_active=True, is_approved=True)
        db.add(supervisor)
        db.flush()
        job = Job(job_type="measurement", status="created", admin_assigned=supervisor.id)
        db.add(job)
        db.commit()
        updated = update_job(db, job.id, JobUpdate(sales_order="SO123"), admin_id=supervisor.id)
        assert updated.sales_order == "SO123"
        assert updated.slot_start is None and updated.slot_end is None
        with pytest.raises(HTTPException) as error:
            update_job(db, job.id, JobUpdate(slot_start=None, slot_end=None), admin_id=supervisor.id)
        assert error.value.status_code == 422
    engine.dispose()
