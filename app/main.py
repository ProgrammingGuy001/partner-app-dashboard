from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.api.v1 import auth, verification, jobs

from app.routes.auth import router as auth_router
from app.routes.approval import router as approval_router
from app.routes.job import router as job_router
from app.routes.analytics import router as analytics_router



# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Partner App API",
    description="User Registration and Verification System",
    version="1.0.0"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Update this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(verification.router, prefix="/api/v1")
app.include_router(jobs.router, prefix="/api/v1")
app.include_router(auth_router)
app.include_router(approval_router)
app.include_router(job_router)
app.include_router(analytics_router)


@app.get("/")
def root():
    return {
        "message": "Partner App API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "message": "API is running"
    }