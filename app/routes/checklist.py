from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.checklist import (
    ChecklistCreate,
    ChecklistResponse,
    ChecklistUpdate,
    ChecklistItemCreate,
    ChecklistItemResponse,
    ChecklistItemUpdate,
    JobChecklistCreate,
    JobChecklistResponse,
    JobChecklistItemStatusCreate,
    JobChecklistItemStatusResponse,
    JobChecklistItemStatusUpdate,
    ChecklistWithItemsResponse,
    ChecklistWithItemsAndStatusResponse,
)
from app.crud.checklist import (
    create_checklist,
    create_checklist_item,
    create_job_checklist,
    create_job_checklist_item_status,
    delete_checklist,
    delete_checklist_item,
    get_checklist,
    get_checklist_item,
    get_checklist_items_by_checklist,
    get_checklists,
    get_job_checklist_item_status,
    update_checklist,
    update_checklist_item,
    update_job_checklist_item_status,
    get_job_checklists_status,
)

router = APIRouter(prefix="/checklists", tags=["Checklists"])


# --- Checklist ---
@router.post("/", response_model=ChecklistResponse)
def create_new_checklist(
    checklist: ChecklistCreate, db: Session = Depends(get_db)
):
    return create_checklist(db, checklist)


@router.get("/", response_model=List[ChecklistResponse])
def read_all_checklists(
    skip: int = 0, limit: int = 100, db: Session = Depends(get_db)
):
    return get_checklists(db, skip=skip, limit=limit)


@router.get("/jobs/{job_id}/status", response_model=List[ChecklistWithItemsAndStatusResponse])
def read_job_checklists_status(job_id: int, db: Session = Depends(get_db)):
    return get_job_checklists_status(db, job_id)


@router.get("/{checklist_id}", response_model=ChecklistWithItemsResponse)
def read_checklist(checklist_id: int, db: Session = Depends(get_db)):
    db_checklist = get_checklist(db, checklist_id)
    if db_checklist is None:
        raise HTTPException(status_code=404, detail="Checklist not found")
    items = get_checklist_items_by_checklist(db, checklist_id)
    return ChecklistWithItemsResponse(
        **db_checklist.__dict__, checklist_items=items
    )


@router.put("/{checklist_id}", response_model=ChecklistResponse)
def update_existing_checklist(
    checklist_id: int,
    checklist: ChecklistUpdate,
    db: Session = Depends(get_db),
):
    return update_checklist(db, checklist_id, checklist)


@router.delete("/{checklist_id}", response_model=ChecklistResponse)
def delete_existing_checklist(checklist_id: int, db: Session = Depends(get_db)):
    return delete_checklist(db, checklist_id)


# --- ChecklistItem ---
@router.post("/items", response_model=ChecklistItemResponse)
def create_new_checklist_item(
    item: ChecklistItemCreate, db: Session = Depends(get_db)
):
    return create_checklist_item(db, item)


@router.get("/items/{item_id}", response_model=ChecklistItemResponse)
def read_checklist_item(item_id: int, db: Session = Depends(get_db)):
    db_item = get_checklist_item(db, item_id)
    if db_item is None:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    return db_item


@router.put("/items/{item_id}", response_model=ChecklistItemResponse)
def update_existing_checklist_item(
    item_id: int,
    item: ChecklistItemUpdate,
    db: Session = Depends(get_db),
):
    return update_checklist_item(db, item_id, item)


@router.delete("/items/{item_id}", response_model=ChecklistItemResponse)
def delete_existing_checklist_item(item_id: int, db: Session = Depends(get_db)):
    return delete_checklist_item(db, item_id)


# --- JobChecklist ---
@router.post("/jobs", response_model=JobChecklistResponse)
def create_new_job_checklist(
    job_checklist: JobChecklistCreate, db: Session = Depends(get_db)
):
    return create_job_checklist(db, job_checklist)


# --- JobChecklistItemStatus ---
@router.post("/jobs/items/status", response_model=JobChecklistItemStatusResponse)
def create_new_job_checklist_item_status(
    status: JobChecklistItemStatusCreate, db: Session = Depends(get_db)
):
    return create_job_checklist_item_status(db, status)


@router.get(
    "/jobs/{job_id}/items/{item_id}/status",
    response_model=JobChecklistItemStatusResponse,
)
def read_job_checklist_item_status(
    job_id: int, item_id: int, db: Session = Depends(get_db)
):
    db_status = get_job_checklist_item_status(db, job_id, item_id)
    if db_status is None:
        raise HTTPException(status_code=404, detail="Status not found")
    return db_status


@router.put(
    "/jobs/{job_id}/items/{item_id}/status",
    response_model=JobChecklistItemStatusResponse,
)
def update_existing_job_checklist_item_status(
    job_id: int,
    item_id: int,
    status: JobChecklistItemStatusUpdate,
    db: Session = Depends(get_db),
):
    return update_job_checklist_item_status(db, job_id, item_id, status)