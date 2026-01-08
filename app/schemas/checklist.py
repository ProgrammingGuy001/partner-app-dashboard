from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


# --- Checklist ---
class ChecklistBase(BaseModel):
    name: str
    description: Optional[str] = None


class ChecklistCreate(ChecklistBase):
    pass


class ChecklistUpdate(ChecklistBase):
    pass


class ChecklistResponse(ChecklistBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- ChecklistItem ---
class ChecklistItemBase(BaseModel):
    text: str
    position: int = 0


class ChecklistItemCreate(ChecklistItemBase):
    checklist_id: int


class ChecklistItemUpdate(ChecklistItemBase):
    pass


class ChecklistItemResponse(ChecklistItemBase):
    id: int
    checklist_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- JobChecklist ---
class JobChecklistBase(BaseModel):
    job_id: int
    checklist_id: int


class JobChecklistCreate(JobChecklistBase):
    pass


class JobChecklistResponse(JobChecklistBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- JobChecklistItemStatus ---
class JobChecklistItemStatusBase(BaseModel):
    job_id: int
    checklist_item_id: int
    checked: bool = False
    is_approved: bool = False
    comment: Optional[str] = None
    admin_comment: Optional[str] = None
    document_link: Optional[str] = None


class JobChecklistItemStatusCreate(JobChecklistItemStatusBase):
    pass


class JobChecklistItemStatusUpdate(BaseModel):
    checked: Optional[bool] = None
    is_approved: Optional[bool] = None
    comment: Optional[str] = None
    admin_comment: Optional[str] = None
    document_link: Optional[str] = None


class JobChecklistItemStatusResponse(JobChecklistItemStatusBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Composite Schemas ---
class ChecklistWithItemsResponse(ChecklistResponse):
    checklist_items: List[ChecklistItemResponse] = []

class ChecklistItemWithStatusResponse(ChecklistItemResponse):
    status: Optional[JobChecklistItemStatusResponse] = None

class ChecklistWithItemsAndStatusResponse(ChecklistResponse):
    items: List[ChecklistItemWithStatusResponse] = []