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


# --- 1. Your Updated Job Model ---
class Job(Base):
    __tablename__ = "job"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True, autoincrement=True
    )
    name: Mapped[str] = mapped_column(String, nullable=True)
    customer_name: Mapped[str] = mapped_column(String, nullable=True)
    address: Mapped[str] = mapped_column(String, nullable=True)
    city: Mapped[str] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="created")
    pincode: Mapped[int] = mapped_column(Integer, nullable=True)
    assigned_ip_id: Mapped[int] = mapped_column(Integer, nullable=True)
    type: Mapped[str] = mapped_column(String, nullable=True)
    rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=True)
    size: Mapped[int] = mapped_column(Integer, nullable=True)
    delivery_date: Mapped[date] = mapped_column(Date, nullable=True)
    checklist_link: Mapped[str] = mapped_column(String, nullable=True)
    google_map_link: Mapped[str] = mapped_column(String, nullable=True)
    additional_expense: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=True, default=0
    )

    # --- NEW: Direct Link to a Primary Checklist Template ---
    checklist_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("checklists.id"), nullable=True
    )

    # --- NEW: Relationships ---
    # 1. The specific tasks created for this job
    checklist_items: Mapped[List["ChecklistItem"]] = relationship(
        "ChecklistItem", back_populates="job"
    )

    # 2. The link table (if you need to track the template association)
    linked_checklists: Mapped[List["JobChecklistLink"]] = relationship(
        "JobChecklistLink", back_populates="job"
    )

    def __repr__(self):
        return f"<Job {self.name}>"


# --- 2. Checklist Template Model ---
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
    items: Mapped[List["ChecklistItem"]] = relationship(
        "ChecklistItem", back_populates="checklist"
    )
    linked_jobs: Mapped[List["JobChecklistLink"]] = relationship(
        "JobChecklistLink", back_populates="checklist"
    )


# --- 3. Link Table (Job <-> Checklist) ---
class JobChecklistLink(Base):
    __tablename__ = "job_checklist_link"

    job_id: Mapped[int] = mapped_column(ForeignKey("job.id"), primary_key=True)
    checklist_id: Mapped[int] = mapped_column(
        ForeignKey("checklists.id"), primary_key=True
    )

    # Relationships
    job: Mapped["Job"] = relationship("Job", back_populates="linked_checklists")
    checklist: Mapped["Checklist"] = relationship(
        "Checklist", back_populates="linked_jobs"
    )


# --- 4. Checklist Item (The Actual Tasks) ---
class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Foreign Keys
    checklist_id: Mapped[int] = mapped_column(ForeignKey("checklists.id"))
    job_id: Mapped[int] = mapped_column(ForeignKey("job.id"))

    # Task Data
    text: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="pending")
    position: Mapped[int] = mapped_column(Integer, default=0)
    checked: Mapped[bool] = mapped_column(Boolean, default=False)
    comment: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    document_link: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), onupdate=func.now()
    )

    # Relationships
    checklist: Mapped["Checklist"] = relationship("Checklist", back_populates="items")
    job: Mapped["Job"] = relationship("Job", back_populates="checklist_items")
