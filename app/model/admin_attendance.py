from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class AdminAttendance(Base):
    __tablename__ = "admin_attendance"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    admin_id: Mapped[int] = mapped_column(ForeignKey("admin.id"), nullable=False, index=True)
    marked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=func.now(), nullable=False
    )
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    manual_location: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # Supervisors check in without naming a site, so the fix is matched against the
    # nearest job pin. matched_job_id records which site that was, even when the fix
    # fell outside its fence. All three are NULL when no job has a pin.
    matched_job_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("jobs.id"), nullable=True, index=True
    )
    distance_meters: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    within_geofence: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    photo_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String, nullable=True)
