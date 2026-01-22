from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from slowapi.errors import RateLimitExceeded

from .api.v1 import auth, jobs, verification,bom
from .config import settings
from .database import Base, engine
from .routes.analytics import router as analytics_router
from .routes.approval import router as approval_router
from .routes.auth import router as auth_router
from .routes.bom import router as bom_router
from .routes.checklist import router as checklist_router
from .routes.job import router as job_router
from .utils.rate_limiter import limiter, rate_limit_exceeded_handler
from .core.scheduler import start_scheduler, shutdown_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown events"""
    Base.metadata.create_all(bind=engine)
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


# Environment-based CORS configuration
def get_allowed_origins():
    if settings.ENVIRONMENT == "production":
        return ["https://partner-app-dashboard-navy.vercel.app"]
    elif settings.ENVIRONMENT == "staging":
        return [
            "https://partner-app-dashboard-navy.vercel.app",
            "https://staging.partner-app-dashboard.vercel.app",
        ]
    else:  # development
        return [
            "https://partner-app-dashboard-navy.vercel.app",
            "http://localhost:5173",
            "http://localhost:3000",
        ]


app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=settings.trusted_hosts_list)

# API v1 routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(verification.router, prefix="/api/v1")
app.include_router(jobs.router, prefix="/api/v1")
app.include_router(bom.router, prefix="/api/v1")

# Additional routers
app.include_router(auth_router)
app.include_router(approval_router)
app.include_router(bom_router)
app.include_router(job_router)
app.include_router(analytics_router)
app.include_router(checklist_router)


@app.get("/health")
def health():
    return {"status": "ok", "environment": settings.ENVIRONMENT}
