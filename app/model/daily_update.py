from datetime import date, datetime
from typing import List, Optional

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class DailyJobUpdate(Base):
    __tablename__ = "daily_job_updates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    submitted_by_type: Mapped[str] = mapped_column(String(20), nullable=False)  # 'ip' | 'supervisor'
    submitted_by_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    update_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())

    photos: Mapped[List["DailyJobUpdatePhoto"]] = relationship(
        "DailyJobUpdatePhoto",
        back_populates="update",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class DailyJobUpdatePhoto(Base):
    __tablename__ = "daily_job_update_photos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    update_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("daily_job_updates.id", ondelete="CASCADE"), nullable=False, index=True
    )
    photo_url: Mapped[str] = mapped_column(String, nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())

    update: Mapped["DailyJobUpdate"] = relationship("DailyJobUpdate", back_populates="photos")
