"""add daily job roster

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-13
"""
from datetime import time

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "roster_slot_settings",
        sa.Column("slot_number", sa.Integer(), autoincrement=False, nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("updated_by_admin_id", sa.BigInteger(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("slot_number IN (1, 2)", name="ck_roster_slot_number"),
        sa.CheckConstraint("end_time > start_time", name="ck_roster_slot_time_order"),
        sa.ForeignKeyConstraint(["updated_by_admin_id"], ["admin.id"]),
        sa.PrimaryKeyConstraint("slot_number"),
    )
    slot_table = sa.table(
        "roster_slot_settings",
        sa.column("slot_number", sa.Integer()),
        sa.column("start_time", sa.Time()),
        sa.column("end_time", sa.Time()),
    )
    op.bulk_insert(
        slot_table,
        [
            {"slot_number": 1, "start_time": time(10), "end_time": time(14)},
            {"slot_number": 2, "start_time": time(15), "end_time": time(18)},
        ],
    )

    op.create_table(
        "job_roster_entries",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("job_id", sa.Integer(), nullable=False),
        sa.Column("ip_user_id", sa.Integer(), nullable=False),
        sa.Column("work_date", sa.Date(), nullable=False),
        sa.Column("slot_number", sa.Integer(), nullable=False),
        sa.Column("slot_start", sa.Time(), nullable=False),
        sa.Column("slot_end", sa.Time(), nullable=False),
        sa.Column("created_by_admin_id", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("slot_number IN (1, 2)", name="ck_job_roster_slot_number"),
        sa.CheckConstraint("slot_end > slot_start", name="ck_job_roster_time_order"),
        sa.ForeignKeyConstraint(["created_by_admin_id"], ["admin.id"]),
        sa.ForeignKeyConstraint(["ip_user_id"], ["ip_user.id"]),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"]),
        sa.ForeignKeyConstraint(["slot_number"], ["roster_slot_settings.slot_number"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("ip_user_id", "work_date", "slot_number", name="uq_roster_ip_date_slot"),
        sa.UniqueConstraint("job_id", "work_date", "slot_number", name="uq_roster_job_date_slot"),
        sa.UniqueConstraint("job_id", "ip_user_id", "work_date", name="uq_roster_job_ip_date"),
    )
    op.create_index("ix_job_roster_entries_job_id", "job_roster_entries", ["job_id"])
    op.create_index("ix_job_roster_entries_ip_user_id", "job_roster_entries", ["ip_user_id"])
    op.create_index("ix_job_roster_entries_work_date", "job_roster_entries", ["work_date"])

    op.add_column(
        "daily_attendance", sa.Column("roster_entry_id", sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        "fk_daily_attendance_roster_entry",
        "daily_attendance",
        "job_roster_entries",
        ["roster_entry_id"],
        ["id"],
    )
    op.create_index(
        "ix_daily_attendance_roster_entry_id", "daily_attendance", ["roster_entry_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_daily_attendance_roster_entry_id", table_name="daily_attendance")
    op.drop_constraint(
        "fk_daily_attendance_roster_entry", "daily_attendance", type_="foreignkey"
    )
    op.drop_column("daily_attendance", "roster_entry_id")
    op.drop_table("job_roster_entries")
    op.drop_table("roster_slot_settings")
