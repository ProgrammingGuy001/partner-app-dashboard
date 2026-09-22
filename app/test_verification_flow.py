"""Run: app/venv/bin/python -m pytest app/test_verification_flow.py -q"""
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.api.v1.verification import ID_DOCUMENT_STATUS, get_verification_status
from app.model.media_document import MediaDocument


def test_identity_submission_survives_reload_without_granting_approval():
    user = SimpleNamespace(
        id=1, phone_number="9999999999", first_name="Test", last_name="Partner",
        city="Test city", is_verified=True, is_pan_verified=True,
        is_bank_details_verified=True, is_id_verified=False, is_internal=False,
        registered_at=datetime.now(timezone.utc), pan_number="ABCDE1234F",
        account_number="123456789012",
    )
    engine = create_engine("sqlite:///:memory:")
    MediaDocument.__table__.create(engine)
    with Session(engine) as db:
        # Other people's documents, and documents for a job with the same ID,
        # must never make this account look submitted.
        db.add_all([
            MediaDocument(owner_type="ip_user", owner_id=2, status=ID_DOCUMENT_STATUS, doc_link="other.pdf"),
            MediaDocument(owner_type="job", owner_id=1, status=ID_DOCUMENT_STATUS, doc_link="job.pdf"),
            MediaDocument(owner_type="ip_user", owner_id=1, status="unrelated", doc_link="other-kind.pdf"),
        ])
        db.commit()
        assert not get_verification_status(user, db).id_document_uploaded
        document = MediaDocument(owner_type="ip_user", owner_id=1, status=ID_DOCUMENT_STATUS, doc_link="identity.pdf")
        db.add(document)
        db.commit()
        db.expire_all()
        pending = get_verification_status(user, db)
        assert pending.id_document_uploaded
        assert not pending.is_id_verified
        assert pending.pan_number == "ABXXXXX34F"
        assert pending.account_number == "XXXX9012"
        user.is_id_verified = True
        assert get_verification_status(user, db).is_id_verified
        # Clearing verification data restores the upload step.
        user.is_id_verified = False
        db.delete(document)
        db.commit()
        assert not get_verification_status(user, db).id_document_uploaded
    engine.dispose()


def test_identity_review_respects_supervisor_mapping_and_document_owner():
    from app.routes.approval import get_ip_identity_documents

    engine = create_engine("sqlite:///:memory:")
    MediaDocument.__table__.create(engine)
    with Session(engine) as db:
        db.add_all([
            MediaDocument(owner_type="ip_user", owner_id=1, status=ID_DOCUMENT_STATUS, doc_link="first.pdf"),
            MediaDocument(owner_type="ip_user", owner_id=2, status=ID_DOCUMENT_STATUS, doc_link="other.pdf"),
            MediaDocument(owner_type="job", owner_id=1, status=ID_DOCUMENT_STATUS, doc_link="job.pdf"),
        ])
        db.commit()
        admin = SimpleNamespace(id=42, is_superadmin=False)
        with patch("app.routes.approval.is_admin_allowed_for_ip", return_value=False):
            with pytest.raises(HTTPException) as error:
                get_ip_identity_documents(1, db, admin)
            assert error.value.status_code == 403
        with patch("app.routes.approval.is_admin_allowed_for_ip", return_value=True) as allowed:
            documents = get_ip_identity_documents(1, db, admin)
            allowed.assert_called_once_with(db, 1, 42)
            assert [doc["url"] for doc in documents] == ["first.pdf"]
        admin.is_superadmin = True
        assert [doc["url"] for doc in get_ip_identity_documents(2, db, admin)] == ["other.pdf"]
    engine.dispose()
