from datetime import date, datetime, time
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    UniqueConstraint,
    CheckConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship, synonym
from sqlalchemy.sql import func

from app.database import Base


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    phone_number: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    address_line_1: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    address_line_2: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    pincode: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    jobs: Mapped[List["Job"]] = relationship("Job", back_populates="customer")


def map_link_from_coords(latitude, longitude) -> Optional[str]:
    """Build a Google Maps URL from a dropped pin's coordinates."""
    if latitude is None or longitude is None:
        return None
    return f"https://www.google.com/maps?q={latitude},{longitude}"


class JobRate(Base):
    __tablename__ = "job_rates"
    # A rate card is unique per (type, location) because the same work costs
    # differently in different places. location is NOT NULL with a "" default:
    # Postgres treats NULLs as distinct, which would let duplicate cards through.
    __table_args__ = (
        UniqueConstraint("job_type_name", "location", name="uq_job_rate_type_location"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    job_type_name: Mapped[str] = mapped_column(String, nullable=False)
    base_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    location: Mapped[str] = mapped_column(String, nullable=False, server_default="", default="")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    jobs: Mapped[List["Job"]] = relationship("Job", back_populates="job_rate")


class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (
        CheckConstraint(
            "status IN ('created', 'pending_approval', 'creation_rejected', 'in_progress', 'paused', 'completed')",
            name="ck_job_status"
        ),
        CheckConstraint("incentive >= 0", name="ck_job_incentive_positive"),
        CheckConstraint("rate_amount >= 0", name="ck_job_rate_amount_positive"),
        CheckConstraint("area >= 0", name="ck_job_area_positive"),
        CheckConstraint("latitude BETWEEN -90 AND 90", name="ck_job_latitude_range"),
        CheckConstraint("longitude BETWEEN -180 AND 180", name="ck_job_longitude_range"),
        CheckConstraint(
            "(slot_start IS NULL) = (slot_end IS NULL) "
            "AND (slot_end IS NULL OR slot_end > slot_start)",
            name="ck_job_slot_pair",
        ),
    )

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True, autoincrement=True
    )
    customer_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("customers.id"), nullable=True, index=True
    )
    assigned_ip_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("ip_user.id"), nullable=True, index=True
    )
    status: Mapped[str] = mapped_column(String, default="created", index=True)
    delivery_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    incentive: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=True, default=0
        #! this needs to be moved to a separate table for incentives, as there can be multiple incentives for a job
    )
    job_rate_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("job_rates.id"), nullable=True, index=True
    )
    area: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    job_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    rate_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True) #! this is a duplicate of job_rate.base_rate, but we are keeping it here for backward compatibility, as there are many places in the code where we are using this field directly.
    admin_assigned: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("admin.id"), nullable=True, index=True
    )
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)#! this should be datetime
    #! where is the end date !!!!
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    geofence_radius: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, default=100)
    # Optional attendance slot. When set, check-in opens at slot_start and closes 30 min
    # later instead of the 10:30 cutoff. slot_end is recorded for the supervisor, not gated.
    slot_start: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    slot_end: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    start_otp_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    end_otp_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    handover_document_link: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    ncr_document_link: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    project_report_document_link: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    drawing_document_link: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    sales_order: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)

    # Backward-compat aliases used throughout existing code.
    user_id = synonym("admin_assigned")
    additional_expense = synonym("incentive")

    # Relationships
    assigned_ip: Mapped[Optional["ip"]] = relationship("ip")
    user: Mapped[Optional["User"]] = relationship("User", back_populates="jobs")
    customer: Mapped[Optional["Customer"]] = relationship("Customer", back_populates="jobs")
    job_rate: Mapped[Optional["JobRate"]] = relationship("JobRate", back_populates="jobs")
    job_checklists: Mapped[List["JobChecklist"]] = relationship(
        "JobChecklist", back_populates="job", cascade="all, delete-orphan"
    )
    job_checklist_item_statuses: Mapped[List["JobChecklistItemStatus"]] = relationship(
        "JobChecklistItemStatus", back_populates="job", cascade="all, delete-orphan"
    )

    # Response-compat properties.
    @property
    def name(self) -> Optional[str]:
        """A job is named after its customer; there is no separate job name."""
        return self.customer.name if self.customer else None

    @property
    def google_map_link(self) -> Optional[str]:
        """Derived from the dropped pin rather than stored."""
        return map_link_from_coords(self.latitude, self.longitude)

    @property
    def customer_name(self) -> Optional[str]:
        return self.customer.name if self.customer else None

    @property
    def customer_phone(self) -> Optional[str]:
        return self.customer.phone_number if self.customer else None

    @property
    def address_line_1(self) -> Optional[str]:
        return self.customer.address_line_1 if self.customer else None

    @property
    def address_line_2(self) -> Optional[str]:
        return self.customer.address_line_2 if self.customer else None

    @property
    def city(self) -> Optional[str]:
        return self.customer.city if self.customer else None

    @property
    def state(self) -> Optional[str]:
        return self.customer.state if self.customer else None

    @property
    def pincode(self) -> Optional[int]:
        return self.customer.pincode if self.customer else None

    @property
    def type(self) -> Optional[str]:
        return self.job_type or (self.job_rate.job_type_name if self.job_rate else None)

    @property
    def rate(self) -> Optional[Decimal]:
        return self.rate_amount if self.rate_amount is not None else (self.job_rate.base_rate if self.job_rate else None)

    @property
    def size(self) -> Optional[int]:
        return self.area

    @property
    def assigned_admin_name(self) -> Optional[str]:
        if not self.user:
            return None
        return self.user.name or self.user.email


class Checklist(Base):
    __tablename__ = "checklists"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=func.now(), onupdate=func.now()
    )

    checklist_items: Mapped[List["ChecklistItem"]] = relationship(
        "ChecklistItem", back_populates="checklist", order_by="ChecklistItem.position"
    )
    job_checklists: Mapped[List["JobChecklist"]] = relationship(
        "JobChecklist", back_populates="checklist"
    )


class JobChecklist(Base):
    __tablename__ = "jobs_checklists"
    __table_args__ = (
        UniqueConstraint("job_id", "checklist_id", name="uq_job_checklist"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), index=True)
    checklist_id: Mapped[int] = mapped_column(ForeignKey("checklists.id"), index=True)
    document_link: Mapped[Optional[str]] = mapped_column(String, nullable=True)#! why is this needed, as we can get the document link from the checklist item status table
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())

    job: Mapped["Job"] = relationship("Job", back_populates="job_checklists")
    checklist: Mapped["Checklist"] = relationship(
        "Checklist", back_populates="job_checklists"
    )


class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    checklist_id: Mapped[int] = mapped_column(ForeignKey("checklists.id"), index=True)
    text: Mapped[str] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=func.now(), onupdate=func.now()
    )

    checklist: Mapped["Checklist"] = relationship(
        "Checklist", back_populates="checklist_items"
    )
    job_checklist_item_statuses: Mapped[List["JobChecklistItemStatus"]] = relationship(
        "JobChecklistItemStatus", back_populates="checklist_item"
    )


class JobChecklistItemStatus(Base):
    __tablename__ = "jobs_checklist_item_status"
    __table_args__ = (
        UniqueConstraint("job_id", "checklist_item_id", name="uq_job_checklist_item"),
        CheckConstraint(
            "review_status IN ('pending', 'approved', 'rejected')",
            name="ck_checklist_item_review_status",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), index=True)
    checklist_item_id: Mapped[int] = mapped_column(ForeignKey("checklist_items.id"), index=True)
    checked: Mapped[bool] = mapped_column(Boolean, default=False)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    review_status: Mapped[str] = mapped_column(String(16), default="pending", nullable=False)#! is this necessary !!
    comment: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    admin_comment: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    document_link: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), onupdate=func.now()
    )

    job: Mapped["Job"] = relationship("Job", back_populates="job_checklist_item_statuses")
    checklist_item: Mapped["ChecklistItem"] = relationship(
        "ChecklistItem", back_populates="job_checklist_item_statuses"
    )
