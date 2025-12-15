from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class JobStatusLogBase(BaseModel):
    job_id: int
    status: str
    notes: Optional[str] = None

class JobStatusLogCreate(BaseModel):
    notes: Optional[str] = None

class JobStatusLogResponse(JobStatusLogBase):
    id: int
    timestamp: datetime
    
    class Config:
        from_attributes = True