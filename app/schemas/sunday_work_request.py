from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class SundayWorkRequestCreate(BaseModel):
    request_date: date
    reason: Optional[str] = Field(default=None, max_length=500)


class SundayWorkRequestReview(BaseModel):
    review_notes: Optional[str] = Field(default=None, max_length=500)


class SundayWorkRequestIP(BaseModel):
    id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone_number: str

    class Config:
        from_attributes = True


class SundayWorkRequestAdmin(BaseModel):
    id: int
    name: Optional[str] = None
    email: str

    class Config:
        from_attributes = True


class SundayWorkRequestResponse(BaseModel):
    id: int
    ip_user_id: Optional[int] = None
    admin_id: Optional[int] = None
    requester_type: str
    request_date: date
    status: str
    reason: Optional[str] = None
    reviewed_by_admin_id: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None
    created_at: datetime
    ip_user: Optional[SundayWorkRequestIP] = None
    admin: Optional[SundayWorkRequestAdmin] = None

    class Config:
        from_attributes = True
