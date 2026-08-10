"""sunday work requests carry the attendance attempt that raised them

Marking attendance on a Sunday now files the approval request itself instead of
being refused, so the request has to hold the GPS fix, photo and location until a
superadmin decides. Nothing queries inside the blob, so plain JSON is enough.

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-10
"""
import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sunday_work_requests",
        sa.Column("attendance_payload", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("sunday_work_requests", "attendance_payload")
