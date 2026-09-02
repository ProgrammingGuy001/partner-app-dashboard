from datetime import date, datetime, time
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base

if TYPE_CHECKING:
    from app.model.attendance import DailyAttendance


class RosterSlotSetting(Base):
    __tablename__ = "roster_slot_settings"
    __table_args__ = (
        CheckConstraint("slot_number IN (1, 2)", name="ck_roster_slot_number"),
        CheckConstraint("end_time > start_time", name="ck_roster_slot_time_order"),
    )

    slot_number: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=False
    )
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    updated_by_admin_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("admin.id"), nullable=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class JobRosterEntry(Base):
    __tablename__ = "job_roster_entries"
    __table_args__ = (
        UniqueConstraint(
            "ip_user_id", "work_date", "slot_number", name="uq_roster_ip_date_slot"
        ),
        UniqueConstraint(
            "job_id", "work_date", "slot_number", name="uq_roster_job_date_slot"
        ),
        # No job+IP+date uniqueness on purpose: a job that needs the full eight hours
        # takes both slots of the day for the same IP. That is one visit, not two -
        # attendance is marked once, in the first half. See app/utils/roster_day.py.
        CheckConstraint("slot_number IN (1, 2)", name="ck_job_roster_slot_number"),
        CheckConstraint("slot_end > slot_start", name="ck_job_roster_time_order"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(
        ForeignKey("jobs.id"), nullable=False, index=True
    )
    ip_user_id: Mapped[int] = mapped_column(
        ForeignKey("ip_user.id"), nullable=False, index=True
    )
    work_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    slot_number: Mapped[int] = mapped_column(
        ForeignKey("roster_slot_settings.slot_number"), nullable=False
    )
    # Snapshot the configured hours so changing tomorrow's defaults cannot rewrite
    # historical attendance expectations.
    slot_start: Mapped[time] = mapped_column(Time, nullable=False)
    slot_end: Mapped[time] = mapped_column(Time, nullable=False)
    created_by_admin_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("admin.id"), nullable=False
    )
    # True when this row mirrors the job's default IP/date/slot. A dated swap turns it
    # false so later edits to the job do not overwrite that explicit override.
    is_job_default: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    # WhatsApp notices, claimed before the external call so a timeout cannot send twice:
    # notified_at for the assignment attempt, reminder_sent_at for the hour-before attempt.
    notified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    reminder_sent_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Last known outcome for each notice: queued/not_queued locally, then Interakt's
    # sent/delivered/read/failed callback when one arrives.
    notified_status: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    reminder_status: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)

    job = relationship("Job")
    ip_user = relationship("ip")
    slot = relationship("RosterSlotSetting")
    attendance_records: Mapped[List["DailyAttendance"]] = relationship(
        "DailyAttendance", back_populates="roster_entry"
    )
