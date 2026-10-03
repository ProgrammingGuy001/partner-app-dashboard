"""Validated checklist PDF completion."""

from alembic import op
import sqlalchemy as sa

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "jobs_checklists",
        sa.Column(
            "completed_by_pdf", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
    )


def downgrade():
    op.drop_column("jobs_checklists", "completed_by_pdf")
