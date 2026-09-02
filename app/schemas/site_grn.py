from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, model_validator


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


class GRNJob(BaseModel):
    id: int
    name: Optional[str] = None

    class Config:
        from_attributes = True


class GRNAdminUser(BaseModel):
    id: int
    name: Optional[str] = None
    email: Optional[str] = None

    class Config:
        from_attributes = True


class GRNResponse(BaseModel):
    id: int
    source_document: str
    odoo_picking_id: Optional[int]
    odoo_picking_name: Optional[str] = None
    ip_user_id: Optional[int] = None
    job_id: Optional[int] = None
    created_by_admin_id: int
    status: str
    has_missing: bool
    odoo_sync_error: Optional[str] = None
    created_at: datetime
    submitted_at: Optional[datetime]
    packages: List[GRNPackageResponse] = []
    ip_user: Optional[GRNIPUser] = None
    created_by: Optional[GRNAdminUser] = None
    job: Optional[GRNJob] = None

    class Config:
        from_attributes = True


class RepairOrderInfo(BaseModel):
    id: Optional[int] = None
    name: str


class JobGRNPaperwork(BaseModel):
    """Everything a GRN job's receipt work hangs off: its SO, the ROs Odoo links to
    that SO, and the GRNs raised against it. Both the supervisor and the assigned IP
    see the same payload and can close the same GRNs."""

    job_id: int
    sales_order: Optional[str] = None
    repair_orders: List[RepairOrderInfo] = []
    # Set when the SO could not be resolved - Odoo unreachable, or a job carrying an SO
    # number the order does not exist under yet. The GRNs below are still usable.
    lookup_error: Optional[str] = None
    grns: List[GRNResponse] = []


class GRNCreate(BaseModel):
    source_document: str = Field(..., min_length=1, max_length=128)
    ip_user_id: Optional[int] = Field(None, gt=0)
    assign_to_self: bool = False
    job_id: Optional[int] = Field(None, gt=0)
    picking_ids: Optional[List[int]] = None

    @model_validator(mode="after")
    def validate_assignee(self):
        if self.assign_to_self == (self.ip_user_id is not None):
            raise ValueError("Choose one assignee: an IP user or yourself")
        return self


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
