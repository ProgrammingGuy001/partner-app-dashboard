from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session

import app.model  # noqa: F401 - register every referenced table
from app.crud.checklist import (
    get_job_type_checklist_ids,
    replace_job_type_checklist_mapping,
)
from app.database import Base
from app.model.job import Checklist, Job, JobChecklist
from app.utils.job_documents import normalize_job_type


@compiles(ARRAY, "sqlite")
def compile_array_for_sqlite(_type, _compiler, **_kwargs):
    return "JSON"


def test_one_job_type_mapping_updates_every_matching_job():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as db:
        wanted = Checklist(name="LC Carcass Checklist")
        stale = Checklist(name="Validation Checklist")
        jobs = [
            Job(job_type="Installation"),
            Job(job_type=" installation "),
            Job(job_type="site_validation"),
        ]
        db.add_all([wanted, stale, *jobs])
        db.flush()
        db.add_all(
            JobChecklist(job_id=job.id, checklist_id=stale.id) for job in jobs
        )
        db.commit()

        result = replace_job_type_checklist_mapping(
            db, "INSTALLATION", [wanted.id]
        )

        assert result["updated_jobs"] == 2
        assert get_job_type_checklist_ids(db, "installation") == [wanted.id]
        assert [row.checklist_id for row in jobs[0].job_checklists] == [wanted.id]
        assert [row.checklist_id for row in jobs[1].job_checklists] == [wanted.id]
        assert [row.checklist_id for row in jobs[2].job_checklists] == [stale.id]
        assert normalize_job_type("Site Measurement") == "measurement"
