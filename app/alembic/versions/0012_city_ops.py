"""City Ops role and explicit supervisor grants."""

from alembic import op
import sqlalchemy as sa

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "admin",
        sa.Column(
            "is_city_ops", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
    )
    op.create_table(
        "city_ops_supervisors",
        sa.Column(
            "city_ops_id",
            sa.Integer(),
            sa.ForeignKey("admin.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "supervisor_id",
            sa.Integer(),
            sa.ForeignKey("admin.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )


def downgrade():
    op.drop_table("city_ops_supervisors")
    op.drop_column("admin", "is_city_ops")
