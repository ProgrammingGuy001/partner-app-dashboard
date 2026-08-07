from datetime import date, datetime
from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, Float, ForeignKey, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from typing import Optional

from app.database import Base


class DailyAttendance(Base):
    __tablename__ = "daily_attendance"
    __table_args__ = (
        UniqueConstraint(
            "ip_user_id",
            "job_id",
            "attendance_date",
            "attendance_type",
            name="uq_daily_attendance_user_job_date_type",
        ),
        CheckConstraint("attendance_type IN ('check_in', 'check_out')", name="ck_daily_attendance_type"),
        CheckConstraint(
            "checkout_source IS NULL OR checkout_source IN ('manual', 'auto')",
            name="ck_daily_attendance_checkout_source",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    job_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("jobs.id"),
        nullable=True,
        index=True,
    )
    ip_user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("ip_user.id"), nullable=True, index=True
    )
    phone: Mapped[str] = mapped_column(String, nullable=False)
    attendance_date: Mapped[date] = mapped_column(Date, nullable=False, server_default=func.current_date())
    attendance_type: Mapped[str] = mapped_column(String(16), nullable=False, default="check_in")
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    manual_location: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # How far the fix landed from the job's map pin, and whether that was inside its
    # geofence. NULL means "not evaluable" (job has no pin), which is not the same as
    # False ("outside"). Recorded only — attendance is never rejected on this.
    distance_meters: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    within_geofence: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    photo_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    report_document_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    report_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True) # !is this needed? we don't use it anywhere, and the report document is already stored in S3
    # 'auto' marks a check-out the midnight sweep created because the IP never closed their day.
    checkout_source: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=func.now()
    )
