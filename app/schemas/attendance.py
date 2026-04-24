from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator


class DailyAttendanceCreate(BaseModel):
    phone: str
    latitude: float
    longitude: float
    manual_location: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def phone_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Phone cannot be empty")
        return v.strip()


class DailyAttendanceResponse(BaseModel):
    id: int
    job_id: Optional[int] = None
    phone: str
    latitude: float
    longitude: float
    manual_location: Optional[str] = None
    photo_url: Optional[str] = None
    recorded_at: datetime

    model_config = ConfigDict(from_attributes=True)
