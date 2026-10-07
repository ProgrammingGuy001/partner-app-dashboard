"""Jobs no longer carry a delivery date: wipe existing ones (backed up first)."""

from alembic import op

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "CREATE TABLE IF NOT EXISTS jobs_delivery_date_backup AS "
        "SELECT id, delivery_date FROM jobs WHERE delivery_date IS NOT NULL"
    )
    op.execute("UPDATE jobs SET delivery_date = NULL WHERE delivery_date IS NOT NULL")


def downgrade():
    op.execute(
        "UPDATE jobs SET delivery_date = b.delivery_date "
        "FROM jobs_delivery_date_backup b WHERE jobs.id = b.id"
    )
    op.execute("DROP TABLE jobs_delivery_date_backup")
