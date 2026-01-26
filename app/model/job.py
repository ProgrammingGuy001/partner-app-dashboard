from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class Job(Base):
    __tablename__ = "job"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True, autoincrement=True
    )
    name: Mapped[str] = mapped_column(String, nullable=True)
    customer_name: Mapped[str] = mapped_column(String, nullable=True)
    address: Mapped[str] = mapped_column(String, nullable=True)
    city: Mapped[str] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="created", index=True)
    pincode: Mapped[int] = mapped_column(Integer, nullable=True)
    assigned_ip_id: Mapped[int] = mapped_column(Integer, ForeignKey("ip.id"), nullable=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    type: Mapped[str] = mapped_column(String, nullable=True)
    rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=True)
    size: Mapped[int] = mapped_column(Integer, nullable=True)
    delivery_date: Mapped[date] = mapped_column(Date, nullable=True)
    checklist_link: Mapped[str] = mapped_column(String, nullable=True)
    google_map_link: Mapped[str] = mapped_column(String, nullable=True)
    additional_expense: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=True, default=0
    )
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    
    # Customer phone for OTP verification
    customer_phone: Mapped[str | None] = mapped_column(String, nullable=True)
    
    # Start OTP fields (sent when job starts)
    start_otp: Mapped[str | None] = mapped_column(String, nullable=True)
    start_otp_expiry: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    start_otp_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # End OTP fields (sent when job completes)
    end_otp: Mapped[str | None] = mapped_column(String, nullable=True)
    end_otp_expiry: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    end_otp_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relationships
    assigned_ip: Mapped["ip"] = relationship("ip")
    user: Mapped["User"] = relationship("User")
    job_checklists: Mapped[List["JobChecklist"]] = relationship(
        "JobChecklist", back_populates="job", cascade="all, delete-orphan"
    )
    job_checklist_item_statuses: Mapped[List["JobChecklistItemStatus"]] = relationship(
        "JobChecklistItemStatus", back_populates="job", cascade="all, delete-orphan"
    )


class Checklist(Base):
    __tablename__ = "checklists"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), onupdate=func.now()
    )

    # Relationships
    checklist_items: Mapped[List["ChecklistItem"]] = relationship(
        "ChecklistItem", back_populates="checklist"
    )
    job_checklists: Mapped[List["JobChecklist"]] = relationship(
        "JobChecklist", back_populates="checklist"
    )


class JobChecklist(Base):
    __tablename__ = "job_checklists"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("job.id"))
    checklist_id: Mapped[int] = mapped_column(ForeignKey("checklists.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    # Relationships
    job: Mapped["Job"] = relationship("Job", back_populates="job_checklists")
    checklist: Mapped["Checklist"] = relationship(
        "Checklist", back_populates="job_checklists"
    )


class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    checklist_id: Mapped[int] = mapped_column(ForeignKey("checklists.id"))
    text: Mapped[str] = mapped_column(String)
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), onupdate=func.now()
    )

    # Relationships
    checklist: Mapped["Checklist"] = relationship(
        "Checklist", back_populates="checklist_items"
    )
    job_checklist_item_statuses: Mapped[List["JobChecklistItemStatus"]] = relationship(
        "JobChecklistItemStatus", back_populates="checklist_item"
    )


class JobChecklistItemStatus(Base):
    __tablename__ = "job_checklist_item_status"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("job.id"))
    checklist_item_id: Mapped[int] = mapped_column(ForeignKey("checklist_items.id"))
    checked: Mapped[bool] = mapped_column(Boolean, default=False)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    comment: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    admin_comment: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    document_link: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), onupdate=func.now()
    )

    # Relationships
    job: Mapped["Job"] = relationship("Job", back_populates="job_checklist_item_statuses")
    checklist_item: Mapped["ChecklistItem"] = relationship(
        "ChecklistItem", back_populates="job_checklist_item_statuses"
    )
    