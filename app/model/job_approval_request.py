from datetime import datetime
from typing import Optional

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class JobApprovalRequest(Base):
    """Superadmin approval as a fallback when the customer OTP path is unusable.

    Carries the completion document links for `finish` so the approver replays exactly
    what the requester validated.
    """

    __tablename__ = "job_approval_requests"
    __table_args__ = (
        Index(
            "idx_one_pending_job_approval",
            "job_id",
            "action",
            unique=True,
            postgresql_where=text("status = 'pending'"),
            sqlite_where=text("status = 'pending'"),
        ),
        CheckConstraint("action IN ('start', 'finish')", name="ck_job_approval_action"),
        CheckConstraint("status IN ('pending', 'approved', 'rejected')", name="ck_job_approval_status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    action: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    requested_by_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("admin.id"), nullable=True
    )
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    handover_document_link: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ncr_document_link: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    project_report_document_link: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reviewed_by_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("admin.id"), nullable=True
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    review_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    job: Mapped["Job"] = relationship("Job")  # type: ignore[name-defined]
    requested_by: Mapped[Optional["User"]] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[requested_by_id]
    )
    reviewed_by: Mapped[Optional["User"]] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[reviewed_by_id]
    )

    # Response-compat properties, matching Job.assigned_admin_name.
    @property
    def job_name(self) -> Optional[str]:
        return self.job.name if self.job else None

    @property
    def requested_by_name(self) -> Optional[str]:
        if not self.requested_by:
            return None
        return self.requested_by.name or self.requested_by.email
