"""add roster notification delivery status and the NOTIFY trigger

Revision ID: 0010
Revises: 0009
Create Date: 2026-08-27
"""

import sqlalchemy as sa
from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None

# Fires on the write that creates a visit or moves it to another IP - the two cases a
# customer has to be told about. Deliberately not on attempt/status fields: internal
# notification bookkeeping must never schedule another send.
TRIGGER_FUNCTION = """
CREATE OR REPLACE FUNCTION notify_roster_visit() RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify('roster_visit', NEW.id::text);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
"""

CREATE_TRIGGER = """
DROP TRIGGER IF EXISTS job_roster_entries_notify ON job_roster_entries;
CREATE TRIGGER job_roster_entries_notify
AFTER INSERT OR UPDATE OF ip_user_id ON job_roster_entries
FOR EACH ROW EXECUTE FUNCTION notify_roster_visit();
"""


def upgrade() -> None:
    op.add_column(
        "job_roster_entries", sa.Column("notified_status", sa.String(40), nullable=True)
    )
    op.add_column(
        "job_roster_entries", sa.Column("reminder_status", sa.String(40), nullable=True)
    )
    op.execute(TRIGGER_FUNCTION)
    op.execute(CREATE_TRIGGER)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS job_roster_entries_notify ON job_roster_entries")
    op.execute("DROP FUNCTION IF EXISTS notify_roster_visit()")
    op.drop_column("job_roster_entries", "reminder_status")
    op.drop_column("job_roster_entries", "notified_status")
