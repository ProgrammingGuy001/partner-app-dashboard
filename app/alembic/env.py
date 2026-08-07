from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

import app.model  # noqa: F401  importing the package registers all 26 models on Base
from app.config import settings
from app.database import Base

config = context.config
if config.config_file_name is not None:
    # disable_existing_loggers defaults to True, which silences every logger already
    # configured — including uvicorn's, since startup runs this in-process. Without
    # this flag the app stops logging the moment migrations finish.
    fileConfig(config.config_file_name, disable_existing_loggers=False)

# Credentials live in app.config, never in alembic.ini. set_main_option escapes %
# so passwords containing % survive ConfigParser interpolation.
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL.replace("%", "%%"))

target_metadata = Base.metadata

# Tables that predate this app or were abandoned without dropping. They have no
# model, so autogenerate would otherwise emit a DROP TABLE for each one.
UNMANAGED_TABLES = {
    "admin_notification",
    "daily_job_updates",
    "daily_job_update_photos",
    "ticket_assignments",
    "jobs_dropped_columns_backup",
}


def include_object(obj, name, type_, reflected, compare_to):
    if type_ == "table" and name in UNMANAGED_TABLES:
        return False
    return True


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object,
            compare_type=True,
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
