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


def upgrade_to_head() -> None:
    """Apply every pending revision. No-op when already current."""
    logger.info("Alembic: upgrading to head")
    command.upgrade(_config(), "head")
    logger.info("Alembic: schema is at head")


def stamp(revision: str) -> None:
    """Record a revision as applied without running it — for adopting an existing DB."""
    logger.info("Alembic: stamping %s", revision)
    command.stamp(_config(), revision)
