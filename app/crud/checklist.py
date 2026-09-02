from sqlalchemy.orm import Session, joinedload, selectinload
from fastapi import HTTPException
from app.model.job import (
    Job,
    Checklist,
    ChecklistItem,
    JobTypeChecklist,
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
from app.utils.job_documents import normalize_job_type


ISM_CHECKLIST_NAME = "ISM Checklist"


def checklist_items_pending(db: Session, job_ids) -> dict[int, int]:
    """Assigned checklist items not yet approved, per job.

    Checkout is never blocked on this — the report is its own document — but an
    incomplete checklist is worth saying out loud to the IP and the supervisor.
    """
    job_ids = [job_id for job_id in set(job_ids or []) if job_id]
    if not job_ids:
        return {}
    approved = (
        db.query(JobChecklistItemStatus.job_id, JobChecklistItemStatus.checklist_item_id)
        .filter(
            JobChecklistItemStatus.job_id.in_(job_ids),
            JobChecklistItemStatus.review_status == "approved",
        )
        .all()
    )
    approved_keys = set(approved)
    pending: dict[int, int] = {job_id: 0 for job_id in job_ids}
    assigned = (
        db.query(JobChecklist.job_id, ChecklistItem.id)
        .join(ChecklistItem, ChecklistItem.checklist_id == JobChecklist.checklist_id)
        .filter(JobChecklist.job_id.in_(job_ids))
        .all()
    )
    for job_id, item_id in assigned:
        if (job_id, item_id) not in approved_keys:
            pending[job_id] += 1
    return pending


def get_assigned_job_checklist(db: Session, job_id: int, checklist_id: int) -> JobChecklist:
    job_checklist = (
        db.query(JobChecklist)
        .filter(
            JobChecklist.job_id == job_id,
            JobChecklist.checklist_id == checklist_id,
        )
        .first()
    )
    if not job_checklist:
        raise HTTPException(status_code=404, detail="Checklist not found for this job")
    return job_checklist


def is_ism_checklist(job_checklist: JobChecklist) -> bool:
    return job_checklist.checklist.name.casefold() == ISM_CHECKLIST_NAME.casefold()


def get_ism_job_checklist(db: Session, job_id: int, checklist_id: int) -> JobChecklist:
    """The job's ISM checklist — the only one with a printable PDF template."""
    job_checklist = get_assigned_job_checklist(db, job_id, checklist_id)
    if not is_ism_checklist(job_checklist):
        raise HTTPException(status_code=404, detail="This checklist has no printable template")
    return job_checklist


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
    # selectinload, not joinedload: a collection joinedload makes offset/limit count
    # joined rows and silently truncate checklists.
    return (
        db.query(Checklist)
        .options(selectinload(Checklist.checklist_items))
        .order_by(Checklist.id)
        .offset(skip)
        .limit(limit)
        .all()
    )


def validate_checklist_ids(db: Session, checklist_ids: list[int] | None) -> list[int]:
    unique_ids = list(dict.fromkeys(checklist_ids or []))
    if not unique_ids:
        raise HTTPException(status_code=400, detail="Select at least one checklist")
    found = {row.id for row in db.query(Checklist.id).filter(Checklist.id.in_(unique_ids))}
    missing = [checklist_id for checklist_id in unique_ids if checklist_id not in found]
    if missing:
        raise HTTPException(status_code=404, detail=f"Checklist IDs not found: {missing}")
    return unique_ids


def get_job_type_checklist_ids(db: Session, job_type: str | None) -> list[int]:
    normalized = normalize_job_type(job_type)
    if not normalized:
        return []
    return [
        row.checklist_id
        for row in db.query(JobTypeChecklist)
        .filter(JobTypeChecklist.job_type == normalized)
        .order_by(JobTypeChecklist.checklist_id)
    ]


def get_job_type_checklist_mappings(db: Session) -> list[dict]:
    mappings: dict[str, list[int]] = {}
    for row in db.query(JobTypeChecklist).order_by(
        JobTypeChecklist.job_type, JobTypeChecklist.checklist_id
    ):
        mappings.setdefault(row.job_type, []).append(row.checklist_id)
    return [
        {"job_type": job_type, "checklist_ids": checklist_ids}
        for job_type, checklist_ids in mappings.items()
    ]


def sync_job_checklists(db: Session, job: Job, checklist_ids: list[int]) -> None:
    current = {
        row.checklist_id: row
        for row in db.query(JobChecklist).filter(JobChecklist.job_id == job.id)
    }
    desired = set(checklist_ids)

    for checklist_id in current.keys() - desired:
        row = current[checklist_id]
        has_status = (
            db.query(JobChecklistItemStatus.id)
            .join(ChecklistItem, ChecklistItem.id == JobChecklistItemStatus.checklist_item_id)
            .filter(
                JobChecklistItemStatus.job_id == job.id,
                ChecklistItem.checklist_id == checklist_id,
            )
            .first()
            is not None
        )
        if row.document_link or has_status:
            raise HTTPException(
                status_code=409,
                detail=f"Job #{job.id} has checklist evidence; it cannot be removed from this job type",
            )
        db.delete(row)

    for checklist_id in desired - current.keys():
        db.add(JobChecklist(job_id=job.id, checklist_id=checklist_id))


def replace_job_type_checklist_mapping(
    db: Session, job_type: str, checklist_ids: list[int]
) -> dict:
    normalized = normalize_job_type(job_type)
    if not normalized:
        raise HTTPException(status_code=400, detail="Job type is required")
    checklist_ids = validate_checklist_ids(db, checklist_ids)
    jobs = [
        job
        for job in db.query(Job).all()
        if normalize_job_type(job.job_type) == normalized
    ]

    for job in jobs:
        sync_job_checklists(db, job, checklist_ids)

    db.query(JobTypeChecklist).filter(JobTypeChecklist.job_type == normalized).delete()
    db.add_all(
        JobTypeChecklist(job_type=normalized, checklist_id=checklist_id)
        for checklist_id in checklist_ids
    )
    db.commit()
    return {
        "job_type": normalized,
        "checklist_ids": checklist_ids,
        "updated_jobs": len(jobs),
    }


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

    create_data = status.model_dump()
    if create_data["review_status"] == "approved":
        create_data["is_approved"] = True
    db_status = JobChecklistItemStatus(**create_data)
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
        if create_data.get('review_status') == 'approved' or create_data.get('is_approved') is True:
            create_data['review_status'] = 'approved'
            create_data['is_approved'] = True
        elif create_data.get('review_status') == 'rejected':
            create_data['is_approved'] = False
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
    if update_data.get('review_status') == 'approved' or update_data.get('is_approved') is True:
        update_data['review_status'] = 'approved'
        update_data['is_approved'] = True
    elif update_data.get('review_status') in {'pending', 'rejected'}:
        update_data['is_approved'] = False
    elif update_data.get('is_approved') is False and 'admin_comment' in update_data:
        update_data['review_status'] = 'rejected' if update_data.get('admin_comment') else 'pending'

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


def get_job_checklists_status(db: Session, job_id: int, checklist_id: int | None = None):
    # Single query: load JobChecklist → Checklist → ChecklistItems in one shot
    query = (
        db.query(JobChecklist)
        .filter(JobChecklist.job_id == job_id)
        .options(
            joinedload(JobChecklist.checklist).joinedload(Checklist.checklist_items)
        )
    )
    if checklist_id is not None:
        query = query.filter(JobChecklist.checklist_id == checklist_id)
    job_checklists = query.all()
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
        checklist_dict["document_link"] = jc.document_link
        checklist_dict["template_available"] = is_ism_checklist(jc)
        checklist_dict["items"] = items_with_status
        result.append(checklist_dict)

    return result
