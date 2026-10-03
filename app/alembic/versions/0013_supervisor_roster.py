"""Supervisor visits and nullable historical actors for account removal."""

from alembic import op
import sqlalchemy as sa

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "supervisor_roster_entries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "supervisor_id", sa.Integer(), sa.ForeignKey("admin.id"), nullable=False
        ),
        sa.Column("job_id", sa.Integer(), sa.ForeignKey("jobs.id"), nullable=False),
        sa.Column("work_date", sa.Date(), nullable=False),
        sa.Column(
            "slot_number",
            sa.Integer(),
            sa.ForeignKey("roster_slot_settings.slot_number"),
            nullable=False,
        ),
        sa.Column("created_by_admin_id", sa.Integer(), sa.ForeignKey("admin.id")),
        sa.UniqueConstraint(
            "supervisor_id", "work_date", "slot_number", name="uq_supervisor_date_slot"
        ),
    )
    for table, column in [
        ("job_roster_entries", "created_by_admin_id"),
        ("site_grn", "created_by_admin_id"),
        ("purchase_order_requests", "requested_by_id"),
        ("dev_audit_log", "actor_id"),
    ]:
        op.alter_column(table, column, nullable=True)


def downgrade():
    op.drop_table("supervisor_roster_entries")
    # Historical authors removed by Dev cannot safely become NOT NULL again.
