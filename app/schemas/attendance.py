from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


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
    ip_user_id: Optional[int] = None
    phone: str
    attendance_date: date
    attendance_type: str
    latitude: float
    longitude: float
    manual_location: Optional[str] = None
    # None = the job had no map pin to measure against, not "outside the fence".
    distance_meters: Optional[float] = None
    within_geofence: Optional[bool] = None
    photo_url: Optional[str] = None
    report_document_url: Optional[str] = None
    report_data: Optional[dict] = None
    checkout_source: Optional[str] = None
    recorded_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DailyReportCompletedRow(BaseModel):
    action_item: str = Field(default="", max_length=500)
    date: str = Field(default="", max_length=50)
    challenges_faced: str = Field(default="", max_length=1000)

    model_config = ConfigDict(extra="forbid")


class DailyReportUpcomingRow(BaseModel):
    action_item: str = Field(default="", max_length=500)
    date: str = Field(default="", max_length=50)
    potential_issues: str = Field(default="", max_length=1000)

    model_config = ConfigDict(extra="forbid")


class DailyInstallationReportData(BaseModel):
    accomplishments: list[str] = Field(default_factory=list, max_length=3)
    completed_work: list[DailyReportCompletedRow] = Field(default_factory=list, max_length=3)
    num_ips: str = Field(default="", max_length=20)
    ip_in_time: str = Field(default="", max_length=20)
    ip_out_time: str = Field(default="", max_length=20)
    num_helpers: str = Field(default="", max_length=20)
    helper_in_time: str = Field(default="", max_length=20)
    helper_out_time: str = Field(default="", max_length=20)
    num_labour: str = Field(default="", max_length=20)
    labour_in_time: str = Field(default="", max_length=20)
    labour_out_time: str = Field(default="", max_length=20)
    mandays: str = Field(default="", max_length=20)
    upcoming_work: list[DailyReportUpcomingRow] = Field(default_factory=list, max_length=3)

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def require_accomplishment(self):
        if not any(value.strip() for value in self.accomplishments):
            raise ValueError("At least one key accomplishment is required")
        return self
