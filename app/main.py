from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app.api.v1 import attendance, auth, bom, jobs, verification
from app.config import settings
from app.core.scheduler import shutdown_scheduler, start_scheduler
from app.database import Base, engine, SessionLocal
from app.routes.analytics import router as analytics_router
from app.routes.approval import router as approval_router
from app.routes.auth import router as auth_router
from app.routes.bom import router as bom_router
from app.routes.checklist import router as checklist_router
from app.routes.job import router as job_router
from app.utils.db_migrations import run_migrations
from app.utils.rate_limiter import limiter, rate_limit_exceeded_handler

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown events"""
    if settings.enable_schema_sync:
        Base.metadata.create_all(bind=engine)
    else:
        logger.info("Skipping automatic schema creation; use Alembic migrations instead.")

    # Always run column-level migrations (idempotent)
    try:
        with SessionLocal() as db:
            run_migrations(db)
    except Exception as exc:
        logger.error("Startup migrations failed: %s", exc)

    start_scheduler()
    yield
    # Shutdown
    shutdown_scheduler()


app = FastAPI(
    title="Partner App API",
    description="User Registration and Verification System",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)


app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=settings.trusted_hosts_list)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With", "X-CSRF-Token"],
    max_age=600,
)

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
app.include_router(analytics_router)
app.include_router(checklist_router)


@app.get("/health")
def health():
    return {"status": "ok"}
