"""allow a job to occupy both roster slots of one day for the same IP

Revision ID: 0006_roster_full_day
Revises: 0006
Create Date: 2026-08-19
"""
from alembic import op

revision = "0006_roster_full_day"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # An eight-hour installation books both halves of the day for one IP. The per-slot
    # uniqueness still holds, so nobody is in two places at once.
    op.execute(
        "ALTER TABLE job_roster_entries "
        "DROP CONSTRAINT IF EXISTS uq_roster_job_ip_date"
    )


def downgrade() -> None:
    op.create_unique_constraint(
        "uq_roster_job_ip_date", "job_roster_entries", ["job_id", "ip_user_id", "work_date"]
    )
