"""track the odoo crm lead and stage a job was created from

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-14
"""
import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("crm_lead_id", sa.Integer(), nullable=True))
    op.add_column("jobs", sa.Column("crm_stage_id", sa.Integer(), nullable=True))
    op.create_index("ix_jobs_crm_lead_id", "jobs", ["crm_lead_id"])
    # Idempotency key for the webhook: one job per lead per stage. Partial, so the
    # existing hand-created jobs (all NULL) stay out of the index.
    op.create_index(
        "uq_jobs_crm_lead_stage",
        "jobs",
        ["crm_lead_id", "crm_stage_id"],
        unique=True,
        postgresql_where=sa.text("crm_lead_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_jobs_crm_lead_stage", table_name="jobs")
    op.drop_index("ix_jobs_crm_lead_id", table_name="jobs")
    op.drop_column("jobs", "crm_stage_id")
    op.drop_column("jobs", "crm_lead_id")
