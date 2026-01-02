from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.schemas.checklist import Checklist, ChecklistItem, ChecklistItemCreate
from app.api import deps

router = APIRouter()

checklists = {}

@router.get("/checklists", response_model=List[Checklist])
def read_checklists():
    return list(checklists.values())

@router.post("/checklists", response_model=Checklist)
def create_checklist(checklist: Checklist, db: Session = Depends(deps.get_db)):
    if checklist.id in checklists:
        raise HTTPException(status_code=400, detail="Checklist already registered")
    checklists[checklist.id] = checklist
    return checklist

@router.get("/checklists/{checklist_id}", response_model=Checklist)
def read_checklist(checklist_id: int):
    if checklist_id not in checklists:
        raise HTTPException(status_code=404, detail="Checklist not found")
    return checklists[checklist_id]

@router.post("/checklists/{checklist_id}/items", response_model=ChecklistItem)
def create_checklist_item(checklist_id: int, item: ChecklistItemCreate):
    if checklist_id not in checklists:
        raise HTTPException(status_code=404, detail="Checklist not found")
    
    checklist = checklists[checklist_id]
    new_id = len(checklist.items) + 1
    new_item = ChecklistItem(id=new_id, name=item.name, description=item.description, is_completed=False)
    checklist.items.append(new_item)
    return new_item
