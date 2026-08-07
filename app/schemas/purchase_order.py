from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class PurchaseOrderRequestCreate(BaseModel):
    vendor_id: int = Field(gt=0)
    sales_order: str = Field(min_length=1, max_length=100, pattern=r".*\S.*")
    poc_name: str = Field(min_length=1, max_length=255, pattern=r".*\S.*")
    service_type: Literal["b2b", "b2c"]
    quantity: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    unit_price: Decimal = Field(gt=0, max_digits=12, decimal_places=2)


class PurchaseVendorResponse(BaseModel):
    id: int
    name: str


class PurchaseOrderRequestResponse(BaseModel):
    id: int
    po_number: str | None = None
    vendor_id: int
    vendor_name: str
    sales_order: str | None = None
    poc_name: str | None = None
    service_type: Literal["b2b", "b2c"]
    product_name: str
    quantity: Decimal
    unit_price: Decimal
    status: Literal["pending", "approved"]
    requested_at: datetime
    requested_by_email: str | None = None
    approved_at: datetime | None = None
    approved_by_email: str | None = None
    odoo_purchase_order_id: int | None = None
    odoo_purchase_order_name: str | None = None
    odoo_sync_error: str | None = None
    odoo_purchase_order_state: str | None = None
    odoo_invoice_status: str | None = None
    odoo_status_error: str | None = None
    bill_status: Literal["not_requested", "pending", "approved"]
    bill_requested_at: datetime | None = None
    bill_requested_by_email: str | None = None
    bill_approved_at: datetime | None = None
    bill_approved_by_email: str | None = None
    odoo_vendor_bill_id: int | None = None
    odoo_vendor_bill_name: str | None = None
    odoo_vendor_bill_state: str | None = None
    bill_sync_error: str | None = None

    model_config = ConfigDict(from_attributes=True)
