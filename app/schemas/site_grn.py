from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class GRNPackageResponse(BaseModel):
    id: int
    odoo_package_id: Optional[int]
    odoo_line_id: Optional[int] = None
    package_name: str
    barcode: Optional[str] = None
    is_received: bool

    class Config:
        from_attributes = True


class GRNIPUser(BaseModel):
    id: int
    first_name: Optional[str]
    last_name: Optional[str]
    phone_number: str

    class Config:
        from_attributes = True


class GRNResponse(BaseModel):
    id: int
    source_document: str
    odoo_picking_id: Optional[int]
    odoo_picking_name: Optional[str] = None
    ip_user_id: int
    created_by_admin_id: int
    status: str
    has_missing: bool
    created_at: datetime
    submitted_at: Optional[datetime]
    packages: List[GRNPackageResponse] = []
    ip_user: Optional[GRNIPUser] = None

    class Config:
        from_attributes = True


class GRNCreate(BaseModel):
    source_document: str = Field(..., min_length=1, max_length=128)
    ip_user_id: int = Field(..., gt=0)
    picking_ids: Optional[List[int]] = None


class GRNPackageSubmit(BaseModel):
    package_id: int
    is_received: bool


class GRNSubmit(BaseModel):
    packages: List[GRNPackageSubmit]


class OdooPackageInfo(BaseModel):
    odoo_package_id: Optional[int]
    package_name: str


class OdooPickingInfo(BaseModel):
    picking_id: int
    picking_name: str
    origin: Optional[str]
    partner_name: Optional[str]
    packages: List[OdooPackageInfo]


class NotificationResponse(BaseModel):
    id: int
    title: str
    body: str
    grn_id: Optional[int]
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
