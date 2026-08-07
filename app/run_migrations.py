"""Run production database migrations once with detailed logs."""

import logging
from time import perf_counter

from sqlalchemy import inspect
from sqlalchemy.engine import make_url

from app.config import settings
from app.database import SessionLocal
from app.utils.db_migrations import run_migrations

logger = logging.getLogger(__name__)


class _ErrorCounter(logging.Handler):
    count = 0

    def emit(self, record: logging.LogRecord) -> None:
        if record.levelno >= logging.ERROR:
            self.count += 1


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    errors = _ErrorCounter()
    logging.getLogger().addHandler(errors)

    url = make_url(settings.DATABASE_URL)
    logger.info(
        "Migration run started: driver=%s host=%s port=%s database=%s",
        url.drivername,
        url.host or "local",
        url.port or "default",
        url.database,
    )
    started = perf_counter()
    try:
        with SessionLocal() as db:
            run_migrations(db, verbose=True)
            inspector = inspect(db.connection())
            required_tables = {
                "checklists",
                "checklist_items",
                "jobs_checklists",
                "jobs_checklist_item_status",
            }
            missing = required_tables - set(inspector.get_table_names())
            if missing:
                raise RuntimeError(f"Missing checklist tables after migration: {sorted(missing)}")
            columns = {column["name"] for column in inspector.get_columns("jobs_checklist_item_status")}
            if "review_status" not in columns:
                raise RuntimeError("Missing jobs_checklist_item_status.review_status after migration")
            logger.info("Verified checklist tables and review_status column")
    except Exception:
        logger.exception("Migration run failed after %.2fs", perf_counter() - started)
        return 1

    elapsed = perf_counter() - started
    if errors.count:
        logger.warning("Migration run finished with %d logged error(s) in %.2fs", errors.count, elapsed)
        return 1
    logger.info("Migration run finished successfully in %.2fs", elapsed)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
