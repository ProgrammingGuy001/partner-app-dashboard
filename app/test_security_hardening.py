"""Offline regressions: python -m pytest app/test_security_hardening.py -q."""
import asyncio
from io import BytesIO
from threading import Event, get_ident
from unittest.mock import Mock, patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from starlette.datastructures import Headers, UploadFile

from app.config import settings
from app.main import app
from app.services.checklist_export_service import _fetch_image
from app.services.s3_service import async_upload_file_to_s3
from app.services.upload_service import read_validated_upload
from app.schemas.ip import LoginRequest, OTPVerification, UserRegistration


@pytest.mark.parametrize("url", [
    "http://127.0.0.1/private", "http://169.254.169.254/latest/meta-data/",
    "file:///etc/passwd", "https://untrusted.invalid/photo.png",
    f"https://{settings.AWS_S3_BUCKET}.s3.{settings.AWS_REGION}.amazonaws.com.evil.invalid/x",
    f"https://{settings.AWS_S3_BUCKET}.s3.{settings.AWS_REGION}.amazonaws.com:8080/x",
    f"https://user:password@{settings.AWS_S3_BUCKET}.s3.{settings.AWS_REGION}.amazonaws.com/x",
])
def test_export_never_fetches_untrusted_urls(url):
    with patch("app.services.checklist_export_service.requests.get") as fetch:
        assert _fetch_image(url) is None
        fetch.assert_not_called()


def test_export_does_not_follow_bucket_redirects():
    response = Mock(status_code=302)
    with patch("app.services.checklist_export_service.requests.get") as fetch:
        fetch.return_value.__enter__.return_value = response
        url = f"https://{settings.AWS_S3_BUCKET}.s3.{settings.AWS_REGION}.amazonaws.com/x"
        assert _fetch_image(url) is None
        assert fetch.call_args.kwargs["allow_redirects"] is False
        response.raw.read.assert_not_called()


def test_export_still_embeds_photos_from_the_upload_bucket():
    from PIL import Image
    body = BytesIO()
    Image.new("RGB", (20, 20)).save(body, "PNG")
    response = Mock(status_code=200)
    response.raw.read.return_value = body.getvalue()
    with patch("app.services.checklist_export_service.requests.get") as fetch:
        fetch.return_value.__enter__.return_value = response
        url = f"https://{settings.AWS_S3_BUCKET}.s3.{settings.AWS_REGION}.amazonaws.com/photo.png"
        assert _fetch_image(url).startswith(b"\xff\xd8\xff")


@pytest.mark.parametrize("filename,body", [
    ("empty.pdf", b""), ("script.pdf", b"<script>alert(1)</script>"),
    ("photo.jpg", b"not an image"), ("photo.png", b"%PDF-1.7"),
    ("report.xlsx", b"not a workbook"), ("report.docx", b"not a document"),
])
def test_invalid_uploads_are_rejected(filename, body):
    with pytest.raises(HTTPException) as error:
        asyncio.run(read_validated_upload(
            UploadFile(BytesIO(body), filename=filename),
            allowed_extensions={".pdf", ".jpg", ".png", ".xlsx", ".docx"},
        ))
    assert error.value.status_code == 400


def test_upload_uses_detected_mime_instead_of_client_html_type():
    upload = UploadFile(BytesIO(b"%PDF-1.7 test"), filename="report.pdf",
                        headers=Headers({"content-type": "text/html"}))
    assert asyncio.run(read_validated_upload(upload)).content_type == "application/pdf"


def test_slow_storage_upload_leaves_the_event_loop_available():
    release = Event()
    started = Event()
    event_loop_thread = get_ident()

    def slow_upload(*_args):
        assert get_ident() != event_loop_thread
        started.set()
        assert release.wait(2)
        return "https://files.invalid/report.pdf"

    async def check():
        with patch("app.services.s3_service.upload_file_to_s3", side_effect=slow_upload):
            upload = asyncio.create_task(async_upload_file_to_s3(b"pdf", "report.pdf", "application/pdf"))
            try:
                assert await asyncio.to_thread(started.wait, 1)
                # This continuation can run while the storage call is still blocked.
                assert not upload.done()
            finally:
                release.set()
            assert await upload == "https://files.invalid/report.pdf"

    asyncio.run(check())


def test_api_responses_disable_storage_and_mime_sniffing():
    # No lifespan: do not run migrations or external notification jobs.
    response = TestClient(app).get("/auth/me")
    assert response.status_code == 401
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"


@pytest.mark.parametrize("number", ["9123456789", "+91 91234 56789", "919123456789"])
def test_registration_login_and_otp_normalize_the_same_mobile_number(number):
    assert LoginRequest(phone_number=number).phone_number == "919123456789"
    assert OTPVerification(phone_number=number, otp="123456").phone_number == "919123456789"
    assert UserRegistration(phone_number=number, first_name="Test", last_name="Partner",
                            city="Pune", pincode="411001").phone_number == "919123456789"


def test_registration_rate_limit_runs_before_database_writes():
    from app.database import get_db
    db = Mock()
    db.query.return_value.filter.return_value.first.return_value = object()
    previous = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = lambda: db
    try:
        client = TestClient(app, client=("registration-rate-limit-test", 50000))
        payload = dict(phone_number="9876543210", first_name="Test", last_name="Partner",
                       city="Pune", pincode="411001")
        responses = [client.post("/api/v1/auth/register", json=payload) for _ in range(6)]
        assert [response.status_code for response in responses] == [400] * 5 + [429]
        db.add.assert_not_called()
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
