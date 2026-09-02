"""Assignment notices go out on the roster write, not on the next sweep.

A Postgres trigger raises NOTIFY roster_visit whenever a roster row is inserted or its
IP changes; this thread holds one psycopg2 connection on LISTEN and sweeps the pending
assignments as soon as it hears one. The five-minute cron stays as the backstop, and
still owns the hour-before reminder - that one is timed off a clock, so no write exists
to wake it. Every worker runs its own listener; _claim in visit_notifications is what
keeps them from all sending the same notice.
"""
import logging
import select
import threading
from typing import Optional

import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from sqlalchemy.engine import make_url

from app.config import settings
from app.database import SessionLocal
from app.services.visit_notifications import send_pending_assignments

logger = logging.getLogger("uvicorn.error")

CHANNEL = "roster_visit"
# Not a database poll: select() only wakes this often so shutdown doesn't wait on a
# notification that may never come.
WAKE_INTERVAL = 5
RECONNECT_DELAY = 5

_stop = threading.Event()
_thread: Optional[threading.Thread] = None


def _dsn() -> Optional[str]:
    """libpq form of the app's URL, or None when the backend can't do LISTEN/NOTIFY."""
    url = make_url(settings.DATABASE_URL)
    if not url.get_backend_name().startswith("postgres"):
        return None
    return url.set(drivername="postgresql").render_as_string(hide_password=False)


def _sweep() -> None:
    try:
        with SessionLocal() as db:
            sent = send_pending_assignments(db)
        if sent:
            logger.info("Visit listener sent %d assignment notice(s)", sent)
    except Exception as exc:
        logger.exception("Visit listener sweep failed: %s", exc)


def _run(dsn: str) -> None:
    while not _stop.is_set():
        conn = None
        try:
            conn = psycopg2.connect(dsn)
            conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
            with conn.cursor() as cursor:
                cursor.execute(f"LISTEN {CHANNEL}")
            logger.info("Visit listener attached to %s", CHANNEL)
            while not _stop.is_set():
                if not select.select([conn], [], [], WAKE_INTERVAL)[0]:
                    continue
                conn.poll()
                if conn.notifies:
                    # One sweep covers every row that arrived while we were busy, so a
                    # bulk roster insert costs one pass, not one per entry.
                    conn.notifies.clear()
                    _sweep()
        except Exception as exc:
            logger.warning("Visit listener reconnecting after: %s", exc)
            _stop.wait(RECONNECT_DELAY)
        finally:
            if conn is not None:
                try:
                    conn.close()
                except Exception:
                    pass


def start_visit_listener() -> None:
    global _thread
    dsn = _dsn()
    if dsn is None:
        logger.info("Visit listener disabled: LISTEN/NOTIFY needs Postgres")
        return
    _stop.clear()
    _thread = threading.Thread(target=_run, args=(dsn,), name="visit-listener", daemon=True)
    _thread.start()


def stop_visit_listener() -> None:
    _stop.set()
    if _thread is not None:
        _thread.join(timeout=WAKE_INTERVAL + 5)
