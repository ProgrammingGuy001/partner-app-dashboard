"""baseline: production schema as of 2026-08-07

This is a capture of the live production schema, not a generation from the models.
The two had drifted (ON DELETE clauses, JSONB vs JSON, BIGINT vs INTEGER, server
defaults) after years of the hand-rolled app/utils/db_migrations.py, so generating
the baseline from models would have silently rewritten production.

Existing databases are stamped at this revision and never execute it — see
_adopt_legacy_database() in app/utils/migrate.py, which startup runs before every
upgrade. Only a fresh database runs the SQL, which reproduces production exactly.

Revision ID: 0001
Revises:
Create Date: 2026-08-07
"""
from pathlib import Path

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

SQL_FILE = Path(__file__).with_suffix(".sql")


def upgrade() -> None:
    op.execute(SQL_FILE.read_text())


def downgrade() -> None:
    # ponytail: a baseline has nowhere to go back to. Dropping the schema is the
    # only honest inverse and it is never what anyone wants run by accident.
    raise NotImplementedError("The baseline revision cannot be downgraded.")
