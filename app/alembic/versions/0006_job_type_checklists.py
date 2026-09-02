"""map checklists once per job type

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-19
"""
import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "job_type_checklists",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("job_type", sa.String(length=100), nullable=False),
        sa.Column("checklist_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["checklist_id"], ["checklists.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("job_type", "checklist_id", name="uq_job_type_checklist"),
    )
    op.create_index("ix_job_type_checklists_job_type", "job_type_checklists", ["job_type"])
    op.create_index("ix_job_type_checklists_checklist_id", "job_type_checklists", ["checklist_id"])


def downgrade() -> None:
    op.drop_table("job_type_checklists")
