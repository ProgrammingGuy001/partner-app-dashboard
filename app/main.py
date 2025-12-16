from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, Base
from .api.v1 import auth, verification, jobs
from .routes.auth import router as auth_router
from .routes.approval import router as approval_router
from .routes.job import router as job_router
from .routes.analytics import router as analytics_router

app = FastAPI(
    title="Partner App API",
    description="User Registration and Verification System",
    version="1.0.0"
)

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router, prefix="/api/v1")
app.include_router(verification.router, prefix="/api/v1")
app.include_router(jobs.router, prefix="/api/v1")

app.include_router(auth_router)
app.include_router(approval_router)
app.include_router(job_router)
app.include_router(analytics_router)

@app.get("/health")
def health():
    return {"status": "ok"}
