from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from .api.v1 import auth, jobs, verification
from .database import Base, engine
from .routes.analytics import router as analytics_router
from .routes.approval import router as approval_router
from .routes.auth import router as auth_router

# 1. Import the new router
from .routes.checklist import router as checklist_router
from .routes.job import router as job_router


app = FastAPI(
    title="Partner App API",
    description="User Registration and Verification System",
    version="1.0.0",
)


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://partner-app-dashboard-navy.vercel.app",
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

# ... existing routers ...
app.include_router(auth.router, prefix="/api/v1")
app.include_router(verification.router, prefix="/api/v1")
app.include_router(jobs.router, prefix="/api/v1")

app.include_router(auth_router)
app.include_router(approval_router)
app.include_router(job_router)
app.include_router(analytics_router)

# 2. Add the checklist router
app.include_router(checklist_router)


@app.get("/health")
def health():
    return {"status": "ok"}
