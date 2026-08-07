"""
Lightweight column migration helper.

Adds new nullable columns to existing tables without requiring Alembic.
Each migration is idempotent — safe to run on every startup.
"""
import logging

from sqlalchemy import func, text
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
    _add_job_manual_type_rate_columns(db)
    _add_so_detail_odoo_columns(db)
    _add_site_requisite_export_columns(db)
    _drop_so_detail_sales_order_unique(db)
    _create_daily_attendance_table(db)
    _make_daily_attendance_job_nullable(db)
    _add_attendance_photo_url(db)
    _add_attendance_manual_location(db)
    _add_attendance_checkout_columns(db)
    _add_attendance_report_data_and_job_unique(db)
    _add_admin_created_at(db)
    _create_invoice_requests_table(db)
    _create_admin_attendance_table(db)
    _add_admin_attendance_coordinates(db)
    _add_admin_attendance_manual_location(db)
    _add_admin_attendance_photo_url(db)
    _add_invoice_request_multi_invoice_columns(db)
    _add_job_checklist_document_link(db)
    _create_site_grn_tables(db)
    _make_site_grn_ip_optional(db)
    _add_grn_package_barcode_columns(db)
    _add_job_geofence_columns(db)
    _add_job_slot_columns(db)
    _add_job_completion_document_columns(db)
    _add_ip_financials_kyc_consent_at(db)
    _add_jobs_sales_order_column(db)
    _add_site_grn_odoo_sync_error_column(db)
    _add_job_status_log_actor_columns(db)
    _add_review_and_requisite_sync_columns(db)
    _create_purchase_order_requests_table(db)
    _add_admin_name_column(db)
    _add_job_drawing_document_column(db)
    _add_site_grn_job_id_column(db)
    _create_sunday_work_requests_table(db)
    _add_sunday_work_request_admin_id_column(db)
    _add_attendance_checkout_source_column(db)
    _add_admin_is_dev_column(db)
    _create_dev_audit_log_table(db)
    _create_job_approval_requests_table(db)
    _add_attendance_geofence_columns(db)
    _add_admin_attendance_geofence_columns(db)
    _add_job_rate_location_description_columns(db)
    _drop_legacy_job_columns(db)
    _enforce_business_invariants(db)
    from app.services.checklist_template_service import sync_checklist_templates

    sync_checklist_templates(db)
    _seed_dev_account(db)


def _add_admin_is_dev_column(db: Session) -> None:
    """Flag for the account that owns admin/superadmin lifecycle management."""
    if not _column_exists(db, "admin", "is_dev"):
        try:
            db.execute(text("ALTER TABLE admin ADD COLUMN is_dev BOOLEAN NOT NULL DEFAULT FALSE"))
            db.commit()
            logger.info("Migration: added column admin.is_dev")
        except Exception as exc:
            db.rollback()
            logger.error("Migration failed for admin.is_dev: %s", exc)
    else:
        logger.debug("Migration: admin.is_dev already exists, skipping.")


def _add_job_rate_location_description_columns(db: Session) -> None:
    """Rate cards are per (type, location), so the type alone can no longer be unique."""
    if _column_exists(db, "job_rates", "location"):
        logger.debug("Migration: job_rates.location already exists, skipping.")
        return
    statements = [
        "ALTER TABLE job_rates ADD COLUMN location VARCHAR NOT NULL DEFAULT ''",
        "ALTER TABLE job_rates ADD COLUMN description TEXT NULL",
        "ALTER TABLE job_rates DROP CONSTRAINT IF EXISTS job_rates_job_type_name_key",
        "DROP INDEX IF EXISTS job_rates_job_type_name_key",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_job_rate_type_location "
        "ON job_rates(job_type_name, location)",
    ]
    for stmt in statements:
        try:
            db.execute(text(stmt))
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.error("Migration failed for job_rates location/description: %s", exc)


def _add_job_slot_columns(db: Session) -> None:
    """Optional per-job attendance slot; when set it replaces the 10:30 check-in cutoff."""
    if _column_exists(db, "jobs", "slot_start"):
        logger.debug("Migration: jobs.slot_start already exists, skipping.")
        return
    statements = [
        "ALTER TABLE jobs ADD COLUMN slot_start TIME NULL",
        "ALTER TABLE jobs ADD COLUMN slot_end TIME NULL",
        """
        ALTER TABLE jobs ADD CONSTRAINT ck_job_slot_pair CHECK (
            (slot_start IS NULL) = (slot_end IS NULL)
            AND (slot_end IS NULL OR slot_end > slot_start)
        )
        """,
    ]
    for stmt in statements:
        try:
            db.execute(text(stmt))
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.error("Migration failed for jobs slot columns: %s", exc)


def _drop_legacy_job_columns(db: Session) -> None:
    """Drop jobs.name (use the customer's), checklist_link, and google_map_link (derived from the pin).

    The backup table is the only recovery path once the DROPs run, so it goes first.
    """
    if not _column_exists(db, "jobs", "name"):
        logger.debug("Migration: legacy job columns already dropped, skipping.")
        return
    statements = [
        "CREATE TABLE IF NOT EXISTS jobs_dropped_columns_backup AS "
        "SELECT id, name, checklist_link, google_map_link FROM jobs",
        "ALTER TABLE jobs DROP COLUMN IF EXISTS name",
        "ALTER TABLE jobs DROP COLUMN IF EXISTS checklist_link",
        "ALTER TABLE jobs DROP COLUMN IF EXISTS google_map_link",
    ]
    for stmt in statements:
        try:
            db.execute(text(stmt))
            db.commit()
            logger.info("Migration: %s", stmt.split(" AS ")[0][:80])
        except Exception as exc:
            db.rollback()
            logger.error("Migration failed dropping legacy job columns: %s", exc)


def _create_dev_audit_log_table(db: Session) -> None:
    """Append-only trail of privileged account actions."""
    try:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS dev_audit_log (
                id SERIAL PRIMARY KEY,
                actor_id INTEGER NOT NULL REFERENCES admin(id),
                action VARCHAR(64) NOT NULL,
                target_email VARCHAR(255),
                detail TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_dev_audit_log_actor ON dev_audit_log(actor_id)"))
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Migration failed creating dev_audit_log")
        raise


def _seed_dev_account(db: Session) -> None:
    """Bootstrap the dev account from DEV_EMAIL/DEV_PASSWORD.

    The password is written only when the row is created. Re-applying it on every
    boot would silently undo any later password change.
    """
    from app.config import settings
    from app.core.security import hash_password
    from app.model.user import User

    email = (settings.DEV_EMAIL or "").strip().lower()
    password = settings.DEV_PASSWORD or ""
    if not email or not password:
        logger.debug("Seed: DEV_EMAIL/DEV_PASSWORD not set, skipping dev account seed.")
        return

    try:
        existing = db.query(User).filter(func.lower(User.email) == email).one_or_none()
        if existing is None:
            db.add(User(
                email=email,
                name="Dev",
                password=hash_password(password),
                is_dev=True,
                is_superadmin=True,
                is_active=True,
                is_approved=True,
            ))
            logger.info("Seed: created dev account %s", email)
        else:
            # Re-grant access if the flags drifted, but never touch the password.
            existing.is_dev = True
            existing.is_superadmin = True
            existing.is_active = True
            existing.is_approved = True
            logger.debug("Seed: dev account %s already exists, flags reasserted.", email)
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Seed failed for dev account")


def _add_attendance_checkout_source_column(db: Session) -> None:
    """Distinguish a real check-out from one the midnight sweep created."""
    if not _column_exists(db, "daily_attendance", "checkout_source"):
        try:
            db.execute(text("ALTER TABLE daily_attendance ADD COLUMN checkout_source VARCHAR(16) NULL"))
            db.commit()
            logger.info("Migration: added column daily_attendance.checkout_source")
        except Exception as exc:
            db.rollback()
            logger.error("Migration failed for daily_attendance.checkout_source: %s", exc)
    else:
        logger.debug("Migration: daily_attendance.checkout_source already exists, skipping.")


def _add_sunday_work_request_admin_id_column(db: Session) -> None:
    """Let a supervisor file a Sunday work request too, not just an IP."""
    if _column_exists(db, "sunday_work_requests", "admin_id"):
        logger.debug("Migration: sunday_work_requests.admin_id already exists, skipping.")
        return
    statements = [
        "ALTER TABLE sunday_work_requests ADD COLUMN admin_id INTEGER NULL REFERENCES admin(id)",
        "ALTER TABLE sunday_work_requests ALTER COLUMN ip_user_id DROP NOT NULL",
        "CREATE INDEX IF NOT EXISTS ix_sunday_work_requests_admin_id ON sunday_work_requests(admin_id)",
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_sunday_work_request_admin_date
        ON sunday_work_requests(admin_id, request_date) WHERE admin_id IS NOT NULL
        """,
    ]
    for stmt in statements:
        try:
            db.execute(text(stmt))
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.error("Migration failed for sunday_work_requests.admin_id: %s", exc)


def _add_admin_name_column(db: Session) -> None:
    """Add name to admin so a supervisor's identity can be shown, not just their id/email."""
    if not _column_exists(db, "admin", "name"):
        try:
            db.execute(text("ALTER TABLE admin ADD COLUMN name VARCHAR NULL"))
            db.commit()
            logger.info("Migration: added column admin.name")
        except Exception as exc:
            db.rollback()
            logger.error("Migration failed for admin.name: %s", exc)
    else:
        logger.debug("Migration: admin.name already exists, skipping.")


def _add_job_drawing_document_column(db: Session) -> None:
    """Drawing document link, required upfront for site_validation/installation jobs."""
    if not _column_exists(db, "jobs", "drawing_document_link"):
        try:
            db.execute(text("ALTER TABLE jobs ADD COLUMN drawing_document_link VARCHAR NULL"))
            db.commit()
            logger.info("Migration: added column jobs.drawing_document_link")
        except Exception as exc:
            db.rollback()
            logger.error("Migration failed for jobs.drawing_document_link: %s", exc)
    else:
        logger.debug("Migration: jobs.drawing_document_link already exists, skipping.")


def _add_site_grn_job_id_column(db: Session) -> None:
    """Link a Site GRN to the job it was received for."""
    if not _column_exists(db, "site_grn", "job_id"):
        try:
            db.execute(text("ALTER TABLE site_grn ADD COLUMN job_id INTEGER NULL REFERENCES jobs(id)"))
            db.execute(text("CREATE INDEX IF NOT EXISTS ix_site_grn_job_id ON site_grn(job_id)"))
            db.commit()
            logger.info("Migration: added column site_grn.job_id")
        except Exception as exc:
            db.rollback()
            logger.error("Migration failed for site_grn.job_id: %s", exc)
    else:
        logger.debug("Migration: site_grn.job_id already exists, skipping.")


def _make_site_grn_ip_optional(db: Session) -> None:
    """A GRN with no IP is assigned to its creator."""
    dialect = getattr(getattr(getattr(db, "bind", None), "dialect", None), "name", None)
    if dialect != "postgresql":
        return
    try:
        db.execute(text("ALTER TABLE site_grn ALTER COLUMN ip_user_id DROP NOT NULL"))
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error("Migration failed making site_grn.ip_user_id optional: %s", exc)


def _create_sunday_work_requests_table(db: Session) -> None:
    """IP requests to work (check in) on a Sunday, stored for visibility and gated on superadmin approval."""
    statements = [
        """
        CREATE TABLE IF NOT EXISTS sunday_work_requests (
            id SERIAL PRIMARY KEY,
            ip_user_id INTEGER REFERENCES ip_user(id),
            request_date DATE NOT NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'pending',
            reason VARCHAR(500),
            reviewed_by_admin_id INTEGER REFERENCES admin(id),
            reviewed_at TIMESTAMPTZ,
            review_notes VARCHAR(500),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT ck_sunday_work_request_status CHECK (status IN ('pending', 'approved', 'rejected')),
            CONSTRAINT uq_sunday_work_request_ip_date UNIQUE (ip_user_id, request_date)
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_sunday_work_requests_ip_user_id ON sunday_work_requests(ip_user_id)",
        "CREATE INDEX IF NOT EXISTS ix_sunday_work_requests_status ON sunday_work_requests(status)",
    ]
    for stmt in statements:
        try:
            db.execute(text(stmt))
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.error("Migration failed for sunday_work_requests: %s", exc)


def _create_job_approval_requests_table(db: Session) -> None:
    """Superadmin approval as a fallback for starting/finishing a job without a customer OTP."""
    statements = [
        """
        CREATE TABLE IF NOT EXISTS job_approval_requests (
            id SERIAL PRIMARY KEY,
            job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
            action VARCHAR(16) NOT NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'pending',
            reason TEXT NOT NULL,
            requested_by_id INTEGER REFERENCES admin(id),
            requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            handover_document_link TEXT,
            ncr_document_link TEXT,
            project_report_document_link TEXT,
            reviewed_by_id INTEGER REFERENCES admin(id),
            reviewed_at TIMESTAMPTZ,
            review_notes TEXT,
            CONSTRAINT ck_job_approval_action CHECK (action IN ('start', 'finish')),
            CONSTRAINT ck_job_approval_status CHECK (status IN ('pending', 'approved', 'rejected'))
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_job_approval_requests_job_id ON job_approval_requests(job_id)",
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_one_pending_job_approval
        ON job_approval_requests(job_id, action) WHERE status = 'pending'
        """,
    ]
    for stmt in statements:
        try:
            db.execute(text(stmt))
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.error("Migration failed for job_approval_requests: %s", exc)


def _add_job_manual_type_rate_columns(db: Session) -> None:
    """Add manual job type/rate columns and backfill from legacy job_rates."""
    columns = [
        ("job_type", "VARCHAR"),
        ("rate_amount", "NUMERIC(10, 2)"),
    ]
    changed = False

    for col_name, col_type in columns:
        if not _column_exists(db, "jobs", col_name):
            try:
                db.execute(text(f"ALTER TABLE jobs ADD COLUMN {col_name} {col_type} NULL"))
                db.commit()
                changed = True
                logger.info("Migration: added column jobs.%s", col_name)
            except Exception as exc:
                db.rollback()
                logger.error("Migration failed for jobs.%s: %s", col_name, exc)
        else:
            logger.debug("Migration: jobs.%s already exists, skipping.", col_name)

    if not (_column_exists(db, "jobs", "job_type") and _column_exists(db, "jobs", "rate_amount")):
        return

    try:
        db.execute(
            text(
                """
                UPDATE jobs
                SET
                    job_type = COALESCE(jobs.job_type, job_rates.job_type_name),
                    rate_amount = COALESCE(jobs.rate_amount, job_rates.base_rate)
                FROM job_rates
                WHERE jobs.job_rate_id = job_rates.id
                  AND (jobs.job_type IS NULL OR jobs.rate_amount IS NULL)
                """
            )
        )
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_jobs_job_type ON jobs (job_type)"))
        db.commit()
        if changed:
            logger.info("Migration: backfilled jobs manual type/rate fields")
    except Exception as exc:
        db.rollback()
        logger.error("Migration failed backfilling jobs manual type/rate fields: %s", exc)


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
        ("odoo_repair_order_id", "INTEGER"),
        ("odoo_repair_order_name", "VARCHAR(255)"),
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


def _add_attendance_checkout_columns(db: Session) -> None:
    """Add explicit daily check-in/check-out fields and report storage."""
    columns = [
        ("ip_user_id", "INTEGER REFERENCES ip_user(id)"),
        ("attendance_date", "DATE"),
        ("attendance_type", "VARCHAR(16)"),
        ("report_document_url", "VARCHAR"),
    ]
    for col_name, col_type in columns:
        if not _column_exists(db, "daily_attendance", col_name):
            try:
                db.execute(text(f"ALTER TABLE daily_attendance ADD COLUMN {col_name} {col_type} NULL"))
                db.commit()
                logger.info("Migration: added column daily_attendance.%s", col_name)
            except Exception as exc:
                db.rollback()
                logger.error("Migration failed for daily_attendance.%s: %s", col_name, exc)

    try:
        db.execute(text("UPDATE daily_attendance SET attendance_date = recorded_at::date WHERE attendance_date IS NULL"))
        db.execute(text("UPDATE daily_attendance SET attendance_type = 'check_in' WHERE attendance_type IS NULL"))
        db.execute(text("ALTER TABLE daily_attendance ALTER COLUMN attendance_date SET DEFAULT CURRENT_DATE"))
        db.execute(text("ALTER TABLE daily_attendance ALTER COLUMN attendance_type SET DEFAULT 'check_in'"))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_daily_attendance_ip_user_id ON daily_attendance(ip_user_id)"))
        db.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_attendance_user_job_date_type
            ON daily_attendance(ip_user_id, job_id, attendance_date, attendance_type)
            WHERE ip_user_id IS NOT NULL AND job_id IS NOT NULL
        """))
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error("Migration failed finalizing attendance checkout columns: %s", exc)


def _add_attendance_report_data_and_job_unique(db: Session) -> None:
    """Store report form values and allow one attendance pair per job/day."""
    try:
        if not _column_exists(db, "daily_attendance", "report_data"):
            db.execute(text("ALTER TABLE daily_attendance ADD COLUMN report_data JSONB NULL"))
        db.execute(text(
            "ALTER TABLE daily_attendance "
            "DROP CONSTRAINT IF EXISTS uq_daily_attendance_user_date_type"
        ))
        db.execute(text("DROP INDEX IF EXISTS uq_daily_attendance_user_date_type"))
        db.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_attendance_user_job_date_type
            ON daily_attendance(ip_user_id, job_id, attendance_date, attendance_type)
            WHERE ip_user_id IS NOT NULL AND job_id IS NOT NULL
        """))
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error("Migration failed for attendance report data: %s", exc)


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
        ("requested_by_ip_id", "INTEGER REFERENCES ip_user(id)"),
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


def _add_job_checklist_document_link(db: Session) -> None:
    """Add document_link to jobs_checklists for checklist-level document uploads."""
    if not _column_exists(db, "jobs_checklists", "document_link"):
        try:
            db.execute(text("ALTER TABLE jobs_checklists ADD COLUMN document_link VARCHAR NULL"))
            db.commit()
            logger.info("Migration: added column jobs_checklists.document_link")
        except Exception as exc:
            db.rollback()
            logger.error("Migration failed for jobs_checklists.document_link: %s", exc)
    else:
        logger.debug("Migration: jobs_checklists.document_link already exists, skipping.")


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


def _create_site_grn_tables(db: Session) -> None:
    """Create site_grn and grn_package tables if they don't exist."""
    statements = [
        """
        CREATE TABLE IF NOT EXISTS site_grn (
            id SERIAL PRIMARY KEY,
            source_document VARCHAR(128) NOT NULL,
            odoo_picking_id INTEGER,
            ip_user_id INTEGER REFERENCES ip_user(id),
            created_by_admin_id INTEGER NOT NULL REFERENCES admin(id),
            status VARCHAR(32) NOT NULL DEFAULT 'pending',
            has_missing BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            submitted_at TIMESTAMPTZ
        )
        """,
        "ALTER TABLE site_grn ADD COLUMN IF NOT EXISTS odoo_picking_name VARCHAR(128)",
        "CREATE INDEX IF NOT EXISTS ix_site_grn_ip_user_id ON site_grn(ip_user_id)",
        "CREATE INDEX IF NOT EXISTS ix_site_grn_source_document ON site_grn(source_document)",
        """
        CREATE TABLE IF NOT EXISTS grn_package (
            id SERIAL PRIMARY KEY,
            grn_id INTEGER NOT NULL REFERENCES site_grn(id) ON DELETE CASCADE,
            odoo_package_id INTEGER,
            package_name VARCHAR(256) NOT NULL,
            is_received BOOLEAN NOT NULL DEFAULT FALSE
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_grn_package_grn_id ON grn_package(grn_id)",
    ]
    for stmt in statements:
        try:
            db.execute(text(stmt))
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.error("Migration failed for site_grn tables: %s", exc)


def _add_grn_package_barcode_columns(db: Session) -> None:
    """Add barcode and odoo_line_id to grn_package for Odoo line writeback."""
    columns = [
        ("barcode", "VARCHAR(256)"),
        ("odoo_line_id", "INTEGER"),
    ]
    for col_name, col_type in columns:
        if not _column_exists(db, "grn_package", col_name):
            try:
                db.execute(text(f"ALTER TABLE grn_package ADD COLUMN {col_name} {col_type} NULL"))
                db.commit()
                logger.info("Migration: added column grn_package.%s", col_name)
            except Exception as exc:
                db.rollback()
                logger.error("Migration failed for grn_package.%s: %s", col_name, exc)
        else:
            logger.debug("Migration: grn_package.%s already exists, skipping.", col_name)


def _add_job_geofence_columns(db: Session) -> None:
    """Add map pin coordinates and geofence radius to jobs."""
    columns = [
        ("latitude", "DOUBLE PRECISION"),
        ("longitude", "DOUBLE PRECISION"),
        ("geofence_radius", "INTEGER"),
    ]
    for col_name, col_type in columns:
        if not _column_exists(db, "jobs", col_name):
            try:
                db.execute(text(f"ALTER TABLE jobs ADD COLUMN {col_name} {col_type} NULL"))
                db.commit()
                logger.info("Migration: added column jobs.%s", col_name)
            except Exception as exc:
                db.rollback()
                logger.error("Migration failed for jobs.%s: %s", col_name, exc)
        else:
            logger.debug("Migration: jobs.%s already exists, skipping.", col_name)


def _add_attendance_geofence_columns(db: Session) -> None:
    """Record how far an IP's check-in fix was from the job pin, and if it was inside."""
    columns = [
        ("distance_meters", "DOUBLE PRECISION"),
        ("within_geofence", "BOOLEAN"),
    ]
    for col_name, col_type in columns:
        if not _column_exists(db, "daily_attendance", col_name):
            try:
                db.execute(text(f"ALTER TABLE daily_attendance ADD COLUMN {col_name} {col_type} NULL"))
                db.commit()
                logger.info("Migration: added column daily_attendance.%s", col_name)
            except Exception as exc:
                db.rollback()
                logger.error("Migration failed for daily_attendance.%s: %s", col_name, exc)
        else:
            logger.debug("Migration: daily_attendance.%s already exists, skipping.", col_name)


def _add_admin_attendance_geofence_columns(db: Session) -> None:
    """Same for supervisors, plus which job pin the fix was matched against."""
    columns = [
        ("matched_job_id", "INTEGER"),
        ("distance_meters", "DOUBLE PRECISION"),
        ("within_geofence", "BOOLEAN"),
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


def _add_job_completion_document_columns(db: Session) -> None:
    """Store the three documents required when an admin completes a job."""
    for col_name in (
        "handover_document_link",
        "ncr_document_link",
        "project_report_document_link",
    ):
        if not _column_exists(db, "jobs", col_name):
            try:
                db.execute(text(f"ALTER TABLE jobs ADD COLUMN {col_name} VARCHAR NULL"))
                db.commit()
                logger.info("Migration: added column jobs.%s", col_name)
            except Exception as exc:
                db.rollback()
                logger.error("Migration failed for jobs.%s: %s", col_name, exc)


def _add_ip_financials_kyc_consent_at(db: Session) -> None:
    """Add kyc_consent_at to ip_financials if missing."""
    if not _column_exists(db, "ip_financials", "kyc_consent_at"):
        try:
            db.execute(text("ALTER TABLE ip_financials ADD COLUMN kyc_consent_at TIMESTAMPTZ NULL"))
            db.commit()
            logger.info("Migration: added column ip_financials.kyc_consent_at")
        except Exception as exc:
            db.rollback()
            logger.error("Migration failed for ip_financials.kyc_consent_at: %s", exc)
    else:
        logger.debug("Migration: ip_financials.kyc_consent_at already exists, skipping.")


def _add_jobs_sales_order_column(db: Session) -> None:
    """Add sales_order to jobs if missing."""
    if not _column_exists(db, "jobs", "sales_order"):
        try:
            db.execute(text("ALTER TABLE jobs ADD COLUMN sales_order VARCHAR(100) NULL"))
            db.execute(text("CREATE INDEX IF NOT EXISTS ix_jobs_sales_order ON jobs (sales_order)"))
            db.commit()
            logger.info("Migration: added column jobs.sales_order")
        except Exception as exc:
            db.rollback()
            logger.error("Migration failed for jobs.sales_order: %s", exc)
    else:
        logger.debug("Migration: jobs.sales_order already exists, skipping.")


def _add_site_grn_odoo_sync_error_column(db: Session) -> None:
    """Add odoo_sync_error to site_grn if missing."""
    if not _column_exists(db, "site_grn", "odoo_sync_error"):
        try:
            db.execute(text("ALTER TABLE site_grn ADD COLUMN odoo_sync_error VARCHAR(1024) NULL"))
            db.commit()
            logger.info("Migration: added column site_grn.odoo_sync_error")
        except Exception as exc:
            db.rollback()
            logger.error("Migration failed for site_grn.odoo_sync_error: %s", exc)
    else:
        logger.debug("Migration: site_grn.odoo_sync_error already exists, skipping.")


def _add_job_status_log_actor_columns(db: Session) -> None:
    """Add actor_type and actor_id to job_status_logs if missing."""
    columns = [
        ("actor_type", "VARCHAR(16)"),
        ("actor_id", "INTEGER"),
    ]
    for col_name, col_type in columns:
        if not _column_exists(db, "job_status_logs", col_name):
            try:
                db.execute(text(f"ALTER TABLE job_status_logs ADD COLUMN {col_name} {col_type} NULL"))
                db.commit()
                logger.info("Migration: added column job_status_logs.%s", col_name)
            except Exception as exc:
                db.rollback()
                logger.error("Migration failed for job_status_logs.%s: %s", col_name, exc)
        else:
            logger.debug("Migration: job_status_logs.%s already exists, skipping.", col_name)


def _add_review_and_requisite_sync_columns(db: Session) -> None:
    """Install state columns that the current business logic requires."""
    statements = [
        "ALTER TABLE jobs_checklist_item_status ADD COLUMN IF NOT EXISTS review_status VARCHAR(16)",
        """
        UPDATE jobs_checklist_item_status
        SET review_status = CASE
            WHEN is_approved IS TRUE THEN 'approved'
            WHEN NULLIF(BTRIM(admin_comment), '') IS NOT NULL THEN 'rejected'
            ELSE 'pending'
        END
        WHERE review_status IS NULL
        """,
        "ALTER TABLE jobs_checklist_item_status ALTER COLUMN review_status SET DEFAULT 'pending'",
        "ALTER TABLE jobs_checklist_item_status ALTER COLUMN review_status SET NOT NULL",
        "UPDATE so_detail SET status = 'pending' WHERE status IS NULL",
        "ALTER TABLE so_detail ALTER COLUMN status SET DEFAULT 'pending'",
        "ALTER TABLE so_detail ALTER COLUMN status SET NOT NULL",
        "ALTER TABLE so_detail ADD COLUMN IF NOT EXISTS odoo_sync_status VARCHAR(20)",
        "ALTER TABLE so_detail ADD COLUMN IF NOT EXISTS odoo_sync_error VARCHAR(1024)",
        "ALTER TABLE so_detail ADD COLUMN IF NOT EXISTS odoo_sync_key VARCHAR(64)",
        "UPDATE so_detail SET odoo_sync_status = CASE WHEN odoo_repair_order_id IS NULL THEN 'failed' ELSE 'synced' END WHERE odoo_sync_status IS NULL",
        "UPDATE so_detail SET odoo_sync_key = 'site-requisite-legacy-' || id WHERE odoo_sync_key IS NULL",
        "ALTER TABLE so_detail ALTER COLUMN odoo_sync_status SET DEFAULT 'pending'",
        "ALTER TABLE so_detail ALTER COLUMN odoo_sync_status SET NOT NULL",
        "ALTER TABLE so_detail ALTER COLUMN odoo_sync_key SET NOT NULL",
        "ALTER TABLE daily_attendance ALTER COLUMN attendance_date SET NOT NULL",
        "ALTER TABLE daily_attendance ALTER COLUMN attendance_type SET NOT NULL",
    ]
    try:
        for statement in statements:
            db.execute(text(statement))
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Invariant migration failed while adding review/sync columns")
        raise


def _create_purchase_order_requests_table(db: Session) -> None:
    """Install the local approval queue before any purchase.order is created."""
    try:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS purchase_order_requests (
                id SERIAL PRIMARY KEY,
                requested_by_id INTEGER NOT NULL REFERENCES admin(id),
                approved_by_id INTEGER REFERENCES admin(id),
                vendor_id INTEGER NOT NULL,
                vendor_name VARCHAR(255) NOT NULL,
                sales_order VARCHAR(100),
                poc_name VARCHAR(255),
                service_type VARCHAR(3) NOT NULL,
                product_name VARCHAR(255) NOT NULL,
                quantity NUMERIC(12, 2) NOT NULL,
                unit_price NUMERIC(12, 2) NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                approved_at TIMESTAMPTZ,
                po_number VARCHAR(30),
                odoo_sync_key VARCHAR(80) NOT NULL UNIQUE,
                odoo_purchase_order_id INTEGER,
                odoo_purchase_order_name VARCHAR(80),
                odoo_sync_error TEXT,
                bill_status VARCHAR(20) NOT NULL DEFAULT 'not_requested',
                bill_requested_by_id INTEGER REFERENCES admin(id),
                bill_requested_at TIMESTAMPTZ,
                bill_approved_by_id INTEGER REFERENCES admin(id),
                bill_approved_at TIMESTAMPTZ,
                odoo_vendor_bill_id INTEGER,
                odoo_vendor_bill_name VARCHAR(80),
                bill_sync_error TEXT
            )
        """))
        db.execute(text("ALTER TABLE purchase_order_requests ADD COLUMN IF NOT EXISTS sales_order VARCHAR(100)"))
        db.execute(text("ALTER TABLE purchase_order_requests ADD COLUMN IF NOT EXISTS poc_name VARCHAR(255)"))
        db.execute(text("ALTER TABLE purchase_order_requests ADD COLUMN IF NOT EXISTS bill_status VARCHAR(20) NOT NULL DEFAULT 'not_requested'"))
        db.execute(text("ALTER TABLE purchase_order_requests ADD COLUMN IF NOT EXISTS bill_requested_by_id INTEGER REFERENCES admin(id)"))
        db.execute(text("ALTER TABLE purchase_order_requests ADD COLUMN IF NOT EXISTS bill_requested_at TIMESTAMPTZ"))
        db.execute(text("ALTER TABLE purchase_order_requests ADD COLUMN IF NOT EXISTS bill_approved_by_id INTEGER REFERENCES admin(id)"))
        db.execute(text("ALTER TABLE purchase_order_requests ADD COLUMN IF NOT EXISTS bill_approved_at TIMESTAMPTZ"))
        db.execute(text("ALTER TABLE purchase_order_requests ADD COLUMN IF NOT EXISTS odoo_vendor_bill_id INTEGER"))
        db.execute(text("ALTER TABLE purchase_order_requests ADD COLUMN IF NOT EXISTS odoo_vendor_bill_name VARCHAR(80)"))
        db.execute(text("ALTER TABLE purchase_order_requests ADD COLUMN IF NOT EXISTS bill_sync_error TEXT"))
        db.execute(text("ALTER TABLE purchase_order_requests ADD COLUMN IF NOT EXISTS po_number VARCHAR(30)"))
        db.execute(text(
            "UPDATE purchase_order_requests "
            "SET po_number = 'PO-' || to_char(requested_at, 'YYYY') || '-' || lpad(id::text, 4, '0') "
            "WHERE po_number IS NULL"
        ))
        db.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_purchase_order_requests_po_number ON purchase_order_requests(po_number)"))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_po_requests_requested_by ON purchase_order_requests(requested_by_id)"))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_po_requests_status ON purchase_order_requests(status)"))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_po_requests_bill_status ON purchase_order_requests(bill_status)"))
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Migration failed creating purchase_order_requests")
        raise


def _enforce_business_invariants(db: Session) -> None:
    """Install model-declared business constraints and fail startup on drift."""
    indexes = [
        """
        CREATE TEMP TABLE site_grn_duplicates_to_delete ON COMMIT DROP AS
        SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (
                    PARTITION BY odoo_picking_id
                    ORDER BY
                        CASE status WHEN 'processed' THEN 2 WHEN 'submitted' THEN 1 ELSE 0 END DESC,
                        (SELECT COUNT(*) FROM grn_package WHERE grn_id = site_grn.id AND is_received) DESC,
                        (SELECT COUNT(*) FROM grn_package WHERE grn_id = site_grn.id AND NULLIF(BTRIM(barcode), '') IS NOT NULL) DESC,
                        submitted_at DESC NULLS LAST,
                        created_at DESC NULLS LAST,
                        id DESC
                ) AS duplicate_rank
            FROM site_grn
            WHERE odoo_picking_id IS NOT NULL
        ) ranked
        WHERE duplicate_rank > 1
        """,
        "DELETE FROM grn_package WHERE grn_id IN (SELECT id FROM site_grn_duplicates_to_delete)",
        "DELETE FROM site_grn WHERE id IN (SELECT id FROM site_grn_duplicates_to_delete)",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_one_pending_invoice_per_job ON invoice_requests(job_id) WHERE status = 'pending'",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_site_grn_odoo_picking ON site_grn(odoo_picking_id) WHERE odoo_picking_id IS NOT NULL",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_sodetail_odoo_sync_key ON so_detail(odoo_sync_key)",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_ip_admin_assignment ON ip_user_admin_assignments(ip_id, admin_id)",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_job_checklist ON jobs_checklists(job_id, checklist_id)",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_job_checklist_item ON jobs_checklist_item_status(job_id, checklist_item_id)",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_attendance_user_job_date_type ON daily_attendance(ip_user_id, job_id, attendance_date, attendance_type) WHERE ip_user_id IS NOT NULL AND job_id IS NOT NULL",
    ]
    checks = [
        ("invoice_requests", "ck_invoice_status", "status IN ('pending', 'approved', 'rejected')"),
        ("invoice_requests", "ck_invoice_completion_percentage", "completion_percentage IS NULL OR completion_percentage BETWEEN 0 AND 100"),
        ("site_grn", "ck_grn_status", "status IN ('pending', 'submitted', 'processed')"),
        ("jobs_checklist_item_status", "ck_checklist_item_review_status", "review_status IN ('pending', 'approved', 'rejected')"),
        ("so_detail", "ck_sodetail_status", "status IN ('pending', 'completed')"),
        ("so_detail", "ck_sodetail_odoo_sync_status", "odoo_sync_status IN ('pending', 'synced', 'failed')"),
        ("daily_attendance", "ck_daily_attendance_type", "attendance_type IN ('check_in', 'check_out')"),
        ("jobs", "ck_job_status", "status IN ('created', 'pending_approval', 'creation_rejected', 'in_progress', 'paused', 'completed')"),
        ("jobs", "ck_job_incentive_positive", "incentive >= 0"),
        ("jobs", "ck_job_rate_amount_positive", "rate_amount >= 0"),
        ("jobs", "ck_job_area_positive", "area >= 0"),
        ("jobs", "ck_job_latitude_range", "latitude BETWEEN -90 AND 90"),
        ("jobs", "ck_job_longitude_range", "longitude BETWEEN -180 AND 180"),
        ("purchase_order_requests", "ck_po_request_service_type", "service_type IN ('b2b', 'b2c')"),
        ("purchase_order_requests", "ck_po_request_status", "status IN ('pending', 'approved')"),
        ("purchase_order_requests", "ck_po_request_bill_status", "bill_status IN ('not_requested', 'pending', 'approved')"),
        ("purchase_order_requests", "ck_po_request_quantity_positive", "quantity > 0"),
        ("purchase_order_requests", "ck_po_request_unit_price_positive", "unit_price > 0"),
        ("job_approval_requests", "ck_job_approval_action", "action IN ('start', 'finish')"),
        ("job_approval_requests", "ck_job_approval_status", "status IN ('pending', 'approved', 'rejected')"),
    ]
    try:
        for statement in indexes:
            db.execute(text(statement))
        for table, name, expression in checks:
            db.execute(text(f"""
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '{name}') THEN
                        ALTER TABLE {table} ADD CONSTRAINT {name} CHECK ({expression});
                    END IF;
                END $$
            """))
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Business invariant migration failed")
        raise
