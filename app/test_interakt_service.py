import logging
from datetime import date

from app.config import settings
from app.services import interakt_service
from app.services.interakt_service import send_ip_visit_notification, split_phone


def test_split_phone_matches_interakt_shape():
    assert split_phone("+91 98765-43210") == ("+91", "9876543210")
    assert split_phone("09876543210") == ("+91", "9876543210")


def test_visit_notification_uses_the_approved_template_shape(monkeypatch, caplog):
    sent = {}

    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {"result": True, "id": "message-1"}

    def fake_post(url, **kwargs):
        sent.update(url=url, **kwargs)
        return Response()

    monkeypatch.setattr(settings, "INTERAKT_API_KEY", "test-key")
    monkeypatch.setattr(settings, "INTERAKT_VISIT_TEMPLATE_NAME", "partner_app_tpl_1")
    monkeypatch.setattr(interakt_service.requests, "post", fake_post)
    caplog.set_level(logging.INFO, logger="uvicorn.error")

    assert send_ip_visit_notification(
        customer_phone="+91 98765 43210",
        customer_name="A Customer",
        ip_name="An IP",
        job_type="Site Validation",
        ip_phone="9000000001",
        work_date=date(2026, 8, 25),
        callback_ref="manual-test:assignment",
    )
    assert sent["url"] == interakt_service.INTERAKT_MESSAGE_URL
    assert sent["json"]["phoneNumber"] == "9876543210"
    assert sent["json"]["template"]["name"] == "partner_app_tpl_1"
    assert sent["json"]["template"]["bodyValues"] == [
        "A Customer",
        "An IP",
        "Site Validation",
        "9000000001",
    ]
    assert "triggered ref=manual-test:assignment" in caplog.text
    assert "recipient=***3210" in caplog.text
    assert "9876543210" not in caplog.text
    assert "Interakt visit notification queued" in caplog.text


def test_reminder_uses_the_second_template(monkeypatch):
    sent = {}

    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {"result": True, "id": "message-2"}

    monkeypatch.setattr(settings, "INTERAKT_API_KEY", "test-key")
    monkeypatch.setattr(
        interakt_service.requests, "post", lambda url, **kwargs: (sent.update(url=url, **kwargs), Response())[1]
    )

    assert send_ip_visit_notification(
        customer_phone="9876543210",
        customer_name="A Customer",
        ip_name="An IP",
        job_type="Installation",
        ip_phone="9000000001",
        work_date=date(2026, 8, 25),
        template_name="partner_app_tpl_2",
    )
    assert sent["json"]["template"]["name"] == "partner_app_tpl_2"
