from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class BOMItemResponse(BaseModel):
    product_name: str
    cabinet_position: Optional[str] = None
    depth: int
    children: List['BOMItemResponse'] = []

class BucketItemCreate(BaseModel):
    product_name: str
    quantity: Optional[float] = Field(1.0, gt=0)
    issue_description: Optional[str] = None
    responsible_department: Optional[str] = None

class SiteRequisiteSubmit(BaseModel):
    sales_order: str
    cabinet_position: str
    sr_poc: Optional[str] = None
    items: List[BucketItemCreate]

class SiteRequisiteResponse(BaseModel):
    id: int
    product_name: str
    quantity: float
    issue_description: Optional[str]
    responsible_department: Optional[str]
    created_date: datetime
    
    class Config:
        from_attributes = True

class SODetailResponse(BaseModel):
    id: int
    sales_order: str
    created_date: datetime
    closed_date: Optional[datetime]
    status: str
    sr_poc: Optional[str]
    site_requisites: List[SiteRequisiteResponse] = []
    
    class Config:
        from_attributes = True