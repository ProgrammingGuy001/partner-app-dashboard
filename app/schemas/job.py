from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field, condecimal

from app.schemas.checklist import JobChecklistResponse


class JobBase(BaseModel):
    name: str
    customer_name: str
    customer_phone: Optional[str] = None
    address: str
    city: str
    pincode: int
    type: str
    rate: Decimal = Field(..., max_digits=10, decimal_places=2)
    size: Optional[int] = None
    assigned_ip_id: Optional[int] = None
    customer_id: Optional[int] = None
    job_rate_id: Optional[int] = None
    start_date: Optional[date] = None
    delivery_date: date
    checklist_link: Optional[str] = None
    google_map_link: Optional[str] = None
    additional_expense: Optional[Decimal] = Field(
        default=Decimal("0.00"), max_digits=10, decimal_places=2
    )


class JobCreate(JobBase):
    checklist_ids: Optional[list[int]] = None
    user_id: Optional[int] = None


class JobUpdate(BaseModel):
    name: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    pincode: Optional[int] = None
    type: Optional[str] = None
    rate: Optional[condecimal(max_digits=10, decimal_places=2)] = None
    size: Optional[int] = None
    assigned_ip_id: Optional[int] = None
    customer_id: Optional[int] = None
    job_rate_id: Optional[int] = None
    status: Optional[str] = None
    start_date: Optional[date] = None
    delivery_date: Optional[date] = None
    checklist_ids: Optional[list[int]] = None
    checklist_link: Optional[str] = None
    google_map_link: Optional[str] = None
    additional_expense: Optional[condecimal(max_digits=10, decimal_places=2)] = None


class JobStart(BaseModel):
    notes: Optional[str] = None


class JobPause(BaseModel):
    notes: Optional[str] = None


class JobFinish(BaseModel):
    notes: Optional[str] = None


class JobStartWithOTP(BaseModel):
    notes: Optional[str] = None
    otp: str


class JobFinishWithOTP(BaseModel):
    notes: Optional[str] = None
    otp: str


class OTPResponse(BaseModel):
    success: bool
    message: str


class IPSummary(BaseModel):
    id: int
    first_name: str
    last_name: str
    phone_number: str
    is_assigned: bool

    class Config:
        from_attributes = True


class CustomerOptionResponse(BaseModel):
    id: int
    name: str
    phone_number: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    pincode: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class JobRateResponse(BaseModel):
    id: int
    job_type_name: str
    base_rate: Decimal

    class Config:
        from_attributes = True


class JobResponse(BaseModel):
    id: int
    name: Optional[str] = None
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    pincode: Optional[int] = None
    job_rate_id: Optional[int] = None
    type: Optional[str] = None
    rate: Optional[Decimal] = None
    size: Optional[int] = None
    assigned_ip_id: Optional[int] = None
    user_id: Optional[int] = None
    assigned_ip: Optional[IPSummary] = None
    start_date: Optional[date] = None
    delivery_date: Optional[date] = None
    checklist_link: Optional[str] = None
    google_map_link: Optional[str] = None
    status: str = "created"
    additional_expense: Optional[Decimal] = Field(default=Decimal("0.00"))
    start_otp_verified: bool = False
    end_otp_verified: bool = False
    job_checklists: List[JobChecklistResponse] = []

    class Config:
        from_attributes = True
