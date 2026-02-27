from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship, synonym
from sqlalchemy.sql import func

from app.database import Base


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    phone_number: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    pincode: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    jobs: Mapped[List["Job"]] = relationship("Job", back_populates="customer")


class JobRate(Base):
    __tablename__ = "job_rates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    job_type_name: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    base_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    jobs: Mapped[List["Job"]] = relationship("Job", back_populates="job_rate")


class Job(Base):
    __tablename__ = "jobs"

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
    additional_expense: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=True, default=0
    )
    job_rate_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("job_rates.id"), nullable=True, index=True
    )
    area: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    admin_assigned: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("admin.id"), nullable=True, index=True
    )
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    checklist_link: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    google_map_link: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    start_otp_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    end_otp_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    # Backward-compat alias used throughout existing code.
    user_id = synonym("admin_assigned")

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
    def customer_name(self) -> Optional[str]:
        return self.customer.name if self.customer else None

    @property
    def customer_phone(self) -> Optional[str]:
        return self.customer.phone_number if self.customer else None

    @property
    def address(self) -> Optional[str]:
        return self.customer.address if self.customer else None

    @property
    def city(self) -> Optional[str]:
        return self.customer.city if self.customer else None

    @property
    def pincode(self) -> Optional[int]:
        return self.customer.pincode if self.customer else None

    @property
    def type(self) -> Optional[str]:
        return self.job_rate.job_type_name if self.job_rate else None

    @property
    def rate(self) -> Optional[Decimal]:
        return self.job_rate.base_rate if self.job_rate else None

    @property
    def size(self) -> Optional[int]:
        return self.area


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
        "ChecklistItem", back_populates="checklist"
    )
    job_checklists: Mapped[List["JobChecklist"]] = relationship(
        "JobChecklist", back_populates="checklist"
    )


class JobChecklist(Base):
    __tablename__ = "jobs_checklists"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), index=True)
    checklist_id: Mapped[int] = mapped_column(ForeignKey("checklists.id"), index=True)
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

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), index=True)
    checklist_item_id: Mapped[int] = mapped_column(ForeignKey("checklist_items.id"), index=True)
    checked: Mapped[bool] = mapped_column(Boolean, default=False)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False)
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
