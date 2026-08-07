"""Operator-safe summaries for exception text that gets persisted and served back.

Anything written to a ``*_sync_error`` column is later returned by a response model
and rendered in the dashboard, so it is effectively public. SQLAlchemy in particular
stringifies the failing statement *and its bound parameters* into the message, which
means an unfiltered ``str(exc)`` can put customer phone numbers, PAN and account
numbers into a column that any authenticated user can read back.
"""

import re

_LEAK_SIGNATURES = re.compile(
    r"\[SQL:|\[parameters:|Traceback|psycopg|sqlalchemy|asyncpg|File \"",
    re.IGNORECASE,
)

MAX_LENGTH = 200

DEFAULT_FALLBACK = "Sync failed. See the server logs for details."


def sync_error_summary(exc: BaseException, fallback: str = DEFAULT_FALLBACK) -> str:
    """Short, safe text for a persisted error column. Log the full exception separately."""
    raw = str(getattr(exc, "detail", exc) or "").strip()
    if not raw or _LEAK_SIGNATURES.search(raw):
        return fallback
    return " ".join(raw.split())[:MAX_LENGTH]


def sanitize_validation_errors(errors: list[dict]) -> list[dict]:
    """Strip the caller's raw submitted values out of a Pydantic error list."""
    sanitized: list[dict] = []
    for error in errors:
        cleaned = {key: value for key, value in error.items() if key != "input"}
        if "ctx" in cleaned:
            cleaned["ctx"] = {key: str(value) for key, value in cleaned["ctx"].items()}
        sanitized.append(cleaned)
    return sanitized
