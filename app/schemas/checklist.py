from pydantic import BaseModel
from typing import List, Optional

class ChecklistItem(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    is_completed: bool

    class Config:
        orm_mode = True

class ChecklistItemCreate(BaseModel):
    name: str
    description: Optional[str] = None

class Checklist(BaseModel):
    id: int
    name: str
    items: List[ChecklistItem] = []

    class Config:
        orm_mode = True
