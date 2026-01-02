from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


# --- Shared Properties ---
class ChecklistItemBase(BaseModel):
    text: str
    position: int = 0
    status: str = "pending"


# --- Admin Schemas (Creation) ---
class ChecklistCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ChecklistItemCreate(ChecklistItemBase):
    checklist_id: int
    job_id: int


class JobChecklistLinkCreate(BaseModel):
    job_id: int
    checklist_id: int


# --- User Schemas (Updates) ---
class ChecklistItemUpdateUser(BaseModel):
    checked: bool
    status: Optional[str] = None
    comment: Optional[str] = None
    document_link: Optional[str] = None


# --- Responses ---
class ChecklistItemResponse(ChecklistItemBase):
    id: int
    checklist_id: int
    job_id: int
    checked: bool
    comment: Optional[str] = None
    document_link: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChecklistResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChecklistWithItemsResponse(ChecklistResponse):
    items: List[ChecklistItemResponse] = []
