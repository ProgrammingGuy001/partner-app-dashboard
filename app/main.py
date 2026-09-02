from contextlib import asynccontextmanager
import logging
from time import perf_counter
from urllib.parse import urlsplit

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app.api.v1 import attendance, auth, bom, jobs, verification
from app.config import settings
from app.core.scheduler import scheduler
from app.services.visit_listener import start_visit_listener, stop_visit_listener
from app.database import SessionLocal
from app.routes.analytics import router as analytics_router
from app.routes.approval import router as approval_router
from app.routes.auth import router as auth_router
from app.routes.bom import router as bom_router
from app.routes.checklist import router as checklist_router
from app.routes.crm_webhook import router as crm_webhook_router
from app.routes.interakt_webhook import router as interakt_webhook_router
from app.routes.dev import router as dev_router
from app.routes.grn import admin_router as grn_admin_router, ip_router as grn_ip_router
from app.routes.job import router as job_router
from app.routes.job_rate import router as job_rate_router
from app.routes.purchase_order import router as purchase_order_router
from app.routes.roster import admin_router as roster_admin_router, ip_router as roster_ip_router
from app.routes.sunday_work_request import (
    admin_router as sunday_work_request_admin_router,
    ip_router as sunday_work_request_ip_router,
)
from app.services.checklist_template_service import sync_checklist_templates
# ponytail: reaching for a private name rather than editing db_migrations.py, which
# has uncommitted edits in another branch. Rename to seed_dev_account and move it
# beside sync_checklist_templates when that lands.
from app.utils.db_migrations import _seed_dev_account as seed_dev_account
from app.utils.error_text import sanitize_validation_errors
from app.utils.migrate import upgrade_to_head
from app.utils.rate_limiter import limiter, rate_limit_exceeded_handler

logger = logging.getLogger(__name__)

# Override built-in print so that it only prints in non-prod modes.
import builtins
_original_print = builtins.print
def _env_aware_print(*args, **kwargs):
    if settings.normalized_environment not in {"prod", "production"}:
        _original_print(*args, **kwargs)
builtins.print = _env_aware_print


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown events"""
    # Schema comes from Alembic only. create_all is gone: it could add missing
    # tables but never reconcile a column, which is how prod ended up without
    # jobs_checklist_item_status while the code assumed it existed.
    try:
        upgrade_to_head()
    except Exception as exc:
        logger.exception("Startup migrations failed: %s", exc)
        raise

    # Reference data, not schema — idempotent and safe to re-run every boot.
    try:
        with SessionLocal() as db:
            sync_checklist_templates(db)
            seed_dev_account(db)
    except Exception as exc:
        logger.exception("Startup seeding failed: %s", exc)
        raise

    scheduler.start()
    start_visit_listener()
    yield
    # Shutdown
    stop_visit_listener()
    scheduler.shutdown()


_docs_enabled = settings.expose_api_docs

app = FastAPI(
    title="Partner App API",
    description="User Registration and Verification System",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if _docs_enabled else None,
    redoc_url="/redoc" if _docs_enabled else None,
    openapi_url="/openapi.json" if _docs_enabled else None,
)

# Configure rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)


app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=settings.trusted_hosts_list)

app.add_middleware(
    GZipMiddleware,
    minimum_size=settings.GZIP_MIN_SIZE,
    compresslevel=settings.GZIP_COMPRESS_LEVEL,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With", "X-CSRF-Token"],
    max_age=600,
)


def _request_origin(request: Request) -> str | None:
    origin = request.headers.get("origin")
    if origin:
        return origin.rstrip("/")
    referer = request.headers.get("referer")
    if referer:
        parsed = urlsplit(referer)
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}"
    return None


@app.middleware("http")
async def protect_cookie_authenticated_mutations(request: Request, call_next):
    """Reject cross-site state changes when authentication comes from cookies."""
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        has_authorization_header = bool(request.headers.get("authorization"))
        auth_cookie_names = {
            settings.ADMIN_AUTH_COOKIE_NAME,
            settings.IP_AUTH_COOKIE_NAME,
            settings.ADMIN_REFRESH_COOKIE_NAME,
            settings.IP_REFRESH_COOKIE_NAME,
            "access_token",
        }
        uses_auth_cookie = any(name in request.cookies for name in auth_cookie_names)
        if uses_auth_cookie and not has_authorization_header:
            allowed_origins = {origin.rstrip("/") for origin in settings.cors_origins_list}
            if _request_origin(request) not in allowed_origins:
                return JSONResponse(status_code=403, content={"detail": "Cross-site request blocked"})
    return await call_next(request)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    logger.info(
        "Request validation failed: method=%s path=%s client=%s errors=%s",
        request.method,
        request.url.path,
        request.client.host if request.client else None,
        sanitize_validation_errors(errors),
    )
    return JSONResponse(
        status_code=422,
        content={
            "message": "Invalid request parameters",
            "detail": sanitize_validation_errors(errors),
        },
    )


@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start = perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        duration_ms = (perf_counter() - start) * 1000
        logger.exception(
            "HTTP %s %s failed after %.2fms",
            request.method,
            request.url.path,
            duration_ms,
        )
        raise

    duration_ms = (perf_counter() - start) * 1000
    response.headers["X-Process-Time-Ms"] = f"{duration_ms:.2f}"
    if settings.API_REQUEST_LOGGING_ENABLED or duration_ms >= settings.SLOW_REQUEST_LOG_MS:
        logger.info(
            "HTTP %s %s -> %s in %.2fms",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
    return response


# API v1 routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(verification.router, prefix="/api/v1")
app.include_router(jobs.router, prefix="/api/v1")
app.include_router(attendance.router, prefix="/api/v1")
app.include_router(bom.router, prefix="/api/v1")

# Backward-compatible alias for older clients that still call /api/v1/auth/verification/*
app.include_router(verification.router, prefix="/api/v1/auth")

# Additional routers
app.include_router(auth_router)
app.include_router(approval_router)
app.include_router(bom_router)
app.include_router(job_router)
app.include_router(job_rate_router)
app.include_router(analytics_router)
app.include_router(checklist_router)
app.include_router(dev_router)
app.include_router(grn_admin_router)
app.include_router(grn_ip_router)
app.include_router(purchase_order_router)
app.include_router(roster_admin_router)
app.include_router(roster_ip_router)
app.include_router(sunday_work_request_admin_router)
app.include_router(sunday_work_request_ip_router)
app.include_router(crm_webhook_router)  # /webhooks/crm
app.include_router(interakt_webhook_router)  # /webhooks/interakt


@app.get("/health")
def health():
    return {"status": "ok"}
