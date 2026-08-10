"""Run Alembic migrations from inside the app process.

Startup calls upgrade_to_head() so a deploy can never serve traffic against a
schema older than the code. The Procfile runs a single uvicorn process, so there
is no concurrent-upgrade race to guard against; if workers are ever added, move
this to a release step instead.
"""
import logging
from pathlib import Path

from alembic import command
from alembic.config import Config

logger = logging.getLogger(__name__)

# app/alembic.ini — resolved from this file so it works regardless of the CWD the
# process was started from (repo root locally, /code in the container).
ALEMBIC_INI = Path(__file__).resolve().parent.parent / "alembic.ini"


def _config() -> Config:
    if not ALEMBIC_INI.exists():
        raise FileNotFoundError(f"Alembic config missing at {ALEMBIC_INI}")
    return Config(str(ALEMBIC_INI))


BASELINE_REVISION = "0001"

# A table every pre-Alembic database has. Its presence alongside a missing
# alembic_version is what distinguishes "existing schema" from "empty database".
SENTINEL_TABLE = "jobs"


def _adopt_legacy_database() -> None:
    """Record a pre-Alembic database at the baseline rather than rebuilding it.

    0001_baseline.sql is a pg_dump with no IF NOT EXISTS, so running it against a
    populated database fails on the first CREATE TYPE and takes startup down.
    """
    from sqlalchemy import inspect

    from app.database import engine

    with engine.connect() as connection:
        inspector = inspect(connection)
        if inspector.has_table("alembic_version"):
            return
        if not inspector.has_table(SENTINEL_TABLE):
            return  # genuinely empty: let the baseline build it

    logger.warning(
        "Pre-Alembic database detected (no alembic_version, %s present); stamping %s",
        SENTINEL_TABLE,
        BASELINE_REVISION,
    )
    # Not "head": any later revision must still run against the adopted database,
    # which the upgrade in upgrade_to_head() does on this same boot.
    stamp(BASELINE_REVISION)


def upgrade_to_head() -> None:
    """Apply every pending revision. No-op when already current."""
    _adopt_legacy_database()
    logger.info("Alembic: upgrading to head")
    command.upgrade(_config(), "head")
    logger.info("Alembic: schema is at head")


def stamp(revision: str) -> None:
    """Record a revision as applied without running it — for adopting an existing DB."""
    logger.info("Alembic: stamping %s", revision)
    command.stamp(_config(), revision)
