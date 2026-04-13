from datetime import date, datetime
from typing import Literal, Optional, List

from pydantic import BaseModel, Field

DEPARTMENT_TYPES = Literal["design", "engineering", "quality", "sale", "fulfillment", "other"]

class BOMItemResponse(BaseModel):
    product_name: str
    cabinet_position: Optional[str] = None
    depth: int
    children: List['BOMItemResponse'] = []

class BucketItemCreate(BaseModel):
    product_name: str
    quantity: Optional[float] = Field(1.0, gt=0)
    issue_description: Optional[str] = None
    responsible_department: Optional[DEPARTMENT_TYPES] = None
    component_status: Optional[str] = None

class SiteRequisiteSubmit(BaseModel):
    sales_order: str
    cabinet_position: str
    sr_poc: Optional[str] = None
    repair_reference: Optional[str] = None
    expected_delivery: Optional[date] = None
    do_number: Optional[str] = None
    items: List[BucketItemCreate]

class SiteRequisiteResponse(BaseModel):
    id: int
    product_name: str
    quantity: float
    issue_description: Optional[str]
    responsible_department: Optional[str] = None
    component_status: Optional[str] = None
    created_date: datetime

    class Config:
        from_attributes = True

class SODetailResponse(BaseModel):
    id: int
    sales_order: str
    cabinet_position: Optional[str] = None
    created_date: datetime
    closed_date: Optional[datetime] = None
    status: str
    sr_poc: Optional[str] = None
    customer_name: Optional[str] = None
    project_name: Optional[str] = None
    delivery_address: Optional[str] = None
    so_poc: Optional[str] = None
    so_status: Optional[str] = None
    repair_reference: Optional[str] = None
    expected_delivery: Optional[date] = None
    do_number: Optional[str] = None
    site_requisites: List[SiteRequisiteResponse] = []

    class Config:
        from_attributes = True
