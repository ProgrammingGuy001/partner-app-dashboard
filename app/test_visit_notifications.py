"""Two notices per visit, each sent once: assignment, and an hour before the slot."""

from datetime import date, datetime, time
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session

import app.model  # noqa: F401 - register every referenced table
from app.database import Base
from app.model.ip import ip
from app.model.job import Customer, Job
from app.model.roster import JobRosterEntry, RosterSlotSetting
from app.model.user import User
from app.config import settings
from app.routes import interakt_webhook
from app.services import visit_notifications
from app.utils.attendance_policy import ATTENDANCE_TIMEZONE

WORK_DATE = date(2026, 8, 25)


@compiles(ARRAY, "sqlite")
def compile_array_for_sqlite(_type, _compiler, **_kwargs):
    return "JSON"


def build_day(db: Session, *, slots=(1,)) -> Job:
    supervisor = User(email="supervisor@example.com", is_active=True, is_approved=True)
    worker = ip(phone_number="9000000001", first_name="Asha", is_id_verified=True)
    customer = Customer(name="Rita", phone_number="9812345678", city="Pune")
    db.add_all([supervisor, worker, customer])
    db.flush()
    job = Job(
        customer_id=customer.id,
        admin_assigned=supervisor.id,
        assigned_ip_id=worker.id,
        job_type="measurement",
        status="in_progress",
        start_date=WORK_DATE,
        delivery_date=WORK_DATE,
    )
    db.add_all(
        [
            job,
            RosterSlotSetting(slot_number=1, start_time=time(10), end_time=time(14)),
            RosterSlotSetting(slot_number=2, start_time=time(15), end_time=time(18)),
        ]
    )
    db.flush()
    windows = {1: (time(10), time(14)), 2: (time(15), time(18))}
    for slot_number in slots:
        start, end = windows[slot_number]
        db.add(
            JobRosterEntry(
                job_id=job.id,
                ip_user_id=worker.id,
                work_date=WORK_DATE,
                slot_number=slot_number,
                slot_start=start,
                slot_end=end,
                created_by_admin_id=supervisor.id,
            )
        )
    db.flush()
    return job


def session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def at(hour, minute=0):
    return datetime(2026, 8, 25, hour, minute, tzinfo=ATTENDANCE_TIMEZONE)


def test_assignment_notice_is_sent_once_and_covers_the_whole_day():
    with session() as db:
        build_day(db, slots=(1, 2))
        with (
            patch.object(
                visit_notifications, "send_ip_visit_notification", return_value=True
            ) as send,
            patch.object(visit_notifications, "now_ist", return_value=at(8)),
        ):
            assert visit_notifications.send_pending_assignments(db) == 1
            # A second sweep finds nothing: every slot of the day is stamped.
            assert visit_notifications.send_pending_assignments(db) == 0
        assert send.call_count == 1
        payload = send.call_args.kwargs
        assert payload["customer_phone"] == "9812345678"
        assert payload["customer_name"] == "Rita"
        assert payload["ip_name"] == "Asha"
        assert payload["job_type"] == "Measurement"
        assert payload["ip_phone"] == "9000000001"


def test_reminder_fires_inside_the_hour_and_only_once():
    with session() as db:
        build_day(db)
        with patch.object(
            visit_notifications, "send_ip_visit_notification", return_value=True
        ) as send:
            with patch.object(visit_notifications, "now_ist", return_value=at(8, 30)):
                assert visit_notifications.send_due_reminders(db) == 0  # 90 minutes out
            with patch.object(visit_notifications, "now_ist", return_value=at(9, 30)):
                assert visit_notifications.send_due_reminders(db) == 1
            assert (
                send.call_args.kwargs["template_name"]
                == settings.INTERAKT_REMINDER_TEMPLATE_NAME
            )
            with patch.object(visit_notifications, "now_ist", return_value=at(9, 45)):
                assert visit_notifications.send_due_reminders(db) == 0
        assert send.call_count == 1


def test_reminder_does_not_fire_after_the_slot_has_started():
    with session() as db:
        build_day(db)
        with (
            patch.object(
                visit_notifications, "send_ip_visit_notification", return_value=True
            ) as send,
            patch.object(visit_notifications, "now_ist", return_value=at(10, 15)),
        ):
            assert visit_notifications.send_due_reminders(db) == 0
        assert send.call_count == 0


def test_failed_notices_are_not_retried_automatically():
    with session() as db:
        build_day(db)
        with (
            patch.object(
                visit_notifications,
                "send_ip_visit_notification",
                return_value=False,
            ) as send,
            patch.object(visit_notifications, "now_ist", return_value=at(9, 30)),
        ):
            assert visit_notifications.send_pending_assignments(db) == 0
            assert visit_notifications.send_due_reminders(db) == 0
            entry = db.query(JobRosterEntry).one()
            assert entry.notified_at is not None
            assert entry.reminder_sent_at is not None
            assert entry.notified_status == "not_queued"
            assert entry.reminder_status == "not_queued"

            assert visit_notifications.send_pending_assignments(db) == 0
            assert visit_notifications.send_due_reminders(db) == 0
        assert send.call_count == 2


def test_finished_job_gets_no_notices():
    with session() as db:
        job = build_day(db)
        job.status = "completed"
        db.flush()
        with (
            patch.object(
                visit_notifications, "send_ip_visit_notification", return_value=True
            ) as send,
            patch.object(visit_notifications, "now_ist", return_value=at(9, 30)),
        ):
            assert visit_notifications.send_pending_assignments(db) == 0
            assert visit_notifications.send_due_reminders(db) == 0
        assert send.call_count == 0


def test_a_second_sender_cannot_claim_a_visit_already_in_flight():
    with session() as db:
        build_day(db, slots=(1, 2))
        day = db.query(JobRosterEntry).order_by(JobRosterEntry.slot_number).all()
        with patch.object(visit_notifications, "now_ist", return_value=at(8)):
            assert visit_notifications._claim(db, day, "notified_at") is True
            # Whoever asks second - the cron landing on top of a NOTIFY, another worker -
            # claims nothing and must not send.
            assert visit_notifications._claim(db, day, "notified_at") is False
            with patch.object(
                visit_notifications, "send_ip_visit_notification", return_value=True
            ) as send:
                assert visit_notifications.send_pending_assignments(db) == 0
            assert send.call_count == 0

            assert all(entry.notified_at is not None for entry in day)


def test_callback_maps_an_interakt_status_onto_the_right_notice():
    payload = interakt_webhook.InteraktCallback(
        type="message_api_delivered",
        data={
            "message": {
                "callback_data": "7:reminder",
                "channel_message_status": "delivered",
            }
        },
    )
    assert payload.reference_and_status() == ("7:reminder", "delivered")
    kind = payload.reference_and_status()[0].partition(":")[2]
    assert interakt_webhook.STATUS_COLUMNS[kind] == "reminder_status"
    # A callback carrying none of what we sent is ignored, not guessed at.
    assert interakt_webhook.InteraktCallback(data={}).reference_and_status() == (
        None,
        None,
    )
