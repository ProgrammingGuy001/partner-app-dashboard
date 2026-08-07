from datetime import date, datetime, time
from decimal import Decimal
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, condecimal, model_validator

from app.schemas.checklist import JobChecklistResponse


class JobBase(BaseModel):
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
    # The supervisor who owns the site. Some jobs are done by a supervisor with no IP,
    # so this is set independently of assigned_ip_id; it defaults to the creator.
    admin_assigned: Optional[int] = None
    customer_id: Optional[int] = None
    job_rate_id: Optional[int] = None
    start_date: Optional[date] = None
    delivery_date: date
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    geofence_radius: Optional[int] = Field(default=None, ge=10, le=5000)
    incentive: Optional[Decimal] = Field(
        default=Decimal("0.00"), max_digits=10, decimal_places=2
    )
    sales_order: Optional[str] = None
    drawing_document_link: Optional[str] = None
    slot_start: Optional[time] = None
    slot_end: Optional[time] = None


DRAWING_REQUIRED_JOB_TYPES = {"site_validation", "installation"}
SLOT_EXCLUDED_JOB_TYPES = {"installation"}


def validate_job_slot(job_type: Optional[str], slot_start, slot_end) -> None:
    """A slot is both-or-neither, forward-going, and off-limits to installation jobs."""
    if slot_start is None and slot_end is None:
        return
    if slot_start is None or slot_end is None:
        raise ValueError("Set both a slot start and a slot end, or neither")
    if slot_end <= slot_start:
        raise ValueError("Slot end must be after slot start")
    if (job_type or "").strip().lower() in SLOT_EXCLUDED_JOB_TYPES:
        raise ValueError("Installation jobs cannot use an attendance slot")


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

    @model_validator(mode="after")
    def validate_drawing_required(self) -> "JobCreate":
        if self.type in DRAWING_REQUIRED_JOB_TYPES and not self.drawing_document_link:
            raise ValueError(
                f"A drawing document is required upfront for '{self.type}' jobs"
            )
        return self

    @model_validator(mode="after")
    def validate_slot(self) -> "JobCreate":
        validate_job_slot(self.type, self.slot_start, self.slot_end)
        return self


class JobUpdate(BaseModel):
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
    admin_assigned: Optional[int] = None
    customer_id: Optional[int] = None
    job_rate_id: Optional[int] = None
    status: Optional[str] = None
    start_date: Optional[date] = None
    delivery_date: Optional[date] = None
    checklist_ids: Optional[list[int]] = None
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    geofence_radius: Optional[int] = Field(default=None, ge=10, le=5000)
    incentive: Optional[condecimal(max_digits=10, decimal_places=2)] = None
    sales_order: Optional[str] = None
    drawing_document_link: Optional[str] = None
    slot_start: Optional[time] = None
    slot_end: Optional[time] = None


class MapUrlResolveRequest(BaseModel):
    url: str = Field(min_length=1, max_length=2048)


class MapUrlResolveResponse(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    # Set when the link named a place but carried no pin, so the dashboard can fall
    # back to its address search.
    place_name: Optional[str] = None


class JobStart(BaseModel):
    notes: Optional[str] = None


class JobPause(BaseModel):
    notes: Optional[str] = None


class JobFinish(BaseModel):
    notes: Optional[str] = None
    handover_document_link: str = Field(min_length=1)
    ncr_document_link: str = Field(min_length=1)
    project_report_document_link: str = Field(min_length=1)


class JobStartWithOTP(BaseModel):
    notes: Optional[str] = None
    otp: str


class JobFinishWithOTP(BaseModel):
    notes: Optional[str] = None
    otp: str
    handover_document_link: str = Field(min_length=1)
    ncr_document_link: str = Field(min_length=1)
    project_report_document_link: str = Field(min_length=1)


class OTPResponse(BaseModel):
    success: bool
    message: str


class JobApprovalRequestCreate(BaseModel):
    """Ask a superadmin to start/finish a job when the customer OTP can't be used."""

    action: Literal["start", "finish"]
    reason: str = Field(min_length=1, max_length=1000)
    handover_document_link: Optional[str] = None
    ncr_document_link: Optional[str] = None
    project_report_document_link: Optional[str] = None

    @model_validator(mode="after")
    def validate_completion_documents(self) -> "JobApprovalRequestCreate":
        if self.action == "finish" and not all(
            (self.handover_document_link, self.ncr_document_link, self.project_report_document_link)
        ):
            raise ValueError("Handover, NCR, and Project Report documents are required to request completion")
        return self


class JobApprovalRequestResponse(BaseModel):
    id: int
    job_id: int
    action: str
    status: str
    reason: str
    requested_by_id: Optional[int] = None
    requested_at: Optional[datetime] = None
    reviewed_by_id: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None
    job_name: Optional[str] = None
    requested_by_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


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


class JobRateBase(BaseModel):
    job_type_name: str
    base_rate: condecimal(max_digits=10, decimal_places=2)
    location: str = ""
    description: Optional[str] = None


class JobRateCreate(JobRateBase):
    pass


class JobRateResponse(JobRateBase):
    id: int

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
    # Derived server-side from the customer / the dropped pin; read-only.
    google_map_link: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    geofence_radius: Optional[int] = None
    status: str = "created"
    incentive: Optional[Decimal] = Field(default=Decimal("0.00"))
    start_otp_verified: bool = False
    end_otp_verified: bool = False
    handover_document_link: Optional[str] = None
    ncr_document_link: Optional[str] = None
    project_report_document_link: Optional[str] = None
    drawing_document_link: Optional[str] = None
    sales_order: Optional[str] = None
    slot_start: Optional[time] = None
    slot_end: Optional[time] = None
    assigned_admin_name: Optional[str] = None
    job_checklists: List[JobChecklistResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class NcrDocumentRow(BaseModel):
    sales_order: str = Field(default="", max_length=100)
    part_no: str = Field(default="", max_length=100)
    part_description: str = Field(default="", max_length=500)
    qty: str = Field(default="", max_length=50)
    issue_description: str = Field(default="", max_length=1000)
    disposition: str = Field(default="", max_length=1000)

    model_config = ConfigDict(extra="forbid")


class ProjectDocumentRequest(BaseModel):
    data_source: Literal["manual", "app"] = "manual"
    project_name: str = Field(default="", max_length=255)
    sales_order: str = Field(default="", max_length=100)
    project_rating: str = Field(default="", max_length=100)
    accomplishment: str = Field(default="", max_length=5000)
    total_expense: str = Field(default="", max_length=100)
    scope_summary: str = Field(default="", max_length=3000)
    design_perspective: str = Field(default="", max_length=3000)
    product: str = Field(default="", max_length=3000)
    quality: str = Field(default="", max_length=3000)
    operation: str = Field(default="", max_length=3000)
    fulfillment: str = Field(default="", max_length=3000)
    learning: str = Field(default="", max_length=3000)
    ncr_document_number: str = Field(default="AYENA-QUA-QF-001", max_length=100)
    ncr_revision: str = Field(default="02-06-2026/Rev-00", max_length=100)
    city_operation_in_charge: str = Field(default="", max_length=255)
    project_marshal: str = Field(default="", max_length=255)
    customer_quality_lead: str = Field(default="", max_length=255)
    no_ncr_reported: bool = False
    ncr_rows: list[NcrDocumentRow] = Field(default_factory=list, max_length=21)

    model_config = ConfigDict(extra="forbid")


class MonthlyProjectRow(BaseModel):
    job_id: int | None = None
    project_id: str = Field(default="", max_length=100)
    project_name: str = Field(default="", max_length=255)
    handover_date: str = Field(default="", max_length=50)
    days_taken: str = Field(default="", max_length=50)
    learning: str = Field(default="", max_length=3000)

    model_config = ConfigDict(extra="forbid")


class MonthlyDocumentRequest(BaseModel):
    data_source: Literal["manual", "app"] = "manual"
    month_year: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    experience_centre: str = Field(default="", max_length=255)
    ops_manager: str = Field(default="", max_length=255)
    team_needed: str = Field(default="", max_length=100)
    trained_team: str = Field(default="", max_length=100)
    training_needed: str = Field(default="", max_length=3000)
    projects: list[MonthlyProjectRow] = Field(default_factory=list, min_length=1, max_length=8)

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def validate_data_source(self) -> "MonthlyDocumentRequest":
        if self.data_source == "app" and any(row.job_id is None for row in self.projects):
            raise ValueError("Select an app project for every row")
        if self.data_source == "manual" and any(row.job_id is not None for row in self.projects):
            raise ValueError("Manual project rows cannot reference app jobs")
        return self
