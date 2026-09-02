from typing import Annotated, List

from fastapi import APIRouter, Depends, File, HTTPException, Path, Response, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.security import get_current_user
from app.model.media_document import MediaDocument
from app.services.checklist_export_service import checklist_export_pdf
from app.services.checklist_template_service import CHECKLIST_WORKBOOK, WORKBOOK_MEDIA_TYPE
from app.services.s3_service import upload_file_to_s3
from app.services.upload_service import read_validated_upload
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
    JobTypeChecklistMapping,
    JobTypeChecklistUpdate,
)
from app.crud.checklist import (
    create_checklist,
    create_checklist_item,
    create_job_checklist,
    create_job_checklist_item_status,
    delete_checklist,
    delete_checklist_item,
    get_assigned_job_checklist,
    get_checklist,
    get_checklist_item,
    get_checklist_items_by_checklist,
    get_checklists,
    get_job_type_checklist_mappings,
    get_ism_job_checklist,
    get_job_checklist_item_status,
    is_ism_checklist,
    update_checklist,
    update_checklist_item,
    update_job_checklist_item_status,
    get_job_checklists_status,
    replace_job_type_checklist_mapping,
)
from app.crud.job import get_job_by_id

router = APIRouter(prefix="/checklists", tags=["Checklists"])


def _require_superadmin(current_user = Depends(get_current_user)):
    if not getattr(current_user, "is_superadmin", False):
        raise HTTPException(status_code=403, detail="Only superadmins can modify global checklist templates")
    return current_user


def _authorize_job(db: Session, job_id: int, current_user):
    user_id = None if getattr(current_user, "is_superadmin", False) else current_user.id
    return get_job_by_id(db, job_id, user_id=user_id)


# --- Checklist ---
@router.post("", response_model=ChecklistResponse)
def create_new_checklist(
    checklist: ChecklistCreate, db: Session = Depends(get_db), current_user = Depends(_require_superadmin)
):
    return create_checklist(db, checklist)


@router.get("", response_model=List[ChecklistWithItemsResponse])
def read_all_checklists(
    skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user = Depends(get_current_user)
):
    return get_checklists(db, skip=skip, limit=limit)


@router.get("/job-types", response_model=List[JobTypeChecklistMapping])
def read_job_type_checklist_mappings(
    db: Session = Depends(get_db), current_user = Depends(get_current_user)
):
    return get_job_type_checklist_mappings(db)


@router.put("/job-types/{job_type}", response_model=JobTypeChecklistMapping)
def update_job_type_checklist_mapping(
    job_type: Annotated[str, Path(min_length=1, max_length=100)],
    payload: JobTypeChecklistUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(_require_superadmin),
):
    return replace_job_type_checklist_mapping(db, job_type, payload.checklist_ids)


@router.get("/jobs/{job_id}/status", response_model=List[ChecklistWithItemsAndStatusResponse])
def read_job_checklists_status(job_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    _authorize_job(db, job_id, current_user)
    return get_job_checklists_status(db, job_id)


@router.get("/jobs/{job_id}/{checklist_id}/template")
def download_job_checklist_template(
    job_id: Annotated[int, Path(gt=0)],
    checklist_id: Annotated[int, Path(gt=0)],
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Download the blank ISM checklist workbook to fill in and upload back."""
    _authorize_job(db, job_id, current_user)
    get_ism_job_checklist(db, job_id, checklist_id)
    return FileResponse(
        CHECKLIST_WORKBOOK,
        filename="All Check-list.xlsx",
        media_type=WORKBOOK_MEDIA_TYPE,
    )


@router.get("/jobs/{job_id}/{checklist_id}/export")
def export_job_checklist(
    job_id: Annotated[int, Path(gt=0)],
    checklist_id: Annotated[int, Path(gt=0)],
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Download the filled-in checklist — items, statuses, notes and evidence — as a PDF."""
    job = _authorize_job(db, job_id, current_user)
    get_assigned_job_checklist(db, job_id, checklist_id)
    checklists = get_job_checklists_status(db, job_id, checklist_id=checklist_id)
    document = checklist_export_pdf(job, checklists[0])
    return Response(
        content=document.content,
        media_type=document.content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{document.filename}"',
            "Content-Encoding": "identity",
        },
    )


@router.post("/jobs/{job_id}/{checklist_id}/document")
async def upload_job_checklist_document(
    job_id: Annotated[int, Path(gt=0)],
    checklist_id: Annotated[int, Path(gt=0)],
    file: Annotated[UploadFile, File()],
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Attach a completed checklist document to the job checklist."""
    _authorize_job(db, job_id, current_user)
    job_checklist = get_assigned_job_checklist(db, job_id, checklist_id)
    upload = await read_validated_upload(
        file,
        allowed_extensions=[".xlsx", ".pdf"] if is_ism_checklist(job_checklist) else None,
    )
    file_url = upload_file_to_s3(
        file_content=upload.content,
        filename=upload.filename,
        content_type=upload.content_type,
    )
    job_checklist.document_link = file_url
    db.add(
        MediaDocument(
            owner_type="job_checklist",
            owner_id=job_checklist.id,
            status="uploaded",
            doc_link=file_url,
        )
    )
    db.commit()
    return {"message": "Checklist document uploaded", "document_link": file_url}


@router.get("/{checklist_id}", response_model=ChecklistWithItemsResponse)
def read_checklist(checklist_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
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
    current_user = Depends(_require_superadmin)
):
    return update_checklist(db, checklist_id, checklist)


@router.delete("/{checklist_id}", response_model=ChecklistResponse)
def delete_existing_checklist(checklist_id: int, db: Session = Depends(get_db), current_user = Depends(_require_superadmin)):
    return delete_checklist(db, checklist_id)


# --- ChecklistItem ---
@router.post("/items", response_model=ChecklistItemResponse)
def create_new_checklist_item(
    item: ChecklistItemCreate, db: Session = Depends(get_db), current_user = Depends(_require_superadmin)
):
    return create_checklist_item(db, item)


@router.get("/items/{item_id}", response_model=ChecklistItemResponse)
def read_checklist_item(item_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    db_item = get_checklist_item(db, item_id)
    if db_item is None:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    return db_item


@router.put("/items/{item_id}", response_model=ChecklistItemResponse)
def update_existing_checklist_item(
    item_id: int,
    item: ChecklistItemUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(_require_superadmin)
):
    return update_checklist_item(db, item_id, item)


@router.delete("/items/{item_id}", response_model=ChecklistItemResponse)
def delete_existing_checklist_item(item_id: int, db: Session = Depends(get_db), current_user = Depends(_require_superadmin)):
    return delete_checklist_item(db, item_id)


# --- JobChecklist ---
@router.post("/jobs", response_model=JobChecklistResponse)
def create_new_job_checklist(
    job_checklist: JobChecklistCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)
):
    _authorize_job(db, job_checklist.job_id, current_user)
    return create_job_checklist(db, job_checklist)


# --- JobChecklistItemStatus ---
@router.post("/jobs/items/status", response_model=JobChecklistItemStatusResponse)
def create_new_job_checklist_item_status(
    status: JobChecklistItemStatusCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)
):
    _authorize_job(db, status.job_id, current_user)
    return create_job_checklist_item_status(db, status)


@router.get(
    "/jobs/{job_id}/items/{item_id}/status",
    response_model=JobChecklistItemStatusResponse,
)
def read_job_checklist_item_status(
    job_id: int, item_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)
):
    _authorize_job(db, job_id, current_user)
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
    current_user = Depends(get_current_user)
):
    _authorize_job(db, job_id, current_user)
    return update_job_checklist_item_status(db, job_id, item_id, status)
