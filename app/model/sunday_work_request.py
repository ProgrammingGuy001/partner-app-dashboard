from datetime import date, datetime
from typing import Optional

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SundayWorkRequest(Base):
    __tablename__ = "sunday_work_requests"
    __table_args__ = (
        UniqueConstraint("ip_user_id", "request_date", name="uq_sunday_work_request_ip_date"),
        CheckConstraint("status IN ('pending', 'approved', 'rejected')", name="ck_sunday_work_request_status"),
        # Exactly one requester: an IP or a supervisor, never both and never neither.
        CheckConstraint(
            "(ip_user_id IS NULL) <> (admin_id IS NULL)",
            name="ck_sunday_work_request_single_requester",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ip_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("ip_user.id"), nullable=True, index=True)
    admin_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("admin.id"), nullable=True, index=True)
    request_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="pending", nullable=False, index=True)
    reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    reviewed_by_admin_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("admin.id"), nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    review_notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    # The attendance attempt that raised this request: GPS, photo and location, parked
    # until a superadmin decides. NULL on a request filed ahead of the Sunday, which
    # only unlocks the day. One blob rather than eight columns because nothing queries
    # inside it — app/services/sunday_attendance.py writes it and replays it verbatim.
    attendance_payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    ip_user: Mapped[Optional["ip"]] = relationship("ip", foreign_keys=[ip_user_id])
    admin: Mapped[Optional["User"]] = relationship("User", foreign_keys=[admin_id])
    reviewed_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[reviewed_by_admin_id])

    @property
    def requester_type(self) -> str:
        return "ip" if self.ip_user_id is not None else "supervisor"
