from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, Index, text, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class InvoiceRequest(Base):
    __tablename__ = "invoice_requests"
    __table_args__ = (
        Index("idx_one_pending_invoice_per_job", "job_id", unique=True, postgresql_where=text("status = 'pending'")),
        CheckConstraint("status IN ('pending', 'approved', 'rejected')", name="ck_invoice_status"),
        CheckConstraint(
            "completion_percentage IS NULL OR completion_percentage BETWEEN 0 AND 100",
            name="ck_invoice_completion_percentage",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    requested_by_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("admin.id"), nullable=True
    )
    # Set instead of requested_by_id when a partner (IP user) raises the request.
    requested_by_ip_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("ip_user.id"), nullable=True
    )
    invoice_number: Mapped[Optional[str]] = mapped_column(String(80), nullable=True, index=True)
    completion_percentage: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    approved_by_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("admin.id"), nullable=True
    )
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    requested_by: Mapped[Optional["User"]] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[requested_by_id]
    )
    requested_by_ip: Mapped[Optional["ip"]] = relationship(  # type: ignore[name-defined]
        "ip", foreign_keys=[requested_by_ip_id]
    )
    approved_by: Mapped[Optional["User"]] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[approved_by_id]
    )
