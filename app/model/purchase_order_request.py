from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PurchaseOrderRequest(Base):
    __tablename__ = "purchase_order_requests"
    __table_args__ = (
        CheckConstraint("service_type IN ('b2b', 'b2c')", name="ck_po_request_service_type"),
        CheckConstraint("status IN ('pending', 'approved')", name="ck_po_request_status"),
        CheckConstraint(
            "bill_status IN ('not_requested', 'pending', 'approved')",
            name="ck_po_request_bill_status",
        ),
        CheckConstraint("quantity > 0", name="ck_po_request_quantity_positive"),
        CheckConstraint("unit_price > 0", name="ck_po_request_unit_price_positive"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    requested_by_id: Mapped[int] = mapped_column(ForeignKey("admin.id"), nullable=False, index=True)
    approved_by_id: Mapped[int | None] = mapped_column(ForeignKey("admin.id"), nullable=True)
    vendor_id: Mapped[int] = mapped_column(Integer, nullable=False)
    vendor_name: Mapped[str] = mapped_column(String(255), nullable=False)
    sales_order: Mapped[str | None] = mapped_column(String(100), nullable=True)
    poc_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    service_type: Mapped[str] = mapped_column(String(3), nullable=False)
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    po_number: Mapped[str | None] = mapped_column(String(30), unique=True, index=True, nullable=True)
    odoo_sync_key: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    odoo_purchase_order_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    odoo_purchase_order_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    odoo_sync_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    bill_status: Mapped[str] = mapped_column(String(20), nullable=False, default="not_requested", index=True)
    bill_requested_by_id: Mapped[int | None] = mapped_column(ForeignKey("admin.id"), nullable=True)
    bill_requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    bill_approved_by_id: Mapped[int | None] = mapped_column(ForeignKey("admin.id"), nullable=True)
    bill_approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    odoo_vendor_bill_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    odoo_vendor_bill_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    bill_sync_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    requested_by = relationship("User", foreign_keys=[requested_by_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])
    bill_requested_by = relationship("User", foreign_keys=[bill_requested_by_id])
    bill_approved_by = relationship("User", foreign_keys=[bill_approved_by_id])
