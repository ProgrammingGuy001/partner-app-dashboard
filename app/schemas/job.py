from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, condecimal, model_validator

from app.schemas.checklist import JobChecklistResponse


class JobBase(BaseModel):
    name: str
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[int] = None
    type: Optional[str] = None
    rate: Optional[Decimal] = Field(default=None, max_digits=10, decimal_places=2)
    size: Optional[int] = None
    assigned_ip_id: Optional[int] = None
    customer_id: Optional[int] = None
    job_rate_id: Optional[int] = None
    start_date: Optional[date] = None
    delivery_date: date
    checklist_link: Optional[str] = None
    google_map_link: Optional[str] = None
    incentive: Optional[Decimal] = Field(
        default=Decimal("0.00"), max_digits=10, decimal_places=2
    )


class JobCreate(JobBase):
    checklist_ids: Optional[list[int]] = None
    user_id: Optional[int] = None

    @model_validator(mode="after")
    def validate_customer_source(self) -> "JobCreate":
        if self.customer_id is None:
            missing_customer_fields = [
                field_name
                for field_name in ("customer_name", "address_line_1", "city", "state", "pincode")
                if not getattr(self, field_name)
            ]
            if missing_customer_fields:
                raise ValueError(
                    "Missing customer fields when customer_id is not provided: "
                    + ", ".join(missing_customer_fields)
                )
        return self


class JobUpdate(BaseModel):
    name: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
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
    incentive: Optional[condecimal(max_digits=10, decimal_places=2)] = None


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
    is_internal: bool = False

    model_config = ConfigDict(from_attributes=True)


class CustomerOptionResponse(BaseModel):
    id: int
    name: str
    phone_number: Optional[str] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[int] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class JobRateResponse(BaseModel):
    id: int
    job_type_name: str
    base_rate: Decimal

    model_config = ConfigDict(from_attributes=True)


class JobResponse(BaseModel):
    id: int
    name: Optional[str] = None
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
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
    incentive: Optional[Decimal] = Field(default=Decimal("0.00"))
    start_otp_verified: bool = False
    end_otp_verified: bool = False
    job_checklists: List[JobChecklistResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
