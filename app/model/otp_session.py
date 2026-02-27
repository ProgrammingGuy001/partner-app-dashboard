from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class OTPSession(Base):
    __tablename__ = "otp_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    purpose: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    phone_number: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    otp_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_used: Mapped[bool] = mapped_column(Boolean, default=False)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    ip_user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("ip_user.id"), nullable=True, index=True
    )
    job_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("jobs.id"), nullable=True, index=True
    )
