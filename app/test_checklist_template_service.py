from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session

import app.model  # noqa: F401 - register every referenced table
from app.api.v1.jobs import export_checklist
from app.database import Base
from app.model.ip import ip
from app.model.job import Checklist, ChecklistItem, Job, JobChecklist
from app.services.checklist_template_service import (
    CHECKLIST_PDF_FILES,
    checklist_pdf_template,
    sync_checklist_templates,
)


@compiles(ARRAY, "sqlite")
def compile_array_for_sqlite(_type, _compiler, **_kwargs):
    return "JSON"


def test_sync_vacates_unique_positions_before_reordering():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with engine.begin() as connection:
        connection.exec_driver_sql(
            "CREATE UNIQUE INDEX uq_checklist_item_position "
            "ON checklist_items (checklist_id, position)"
        )

    with Session(engine) as db:
        checklist = Checklist(name="LC Carcass")
        db.add(checklist)
        db.flush()
        matched = ChecklistItem(
            checklist_id=checklist.id,
            text="Cabinet top height as per the final design",
            position=3,
        )
        stale = ChecklistItem(
            checklist_id=checklist.id,
            text="Retired legacy checkpoint",
            position=4,
        )
        db.add_all((matched, stale))
        db.commit()
        matched_id, stale_id = matched.id, stale.id

        sync_checklist_templates(db)
        sync_checklist_templates(db)

        assert db.get(ChecklistItem, matched_id).position == 4
        assert db.get(ChecklistItem, stale_id) is None


def test_every_checklist_uses_its_supplied_pdf_template():
    for checklist_name, filename in CHECKLIST_PDF_FILES.items():
        template = checklist_pdf_template(checklist_name)
        assert template is not None
        assert template.name == filename
        assert template.read_bytes().startswith(b"%PDF")


def test_ip_export_returns_the_supplied_checklist_pdf():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        worker = ip(phone_number="9000000001", is_id_verified=True)
        checklist = Checklist(name="Handover Checklist")
        db.add_all([worker, checklist])
        db.flush()
        job = Job(assigned_ip_id=worker.id, status="created")
        db.add(job)
        db.flush()
        db.add(JobChecklist(job_id=job.id, checklist_id=checklist.id))
        db.commit()

        response = export_checklist(job.id, checklist.id, current_user=worker, db=db)

        assert str(response.path).endswith("Handover checklist.pdf")
        assert response.media_type == "application/pdf"
