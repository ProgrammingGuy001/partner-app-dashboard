"""one site report per job for measurement, readiness and validation jobs

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-18
"""
import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("site_report_document_link", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("jobs", "site_report_document_link")
