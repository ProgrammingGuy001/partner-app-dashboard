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


def run_migrations(db: Session) -> None:
    """Run all pending column migrations."""
    _add_so_detail_odoo_columns(db)
    _add_site_requisite_export_columns(db)
    _drop_so_detail_sales_order_unique(db)


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
    """Drop unique constraint on so_detail.sales_order to allow multiple requisites per SO."""
    try:
        # PostgreSQL: check if the unique constraint still exists
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
            db.commit()
            logger.info("Migration: dropped unique constraint on so_detail.sales_order")
        else:
            logger.debug("Migration: so_detail.sales_order unique constraint already dropped.")
    except Exception as exc:
        db.rollback()
        logger.error("Migration failed dropping so_detail unique constraint: %s", exc)


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
