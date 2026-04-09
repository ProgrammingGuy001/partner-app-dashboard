from sqlalchemy.orm import Session, joinedload
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


def _ensure_job_checklist_item_link(db: Session, job_id: int, checklist_item_id: int) -> ChecklistItem:
    item = get_checklist_item(db, checklist_item_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Checklist item {checklist_item_id} not found")

    job_checklist = (
        db.query(JobChecklist)
        .filter(
            JobChecklist.job_id == job_id,
            JobChecklist.checklist_id == item.checklist_id,
        )
        .first()
    )
    if not job_checklist:
        raise HTTPException(
            status_code=400,
            detail="Checklist item is not assigned to this job",
        )
    return item


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
    _ensure_job_checklist_item_link(db, status.job_id, status.checklist_item_id)

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
    _ensure_job_checklist_item_link(db, job_id, checklist_item_id)

    if not db_status:
        # Create new if not exists (Upsert)
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

        create_data = status.model_dump(exclude_unset=True)
        create_data['job_id'] = job_id
        create_data['checklist_item_id'] = checklist_item_id
        
        # Validate checked=True requirements for new records
        if create_data.get('checked') is True:
            if not create_data.get('document_link'):
                raise HTTPException(
                    status_code=422,
                    detail='A photo/document must be uploaded before marking the item as complete.'
                )
            if not create_data.get('comment') or not create_data['comment'].strip():
                raise HTTPException(
                    status_code=422,
                    detail='Notes/comment must be added before marking the item as complete.'
                )

        db_status = JobChecklistItemStatus(**create_data)
        db.add(db_status)
        db.commit()
        db.refresh(db_status)
        return db_status

    update_data = status.model_dump(exclude_unset=True)
    
    # Validate checked=True requirements for existing records
    if update_data.get('checked') is True:
        # Get the final state after applying the update
        final_document_link = update_data.get('document_link', db_status.document_link)
        final_comment = update_data.get('comment', db_status.comment)
        
        if not final_document_link:
            raise HTTPException(
                status_code=422,
                detail='A photo/document must be uploaded before marking the item as complete.'
            )
        if not final_comment or not final_comment.strip():
            raise HTTPException(
                status_code=422,
                detail='Notes/comment must be added before marking the item as complete.'
            )
    
    for key, value in update_data.items():
        setattr(db_status, key, value)
    db.commit()
    db.refresh(db_status)
    return db_status


def get_job_checklists_status(db: Session, job_id: int):
    # Single query: load JobChecklist → Checklist → ChecklistItems in one shot
    job_checklists = (
        db.query(JobChecklist)
        .filter(JobChecklist.job_id == job_id)
        .options(
            joinedload(JobChecklist.checklist).joinedload(Checklist.checklist_items)
        )
        .all()
    )
    if not job_checklists:
        return []

    # Collect all checklist item IDs across every checklist for this job
    all_item_ids = [
        item.id
        for jc in job_checklists
        for item in jc.checklist.checklist_items
    ]

    # Single query: fetch every status row for this job + those items
    statuses = (
        db.query(JobChecklistItemStatus)
        .filter(
            JobChecklistItemStatus.job_id == job_id,
            JobChecklistItemStatus.checklist_item_id.in_(all_item_ids),
        )
        .all()
    )
    # Build an O(1) lookup: item_id → status row
    status_by_item: dict[int, JobChecklistItemStatus] = {
        s.checklist_item_id: s for s in statuses
    }

    result = []
    for jc in job_checklists:
        checklist = jc.checklist
        items_with_status = []
        for item in sorted(checklist.checklist_items, key=lambda i: i.position):
            item_dict = item.__dict__.copy()
            item_dict["status"] = status_by_item.get(item.id)
            items_with_status.append(item_dict)

        checklist_dict = checklist.__dict__.copy()
        checklist_dict["items"] = items_with_status
        result.append(checklist_dict)

    return result
