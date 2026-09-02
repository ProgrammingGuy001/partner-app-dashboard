from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session

import app.model  # noqa: F401 - register every referenced table
from app.crud.job import _validate_ip_for_supervisor
from app.database import Base
from app.model.ip import IPAdminAssignment, ip
from app.model.user import User


@compiles(ARRAY, "sqlite")
def compile_array_for_sqlite(_type, _compiler, **_kwargs):
    return "JSON"


def test_job_ip_must_be_mapped_but_global_active_status_does_not_block_it():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        supervisor = User(
            email="supervisor@example.com", is_active=True, is_approved=True
        )
        mapped = ip(phone_number="9000000001", is_id_verified=True)
        unmapped = ip(phone_number="9000000002", is_id_verified=True)
        db.add_all([supervisor, mapped, unmapped])
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
