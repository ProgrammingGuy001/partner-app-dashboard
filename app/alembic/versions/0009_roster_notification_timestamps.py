"""add roster notification timestamps

Revision ID: 0009
Revises: 0008
Create Date: 2026-08-26
"""

import sqlalchemy as sa
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "job_roster_entries",
        sa.Column("notified_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "job_roster_entries",
        sa.Column("reminder_sent_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("job_roster_entries", "reminder_sent_at")
    op.drop_column("job_roster_entries", "notified_at")
