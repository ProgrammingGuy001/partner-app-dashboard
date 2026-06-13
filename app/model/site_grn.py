from datetime import datetime
from typing import List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SiteGRN(Base):
    __tablename__ = "site_grn"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, index=True)
    source_document: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    odoo_picking_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    odoo_picking_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    ip_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("ip_user.id"), nullable=False, index=True)
    created_by_admin_id: Mapped[int] = mapped_column(Integer, ForeignKey("admin.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    has_missing: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    packages: Mapped[List["GRNPackage"]] = relationship(
        "GRNPackage", back_populates="grn", cascade="all, delete-orphan"
    )
    ip_user: Mapped["ip"] = relationship("ip", foreign_keys=[ip_user_id])
    created_by: Mapped["User"] = relationship("User", foreign_keys=[created_by_admin_id])


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


class AdminNotification(Base):
    __tablename__ = "admin_notification"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, index=True)
    admin_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("admin.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    grn_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("site_grn.id"), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)