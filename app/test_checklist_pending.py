"""Checkout files the report; the checklist is counted, never gating."""
from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session

import app.model  # noqa: F401 - register every referenced table
from app.crud.checklist import checklist_items_pending
from app.database import Base
from app.model.job import (
    Checklist,
    ChecklistItem,
    Customer,
    Job,
    JobChecklist,
    JobChecklistItemStatus,
)


@compiles(ARRAY, "sqlite")
def compile_array_for_sqlite(_type, _compiler, **_kwargs):
    return "JSON"


def test_pending_counts_only_unapproved_assigned_items():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        customer = Customer(name="Customer")
        checklist = Checklist(name="ISM Checklist")
        db.add_all([customer, checklist])
        db.flush()
        job = Job(
            customer_id=customer.id,
            admin_assigned=1,
            job_type="measurement",
            status="in_progress",
            delivery_date=date(2026, 8, 26),
        )
        items = [ChecklistItem(checklist_id=checklist.id, text=f"Item {n}", position=n) for n in (1, 2, 3)]
        db.add_all([job, *items])
        db.flush()
        db.add(JobChecklist(job_id=job.id, checklist_id=checklist.id))
        db.add(
            JobChecklistItemStatus(
                job_id=job.id, checklist_item_id=items[0].id, review_status="approved"
            )
        )
        # Filled in but not approved yet, so it still counts as pending.
        db.add(
            JobChecklistItemStatus(
                job_id=job.id, checklist_item_id=items[1].id, review_status="pending"
            )
        )
        db.flush()

        assert checklist_items_pending(db, [job.id]) == {job.id: 2}
        assert checklist_items_pending(db, []) == {}
        assert checklist_items_pending(db, [job.id, None]) == {job.id: 2}


def test_job_without_checklists_has_nothing_pending():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        customer = Customer(name="Customer")
        db.add(customer)
        db.flush()
        job = Job(
            customer_id=customer.id,
            admin_assigned=1,
            job_type="site_validation",
            status="in_progress",
            delivery_date=date(2026, 8, 26),
        )
        db.add(job)
        db.flush()
        assert checklist_items_pending(db, [job.id]) == {job.id: 0}
