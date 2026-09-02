import asyncio
from io import BytesIO
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session
from starlette.datastructures import UploadFile

import app.model  # noqa: F401 - register every referenced table
from app.api.v1.jobs import upload_completion_document
from app.crud.job import finish_job
from app.database import Base
from app.model.ip import ip
from app.model.job import Job
from app.model.media_document import MediaDocument


@compiles(ARRAY, "sqlite")
def compile_array_for_sqlite(_type, _compiler, **_kwargs):
    return "JSON"


def test_ip_uploads_required_documents_then_completes_with_otp_only_payload():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        worker = ip(
            phone_number="9000000001",
            first_name="Asha",
            is_id_verified=True,
            is_assigned=True,
        )
        db.add(worker)
        db.flush()
        job = Job(
            assigned_ip_id=worker.id,
            job_type="installation",
            status="in_progress",
        )
        db.add(job)
        db.commit()

        with patch(
            "app.api.v1.jobs.upload_file_to_s3",
            side_effect=lambda **kwargs: f"https://files.test/{kwargs['filename']}",
        ):
            for slot in ("handover", "ncr", "project_report"):
                asyncio.run(
                    upload_completion_document(
                        job.id,
                        slot,
                        UploadFile(
                            BytesIO(b"%PDF completion evidence"),
                            filename=f"{slot}.pdf",
                        ),
                        current_user=worker,
                        db=db,
                    )
                )

        assert db.query(MediaDocument).filter_by(owner_type="job_completion").count() == 3
        completed = finish_job(db, job.id, ip_id=worker.id)
        assert completed.status == "completed"
        assert completed.handover_document_link.endswith("handover.pdf")
        assert completed.ncr_document_link.endswith("ncr.pdf")
        assert completed.project_report_document_link.endswith("project_report.pdf")
