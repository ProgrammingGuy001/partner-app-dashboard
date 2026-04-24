"""
Lightweight column migration helper.

Adds new nullable columns to existing tables without requiring Alembic.
Each migration is idempotent — safe to run on every startup.
"""
import logging

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def _column_exists(db: Session, table: str, column: str) -> bool:
    result = db.execute(
        text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = :table AND column_name = :column"
        ),
        {"table": table, "column": column},
    )
    return result.fetchone() is not None


def _column_is_nullable(db: Session, table: str, column: str) -> bool:
    result = db.execute(
        text(
            "SELECT is_nullable FROM information_schema.columns "
            "WHERE table_name = :table AND column_name = :column"
        ),
        {"table": table, "column": column},
    )
    row = result.fetchone()
    return row is None or row[0] == "YES"


def run_migrations(db: Session) -> None:
    """Run all pending column migrations."""
    _add_so_detail_odoo_columns(db)
    _add_site_requisite_export_columns(db)
    _drop_so_detail_sales_order_unique(db)
    _create_daily_attendance_table(db)
    _make_daily_attendance_job_nullable(db)
    _add_attendance_photo_url(db)
    _add_attendance_manual_location(db)
    _add_admin_created_at(db)
    _create_invoice_requests_table(db)
    _create_admin_attendance_table(db)
    _add_admin_attendance_coordinates(db)
    _add_admin_attendance_manual_location(db)
    _add_admin_attendance_photo_url(db)
    _add_invoice_request_multi_invoice_columns(db)


def _add_so_detail_odoo_columns(db: Session) -> None:
    """Add Odoo-enriched fields to so_detail if they don't exist."""
    columns = [
        ("customer_name", "VARCHAR(512)"),
        ("project_name", "VARCHAR(512)"),
        ("delivery_address", "TEXT"),
        ("so_poc", "VARCHAR(255)"),
        ("so_status", "VARCHAR(100)"),
        ("repair_reference", "VARCHAR(255)"),
        ("expected_delivery", "DATE"),
        ("do_number", "VARCHAR(255)"),
    ]
    for col_name, col_type in columns:
        if not _column_exists(db, "so_detail", col_name):
            try:
                db.execute(
                    text(f"ALTER TABLE so_detail ADD COLUMN {col_name} {col_type}")
                )
                db.commit()
                logger.info("Migration: added column so_detail.%s", col_name)
            except Exception as exc:
                db.rollback()
                logger.error("Migration failed for so_detail.%s: %s", col_name, exc)
        else:
            logger.debug("Migration: so_detail.%s already exists, skipping.", col_name)


def _drop_so_detail_sales_order_unique(db: Session) -> None:
    """Drop legacy uniqueness on so_detail.sales_order to allow multiple requisites per SO."""
    dialect = db.bind.dialect.name if db.bind is not None else ""
    changed = False

    try:
        result = db.execute(
            text(
                "SELECT 1 FROM information_schema.table_constraints "
                "WHERE table_name = 'so_detail' "
                "AND constraint_name = 'so_detail_sales_order_key' "
                "AND constraint_type = 'UNIQUE'"
            )
        )
        if result.fetchone():
            db.execute(text("ALTER TABLE so_detail DROP CONSTRAINT so_detail_sales_order_key"))
            changed = True
            logger.info("Migration: dropped unique constraint on so_detail.sales_order")

        if dialect == "postgresql":
            index_result = db.execute(
                text(
                    "SELECT 1 FROM pg_indexes "
                    "WHERE schemaname = current_schema() "
                    "AND tablename = 'so_detail' "
                    "AND indexname = 'ix_so_detail_sales_order'"
                )
            )
            if index_result.fetchone():
                db.execute(text("DROP INDEX IF EXISTS ix_so_detail_sales_order"))
                changed = True
                logger.info("Migration: dropped unique index ix_so_detail_sales_order")

        if changed:
            db.commit()
        else:
            logger.debug("Migration: so_detail.sales_order uniqueness already removed.")
    except Exception as exc:
        db.rollback()
        logger.error("Migration failed dropping so_detail unique constraint: %s", exc)


def _create_daily_attendance_table(db: Session) -> None:
    """Create daily_attendance table if it doesn't exist."""
    try:
        result = db.execute(
            text(
                "SELECT 1 FROM information_schema.tables "
                "WHERE table_name = 'daily_attendance'"
            )
        )
        if result.fetchone():
            logger.debug("Migration: daily_attendance table already exists, skipping.")
            return

        db.execute(text("""
            CREATE TABLE daily_attendance (
                id SERIAL PRIMARY KEY,
                job_id INTEGER NULL REFERENCES jobs(id),
                phone VARCHAR NOT NULL,
                latitude DOUBLE PRECISION NOT NULL,
                longitude DOUBLE PRECISION NOT NULL,
                manual_location VARCHAR NULL,
                recorded_at TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        db.execute(text("CREATE INDEX ix_daily_attendance_id ON daily_attendance (id)"))
        db.execute(text("CREATE INDEX ix_daily_attendance_job_id ON daily_attendance (job_id)"))
        db.commit()
        logger.info("Migration: created daily_attendance table")
    except Exception as exc:
        db.rollback()
        logger.error("Migration failed creating daily_attendance: %s", exc)


def _make_daily_attendance_job_nullable(db: Session) -> None:
    """Allow IP attendance to be recorded independently of jobs."""
    if not _column_exists(db, "daily_attendance", "job_id"):
        logger.debug("Migration: daily_attendance.job_id missing, skipping nullable migration.")
        return
    if _column_is_nullable(db, "daily_attendance", "job_id"):
        logger.debug("Migration: daily_attendance.job_id already nullable, skipping.")
        return

    try:
        db.execute(text("ALTER TABLE daily_attendance ALTER COLUMN job_id DROP NOT NULL"))
        db.commit()
        logger.info("Migration: made daily_attendance.job_id nullable")
    except Exception as exc:
        db.rollback()
        logger.error("Migration failed making daily_attendance.job_id nullable: %s", exc)


def _add_attendance_photo_url(db: Session) -> None:
    """Add photo_url column to daily_attendance if missing."""
    if not _column_exists(db, "daily_attendance", "photo_url"):
        try:
            db.execute(text("ALTER TABLE daily_attendance ADD COLUMN photo_url VARCHAR NULL"))
            db.commit()
            logger.info("Migration: added column daily_attendance.photo_url")
        except Exception as exc:
            db.rollback()
            logger.error("Migration failed for daily_attendance.photo_url: %s", exc)
    else:
        logger.debug("Migration: daily_attendance.photo_url already exists, skipping.")


def _add_attendance_manual_location(db: Session) -> None:
    """Add manual location text to IP attendance records if missing."""
    if not _column_exists(db, "daily_attendance", "manual_location"):
        try:
            db.execute(text("ALTER TABLE daily_attendance ADD COLUMN manual_location VARCHAR NULL"))
            db.commit()
            logger.info("Migration: added column daily_attendance.manual_location")
        except Exception as exc:
            db.rollback()
            logger.error("Migration failed for daily_attendance.manual_location: %s", exc)
    else:
        logger.debug("Migration: daily_attendance.manual_location already exists, skipping.")


def _add_admin_created_at(db: Session) -> None:
    """Track admin registration date for attendance completion reporting."""
    if not _column_exists(db, "admin", "created_at"):
        try:
            db.execute(text("ALTER TABLE admin ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"))
            db.commit()
            logger.info("Migration: added column admin.created_at")
        except Exception as exc:
            db.rollback()
            logger.error("Migration failed for admin.created_at: %s", exc)
    else:
        logger.debug("Migration: admin.created_at already exists, skipping.")


def _create_invoice_requests_table(db: Session) -> None:
    """Create invoice_requests table if it doesn't exist."""
    try:
        result = db.execute(
            text("SELECT 1 FROM information_schema.tables WHERE table_name = 'invoice_requests'")
        )
        if result.fetchone():
            logger.debug("Migration: invoice_requests table already exists, skipping.")
            return

        db.execute(text("""
            CREATE TABLE invoice_requests (
                id SERIAL PRIMARY KEY,
                job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                requested_at TIMESTAMPTZ DEFAULT NOW(),
                requested_by_id INTEGER REFERENCES admin(id),
                invoice_number VARCHAR(80),
                completion_percentage INTEGER,
                notes TEXT,
                approved_at TIMESTAMPTZ,
                approved_by_id INTEGER REFERENCES admin(id),
                rejection_reason TEXT
            )
        """))
        db.execute(text("CREATE INDEX ix_invoice_requests_job_id ON invoice_requests (job_id)"))
        db.execute(text("CREATE INDEX ix_invoice_requests_status ON invoice_requests (status)"))
        db.commit()
        logger.info("Migration: created invoice_requests table")
    except Exception as exc:
        db.rollback()
        logger.error("Migration failed creating invoice_requests: %s", exc)


def _create_admin_attendance_table(db: Session) -> None:
    """Create admin_attendance table if it doesn't exist."""
    try:
        result = db.execute(
            text("SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_attendance'")
        )
        if result.fetchone():
            logger.debug("Migration: admin_attendance table already exists, skipping.")
            return

        db.execute(text("""
            CREATE TABLE admin_attendance (
                id SERIAL PRIMARY KEY,
                admin_id INTEGER NOT NULL REFERENCES admin(id) ON DELETE CASCADE,
                marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                latitude DOUBLE PRECISION NULL,
                longitude DOUBLE PRECISION NULL,
                manual_location VARCHAR NULL,
                photo_url VARCHAR NULL,
                notes VARCHAR NULL
            )
        """))
        db.execute(text("CREATE INDEX ix_admin_attendance_admin_id ON admin_attendance (admin_id)"))
        db.execute(text("CREATE INDEX ix_admin_attendance_marked_at ON admin_attendance (marked_at)"))
        db.commit()
        logger.info("Migration: created admin_attendance table")
    except Exception as exc:
        db.rollback()
        logger.error("Migration failed creating admin_attendance: %s", exc)


def _add_admin_attendance_coordinates(db: Session) -> None:
    """Add GPS coordinates to admin attendance records if missing."""
    columns = [
        ("latitude", "DOUBLE PRECISION"),
        ("longitude", "DOUBLE PRECISION"),
    ]
    for col_name, col_type in columns:
        if not _column_exists(db, "admin_attendance", col_name):
            try:
                db.execute(text(f"ALTER TABLE admin_attendance ADD COLUMN {col_name} {col_type} NULL"))
                db.commit()
                logger.info("Migration: added column admin_attendance.%s", col_name)
            except Exception as exc:
                db.rollback()
                logger.error("Migration failed for admin_attendance.%s: %s", col_name, exc)
        else:
            logger.debug("Migration: admin_attendance.%s already exists, skipping.", col_name)


def _add_admin_attendance_manual_location(db: Session) -> None:
    """Add manual location text to admin attendance records if missing."""
    if not _column_exists(db, "admin_attendance", "manual_location"):
        try:
            db.execute(text("ALTER TABLE admin_attendance ADD COLUMN manual_location VARCHAR NULL"))
            db.commit()
            logger.info("Migration: added column admin_attendance.manual_location")
        except Exception as exc:
            db.rollback()
            logger.error("Migration failed for admin_attendance.manual_location: %s", exc)
    else:
        logger.debug("Migration: admin_attendance.manual_location already exists, skipping.")


def _add_admin_attendance_photo_url(db: Session) -> None:
    """Add optional photo URL to admin attendance records if missing."""
    if not _column_exists(db, "admin_attendance", "photo_url"):
        try:
            db.execute(text("ALTER TABLE admin_attendance ADD COLUMN photo_url VARCHAR NULL"))
            db.commit()
            logger.info("Migration: added column admin_attendance.photo_url")
        except Exception as exc:
            db.rollback()
            logger.error("Migration failed for admin_attendance.photo_url: %s", exc)
    else:
        logger.debug("Migration: admin_attendance.photo_url already exists, skipping.")


def _add_invoice_request_multi_invoice_columns(db: Session) -> None:
    """Add fields needed for multiple completion-based invoice requests."""
    columns = [
        ("invoice_number", "VARCHAR(80)"),
        ("completion_percentage", "INTEGER"),
        ("notes", "TEXT"),
    ]
    for col_name, col_type in columns:
        if not _column_exists(db, "invoice_requests", col_name):
            try:
                db.execute(text(f"ALTER TABLE invoice_requests ADD COLUMN {col_name} {col_type} NULL"))
                db.commit()
                logger.info("Migration: added column invoice_requests.%s", col_name)
            except Exception as exc:
                db.rollback()
                logger.error("Migration failed for invoice_requests.%s: %s", col_name, exc)
        else:
            logger.debug("Migration: invoice_requests.%s already exists, skipping.", col_name)


def _add_site_requisite_export_columns(db: Session) -> None:
    """Add export-related fields to site_requisite if they don't exist."""
    columns = [
        ("component_status", "VARCHAR(100)"),
    ]
    for col_name, col_type in columns:
        if not _column_exists(db, "site_requisite", col_name):
            try:
                db.execute(
                    text(f"ALTER TABLE site_requisite ADD COLUMN {col_name} {col_type}")
                )
                db.commit()
                logger.info("Migration: added column site_requisite.%s", col_name)
            except Exception as exc:
                db.rollback()
                logger.error("Migration failed for site_requisite.%s: %s", col_name, exc)
        else:
            logger.debug("Migration: site_requisite.%s already exists, skipping.", col_name)
