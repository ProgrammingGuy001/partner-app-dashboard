from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel


class DailyJobUpdatePhotoResponse(BaseModel):
    id: int
    photo_url: str
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class DailyJobUpdateResponse(BaseModel):
    id: int
    job_id: int
    submitted_by_type: str
    submitted_by_id: int
    update_date: date
    notes: Optional[str]
    created_at: datetime
    photos: List[DailyJobUpdatePhotoResponse] = []

    model_config = {"from_attributes": True}
