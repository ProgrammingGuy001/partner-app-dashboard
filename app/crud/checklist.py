from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.model.job import (
    Job,
    Checklist,
    ChecklistItem,
    JobChecklist,
    JobChecklistItemStatus,
)
from app.schemas.checklist import (
    ChecklistCreate,
    ChecklistUpdate,
    ChecklistItemCreate,
    ChecklistItemUpdate,
    JobChecklistCreate,
    JobChecklistItemStatusCreate,
    JobChecklistItemStatusUpdate,
)


# --- Checklist ---
def get_checklist(db: Session, checklist_id: int):
    return db.query(Checklist).filter(Checklist.id == checklist_id).first()


def get_checklists(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Checklist).offset(skip).limit(limit).all()


def create_checklist(db: Session, checklist: ChecklistCreate):
    db_checklist = Checklist(**checklist.model_dump())
    db.add(db_checklist)
    db.commit()
    db.refresh(db_checklist)
    return db_checklist


def update_checklist(db: Session, checklist_id: int, checklist: ChecklistUpdate):
    db_checklist = get_checklist(db, checklist_id)
    if db_checklist:
        update_data = checklist.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_checklist, key, value)
        db.commit()
        db.refresh(db_checklist)
    return db_checklist


def delete_checklist(db: Session, checklist_id: int):
    db_checklist = get_checklist(db, checklist_id)
    if db_checklist:
        db.delete(db_checklist)
        db.commit()
    return db_checklist


# --- ChecklistItem ---
def get_checklist_item(db: Session, checklist_item_id: int):
    return db.query(ChecklistItem).filter(ChecklistItem.id == checklist_item_id).first()


def get_checklist_items_by_checklist(db: Session, checklist_id: int):
    return (
        db.query(ChecklistItem).filter(ChecklistItem.checklist_id == checklist_id).all()
    )


def create_checklist_item(db: Session, item: ChecklistItemCreate):
    db_item = ChecklistItem(**item.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


def update_checklist_item(db: Session, checklist_item_id: int, item: ChecklistItemUpdate):
    db_item = get_checklist_item(db, checklist_item_id)
    if db_item:
        update_data = item.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_item, key, value)
        db.commit()
        db.refresh(db_item)
    return db_item


def delete_checklist_item(db: Session, checklist_item_id: int):
    db_item = get_checklist_item(db, checklist_item_id)
    if db_item:
        db.delete(db_item)
        db.commit()
    return db_item


# --- JobChecklist ---
def create_job_checklist(db: Session, job_checklist: JobChecklistCreate):
    db_job_checklist = JobChecklist(**job_checklist.model_dump())
    db.add(db_job_checklist)
    db.commit()
    db.refresh(db_job_checklist)
    return db_job_checklist


# --- JobChecklistItemStatus ---
def get_job_checklist_item_status(
    db: Session, job_id: int, checklist_item_id: int
):
    return (
        db.query(JobChecklistItemStatus)
        .filter(
            JobChecklistItemStatus.job_id == job_id,
            JobChecklistItemStatus.checklist_item_id == checklist_item_id,
        )
        .first()
    )


def create_job_checklist_item_status(
    db: Session, status: JobChecklistItemStatusCreate
):
    # Verify Job existence
    job = db.query(Job).filter(Job.id == status.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {status.job_id} not found")

    db_status = JobChecklistItemStatus(**status.model_dump())
    db.add(db_status)
    db.commit()
    db.refresh(db_status)
    return db_status


def update_job_checklist_item_status(
    db: Session,
    job_id: int,
    checklist_item_id: int,
    status: JobChecklistItemStatusUpdate,
):
    db_status = get_job_checklist_item_status(db, job_id, checklist_item_id)
    
    if not db_status:
        # Create new if not exists (Upsert)
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
            
        create_data = status.model_dump(exclude_unset=True)
        create_data['job_id'] = job_id
        create_data['checklist_item_id'] = checklist_item_id
        
        db_status = JobChecklistItemStatus(**create_data)
        db.add(db_status)
        db.commit()
        db.refresh(db_status)
        return db_status

    update_data = status.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_status, key, value)
    db.commit()
    db.refresh(db_status)
    return db_status


def get_job_checklists_status(db: Session, job_id: int):
    # 1. Get all checklists assigned to the job
    job_checklists = db.query(JobChecklist).filter(JobChecklist.job_id == job_id).all()
    if not job_checklists:
        return []

    result = []
    for jc in job_checklists:
        checklist = jc.checklist
        
        # 2. Get all items for the checklist
        items = db.query(ChecklistItem).filter(ChecklistItem.checklist_id == checklist.id).order_by(ChecklistItem.position).all()
        
        items_with_status = []
        for item in items:
            # 3. Get status for each item for this job
            status = db.query(JobChecklistItemStatus).filter(
                JobChecklistItemStatus.job_id == job_id,
                JobChecklistItemStatus.checklist_item_id == item.id
            ).first()
            
            # Create schema-compatible dict
            item_dict = item.__dict__.copy()
            item_dict['status'] = status
            items_with_status.append(item_dict)

        # Create schema-compatible dict for checklist
        checklist_dict = checklist.__dict__.copy()
        checklist_dict['items'] = items_with_status
        result.append(checklist_dict)
    
    return result