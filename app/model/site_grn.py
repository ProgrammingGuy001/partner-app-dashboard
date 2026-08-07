from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.model.ip import ip
    from app.model.job import Job
    from app.model.user import User


class SiteGRN(Base):
    __tablename__ = "site_grn"
    __table_args__ = (
        UniqueConstraint("odoo_picking_id", name="uq_site_grn_odoo_picking"),
        CheckConstraint("status IN ('pending', 'submitted', 'processed')", name="ck_grn_status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, index=True)
    source_document: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    odoo_picking_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    odoo_picking_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    ip_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("ip_user.id"), nullable=True, index=True)
    job_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("jobs.id"), nullable=True, index=True)
    created_by_admin_id: Mapped[int] = mapped_column(Integer, ForeignKey("admin.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    has_missing: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    odoo_sync_error: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    packages: Mapped[List["GRNPackage"]] = relationship(
        "GRNPackage", back_populates="grn", cascade="all, delete-orphan"
    )
    ip_user: Mapped[Optional["ip"]] = relationship("ip", foreign_keys=[ip_user_id])
    created_by: Mapped["User"] = relationship("User", foreign_keys=[created_by_admin_id])
    job: Mapped[Optional["Job"]] = relationship("Job", foreign_keys=[job_id])


class GRNPackage(Base):
    __tablename__ = "grn_package"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    grn_id: Mapped[int] = mapped_column(Integer, ForeignKey("site_grn.id"), nullable=False, index=True)
    odoo_package_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    odoo_line_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    package_name: Mapped[str] = mapped_column(String(256), nullable=False)
    barcode: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    is_received: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    grn: Mapped["SiteGRN"] = relationship("SiteGRN", back_populates="packages")
