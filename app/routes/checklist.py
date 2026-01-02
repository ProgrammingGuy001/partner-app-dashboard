from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.model.job import Checklist, ChecklistItem, JobChecklistLink, Job
from app.schemas.checklist import (
    ChecklistCreate,
    ChecklistResponse,
    ChecklistItemCreate,
    ChecklistItemResponse,
    JobChecklistLinkCreate,
    ChecklistItemUpdateUser,
)

router = APIRouter(prefix="/checklists", tags=["Checklist Management"])

# --- NEW ROUTES: Manage Checklist Definitions ---


# 1. Get All Checklists (The Categories/Templates)
@router.get("/", response_model=List[ChecklistResponse])
def get_all_checklists(db: Session = Depends(get_db)):
    """
    List all available checklist types (e.g., 'Kitchen Deep Clean', 'AC Repair').
    """
    checklists = db.query(Checklist).all()
    return checklists


# 2. Create a New Checklist Category
@router.post("/", response_model=ChecklistResponse)
def create_checklist(checklist: ChecklistCreate, db: Session = Depends(get_db)):
    """
    Create a new checklist category.
    """
    db_checklist = Checklist(**checklist.model_dump())
    db.add(db_checklist)
    db.commit()
    db.refresh(db_checklist)
    return db_checklist


# 3. Get Specific Checklist details (with Items option)
@router.get("/{checklist_id}", response_model=ChecklistResponse)
def get_checklist(checklist_id: int, db: Session = Depends(get_db)):
    """
    Get details of a specific checklist.
    """
    checklist = (
        db.query(Checklist).filter(Checklist.id == checklist_id).first()
    )
    if not checklist:
        raise HTTPException(status_code=404, detail="Checklist not found")
    return checklist


# --- EXISTING ROUTES: Job Specific Operations ---


# 4. Add an Item to a Job's Checklist
@router.post("/items", response_model=ChecklistItemResponse)
def add_item_to_job(item: ChecklistItemCreate, db: Session = Depends(get_db)):
    # Verify Job and Checklist exist
    job = db.query(Job).filter(Job.id == item.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    db_item = ChecklistItem(**item.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


# 5. Link a Checklist Category to a Job
@router.post("/link", status_code=201)
def link_checklist_to_job(
    link: JobChecklistLinkCreate, db: Session = Depends(get_db)
):
    # Check if link already exists
    existing = (
        db.query(JobChecklistLink)
        .filter_by(job_id=link.job_id, checklist_id=link.checklist_id)
        .first()
    )

    if existing:
        return {"message": "Already linked"}

    db_link = JobChecklistLink(
        job_id=link.job_id, checklist_id=link.checklist_id
    )
    db.add(db_link)
    db.commit()
    return {"message": "Checklist linked successfully"}


# 6. Get All Items for a Specific Job
@router.get("/job/{job_id}/items", response_model=List[ChecklistItemResponse])
def get_job_checklist_items(job_id: int, db: Session = Depends(get_db)):
    items = (
        db.query(ChecklistItem)
        .filter(ChecklistItem.job_id == job_id)
        .order_by(ChecklistItem.position)
        .all()
    )
    return items


# 7. Update Item Status (Toggle Check / Add Comment)
@router.patch("/items/{item_id}", response_model=ChecklistItemResponse)
def update_checklist_item(
    item_id: int,
    update_data: ChecklistItemUpdateUser,
    db: Session = Depends(get_db),
):
    item = (
        db.query(ChecklistItem)
        .filter(ChecklistItem.id == item_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Update fields provided in request
    for key, value in update_data.model_dump(exclude_unset=True).items():
        setattr(item, key, value)

    item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(item)
    return item
