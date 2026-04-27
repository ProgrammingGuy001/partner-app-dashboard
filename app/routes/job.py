from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, UploadFile, File, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from pydantic import BaseModel, Field
from app.database import get_db
from app.schemas.job import (
    JobStart, JobPause, JobFinish, JobCreate, JobUpdate, JobResponse,
    JobStartWithOTP, JobFinishWithOTP, OTPResponse, CustomerOptionResponse
)
from app.schemas.job_status_log import JobStatusLogResponse
from app.schemas.checklist import JobChecklistItemStatusUpdate, JobChecklistItemStatusResponse
from app.crud.job import (
    get_job_by_id, get_all_jobs, create_job, update_job, delete_job,
    start_job, pause_job, finish_job, get_job_status_history,
    approve_job_creation, reject_job_creation,
)
from app.crud.checklist import update_job_checklist_item_status
from app.core.security import get_current_user
from app.services.polling_service import trigger_polling_on_crud
from app.services.customer_otp_service import CustomerOTPService
from app.services.s3_service import upload_file_to_s3
from app.services.upload_service import read_validated_upload
from app.services.billing_service import BillingService
from app.services.invoice_request_service import (
    create_invoice_request as create_invoice_request_record,
    get_invoice_requests,
    get_latest_invoice_request,
    get_pending_invoice_request,
    serialize_invoice_request,
)
import app.model as models
from app.model.media_document import MediaDocument

router = APIRouter(prefix="/jobs", tags=["Jobs"])


def _scoped_admin_id(current_user: models.User) -> int | None:
    return None if getattr(current_user, "is_superadmin", False) else current_user.id

@router.get("/lookup-so/{so_number}", response_model=dict)
def lookup_sales_order(so_number: str, current_user: models.User = Depends(get_current_user)):
    """Fetch customer and project details from Odoo by Sales Order number.
    Used to auto-populate job creation forms."""
    from app.services.odoo_service import OdooService
    return OdooService.get_sales_order_details(so_number)

@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
def create_new_job(job: JobCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Create a job. Regular admins submit it for superadmin approval before it becomes active."""
    is_superadmin = getattr(current_user, 'is_superadmin', False)
    result = create_job(db, job, user_id=current_user.id, is_superadmin=is_superadmin)
    background_tasks.add_task(trigger_polling_on_crud)
    return result

@router.get("", response_model=List[JobResponse])
def read_jobs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    status: Optional[str] = None,
    job_type: Optional[str] = Query(None, alias="type"),
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Get all jobs with pagination. Superadmins see all jobs, regular admins see only their jobs."""
    is_superadmin = getattr(current_user, 'is_superadmin', False)
    user_id = None if is_superadmin else current_user.id
    return get_all_jobs(
        db,
        skip=skip,
        limit=limit,
        status=status,
        job_type=job_type,
        search=search,
        user_id=user_id,
    )

@router.get("/customers", response_model=List[CustomerOptionResponse])
def get_customers(
    search: Optional[str] = Query(None, description="Search by customer name, phone or city"),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Get customers for job creation dropdown."""
    query = db.query(models.Customer)
    if search:
        q = f"%{search.strip()}%"
        query = query.filter(
            or_(
                models.Customer.name.ilike(q),
                models.Customer.phone_number.ilike(q),
                models.Customer.city.ilike(q),
            )
        )
    return query.order_by(models.Customer.created_at.desc(), models.Customer.id.desc()).limit(limit).all()


@router.get("/pending-approval", response_model=List[JobResponse])
def list_pending_approval_jobs(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """List all jobs pending superadmin approval."""
    if not getattr(current_user, "is_superadmin", False):
        raise HTTPException(status_code=403, detail="Only superadmins can view pending approval jobs")
    from sqlalchemy import select as sa_select
    from app.model.job import Job
    from app.crud.job import JOB_LOAD_OPTIONS
    stmt = (
        sa_select(Job)
        .options(*JOB_LOAD_OPTIONS)
        .where(Job.status == "pending_approval")
        .order_by(Job.created_at.desc())
    )
    return db.scalars(stmt).unique().all()


@router.post("/{job_id}/approve-creation", response_model=JobResponse)
def approve_job_creation_route(
    job_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Superadmin approves a pending job, making it active."""
    if not getattr(current_user, "is_superadmin", False):
        raise HTTPException(status_code=403, detail="Only superadmins can approve job creation")
    result = approve_job_creation(db, job_id)
    background_tasks.add_task(trigger_polling_on_crud)
    return result


@router.post("/{job_id}/reject-creation", response_model=JobResponse)
def reject_job_creation_route(
    job_id: int,
    background_tasks: BackgroundTasks,
    reason: str = "",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Superadmin rejects a pending job with an optional reason."""
    if not getattr(current_user, "is_superadmin", False):
        raise HTTPException(status_code=403, detail="Only superadmins can reject job creation")
    result = reject_job_creation(db, job_id, reason)
    background_tasks.add_task(trigger_polling_on_crud)
    return result


@router.get("/{job_id}", response_model=JobResponse)
def read_job(job_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Get a specific job by ID."""
    return get_job_by_id(db, job_id, user_id=_scoped_admin_id(current_user))

@router.put("/{job_id}", response_model=JobResponse)
def update_existing_job(job_id: int, job_update: JobUpdate, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Update a job. Handles IP reassignment and validates is_assigned=False for new IPs."""
    get_job_by_id(db, job_id, user_id=_scoped_admin_id(current_user))
    is_superadmin = getattr(current_user, 'is_superadmin', False)
    result = update_job(db, job_id, job_update, admin_id=current_user.id, is_superadmin=is_superadmin)
    background_tasks.add_task(trigger_polling_on_crud)
    return result

@router.delete("/{job_id}", status_code=status.HTTP_200_OK)
def delete_existing_job(job_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Delete a job and unassign its IP."""
    get_job_by_id(db, job_id, user_id=_scoped_admin_id(current_user))
    is_superadmin = getattr(current_user, 'is_superadmin', False)
    result = delete_job(db, job_id, admin_id=current_user.id, is_superadmin=is_superadmin)
    background_tasks.add_task(trigger_polling_on_crud)
    return result

# ============ OTP Flow Endpoints ============

@router.post("/{job_id}/request-start-otp", response_model=OTPResponse)
def request_start_otp(
    job_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Send OTP to customer phone for job start verification"""
    job = get_job_by_id(db, job_id, user_id=_scoped_admin_id(current_user))
    if not job.customer_phone:
        raise HTTPException(status_code=400, detail="Customer phone not set for this job")

    otp = CustomerOTPService.create_start_otp(db, job_id)
    background_tasks.add_task(
        CustomerOTPService.send_customer_sms,
        job.customer_phone,
        job.customer_name or "Customer",
        otp,
        "start",
    )
    return OTPResponse(success=True, message="OTP generated and SMS queued")

@router.post("/{job_id}/verify-start-otp", response_model=JobResponse)
def verify_start_otp_and_start(job_id: int, otp_data: JobStartWithOTP, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Verify start OTP and start the job"""
    job = get_job_by_id(db, job_id, user_id=_scoped_admin_id(current_user))

    # Skip OTP verification if no customer phone set (backward compatibility)
    if job.customer_phone:
        if not CustomerOTPService.verify_start_otp(db, job_id, otp_data.otp):
            raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    is_superadmin = getattr(current_user, 'is_superadmin', False)
    return start_job(db, job_id, admin_id=current_user.id, is_superadmin=is_superadmin, notes=otp_data.notes)

@router.post("/{job_id}/request-end-otp", response_model=OTPResponse)
def request_end_otp(
    job_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Send OTP to customer phone for job completion verification"""
    job = get_job_by_id(db, job_id, user_id=_scoped_admin_id(current_user))
    if not job.customer_phone:
        raise HTTPException(status_code=400, detail="Customer phone not set for this job")

    otp = CustomerOTPService.create_end_otp(db, job_id)
    background_tasks.add_task(
        CustomerOTPService.send_customer_sms,
        job.customer_phone,
        job.customer_name or "Customer",
        otp,
        "complete",
    )
    return OTPResponse(success=True, message="OTP generated and SMS queued")

@router.post("/{job_id}/verify-end-otp", response_model=JobResponse)
def verify_end_otp_and_finish(job_id: int, otp_data: JobFinishWithOTP, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Verify end OTP and complete the job"""
    job = get_job_by_id(db, job_id, user_id=_scoped_admin_id(current_user))

    # Skip OTP verification if no customer phone set (backward compatibility)
    if job.customer_phone:
        if not CustomerOTPService.verify_end_otp(db, job_id, otp_data.otp):
            raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    is_superadmin = getattr(current_user, 'is_superadmin', False)
    return finish_job(db, job_id, admin_id=current_user.id, is_superadmin=is_superadmin, notes=otp_data.notes)

# ============ Legacy Endpoints (without OTP) ============

@router.post("/{job_id}/start", response_model=JobResponse)
def start_existing_job(job_id: int, job_start: JobStart = JobStart(), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Start or resume a job (legacy - no OTP). Use verify-start-otp for OTP flow."""
    job = get_job_by_id(db, job_id, user_id=_scoped_admin_id(current_user))
    # If customer phone is set, require OTP flow
    if job.customer_phone:
        raise HTTPException(
            status_code=400,
            detail="This job requires OTP verification. Use /request-start-otp then /verify-start-otp"
        )
    is_superadmin = getattr(current_user, 'is_superadmin', False)
    return start_job(db, job_id, admin_id=current_user.id, is_superadmin=is_superadmin, notes=job_start.notes)

@router.post("/{job_id}/pause", response_model=JobResponse)
def pause_existing_job(job_id: int, job_pause: JobPause = JobPause(), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Pause a job. Changes status to 'paused' and tracks paused_date. Logs the action with optional notes."""
    get_job_by_id(db, job_id, user_id=_scoped_admin_id(current_user))
    is_superadmin = getattr(current_user, 'is_superadmin', False)
    return pause_job(db, job_id, admin_id=current_user.id, is_superadmin=is_superadmin, notes=job_pause.notes)

@router.post("/{job_id}/finish", response_model=JobResponse)
def finish_existing_job(job_id: int, job_finish: JobFinish = JobFinish(), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Finish a job (legacy - no OTP). Use verify-end-otp for OTP flow."""
    job = get_job_by_id(db, job_id, user_id=_scoped_admin_id(current_user))
    # If customer phone is set, require OTP flow
    if job.customer_phone:
        raise HTTPException(
            status_code=400,
            detail="This job requires OTP verification. Use /request-end-otp then /verify-end-otp"
        )
    is_superadmin = getattr(current_user, 'is_superadmin', False)
    return finish_job(db, job_id, admin_id=current_user.id, is_superadmin=is_superadmin, notes=job_finish.notes)

@router.get("/{job_id}/history", response_model=List[JobStatusLogResponse])
def get_job_history(job_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Get complete status change history for a job, including all pauses and resumes."""
    get_job_by_id(db, job_id, user_id=_scoped_admin_id(current_user))
    return get_job_status_history(db, job_id, verify_exists=False)

@router.put("/{job_id}/checklists/items/{item_id}/approve", response_model=JobChecklistItemStatusResponse)
def approve_checklist_item(
    job_id: int,
    item_id: int,
    status_update: JobChecklistItemStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Admin endpoint to approve/reject checklist items and add admin comments"""
    # Verify job exists before updating checklist item
    get_job_by_id(db, job_id, user_id=_scoped_admin_id(current_user))

    # Admin can update is_approved and admin_comment
    return update_job_checklist_item_status(db, job_id, item_id, status_update)


def _get_invoice_request(db: Session, job_id: int):
    return get_latest_invoice_request(db, job_id)


def _serialize_invoice_request(req) -> dict | None:
    return serialize_invoice_request(req)


class CreateInvoiceRequestRequest(BaseModel):
    completion_percentage: int | None = Field(default=None, ge=0, le=100)
    notes: str | None = None


@router.get("/{job_id}/billing", response_model=dict)
def get_job_billing(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Get billing data for a job. Only available for external IP jobs."""
    job = get_job_by_id(db, job_id, user_id=_scoped_admin_id(current_user))

    if not job.assigned_ip or job.assigned_ip.is_internal:
        raise HTTPException(status_code=400, detail="Billing only available for external IP jobs")

    ip_user = job.assigned_ip
    financial = ip_user.financial
    invoice_req = _get_invoice_request(db, job_id)

    return {
        "job_id": job.id,
        "job_name": job.name,
        "job_type": job.type,
        "rate": str(job.rate) if job.rate else None,
        "size": job.size,
        "state": job.state,
        "invoice_request": _serialize_invoice_request(invoice_req),
        "invoice_requests": [
            _serialize_invoice_request(req)
            for req in get_invoice_requests(db, job_id)
        ],
        "ip": {
            "name": f"{ip_user.first_name or ''} {ip_user.last_name or ''}".strip(),
            "phone": ip_user.phone_number,
            "city": ip_user.city,
            "pan_number": financial.pan_number if financial else None,
            "account_number": financial.account_number if financial else None,
            "ifsc_code": financial.ifsc_code if financial else None,
            "account_holder_name": financial.account_holder_name if financial else None,
        },
    }


@router.post("/{job_id}/invoice-request", response_model=dict)
def create_invoice_request(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Create an invoice request for a job. Only for external IP jobs."""
    job = get_job_by_id(db, job_id, user_id=_scoped_admin_id(current_user))

    if not job.assigned_ip or job.assigned_ip.is_internal:
        raise HTTPException(status_code=400, detail="Invoice requests only for external IP jobs")

    req = create_invoice_request_record(
        db,
        job_id=job_id,
        requested_by_id=current_user.id,
    )

    return {
        "message": "Invoice request created successfully",
        "invoice_request": _serialize_invoice_request(req),
    }


@router.post("/{job_id}/invoice-requests", response_model=dict)
def create_additional_invoice_request(
    job_id: int,
    body: CreateInvoiceRequestRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Create another invoice request for completion-based or phase-based billing."""
    job = get_job_by_id(db, job_id, user_id=_scoped_admin_id(current_user))

    if not job.assigned_ip or job.assigned_ip.is_internal:
        raise HTTPException(status_code=400, detail="Invoice requests only for external IP jobs")

    req = create_invoice_request_record(
        db,
        job_id=job_id,
        requested_by_id=current_user.id,
        completion_percentage=body.completion_percentage,
        notes=body.notes,
    )

    return {
        "message": "Additional invoice request created successfully",
        "invoice_request": _serialize_invoice_request(req),
    }


@router.put("/{job_id}/invoice-request/approve", response_model=dict)
def approve_invoice_request(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Approve the pending invoice request for a job."""
    from datetime import datetime as dt
    get_job_by_id(db, job_id)  # existence check without scope — any admin can approve

    req = get_pending_invoice_request(db, job_id)
    if not req or req.status != "pending":
        raise HTTPException(status_code=404, detail="No pending invoice request found for this job")

    req.status = "approved"
    req.approved_at = dt.utcnow()
    req.approved_by_id = current_user.id
    req.rejection_reason = None
    db.commit()
    db.refresh(req)

    return {
        "message": "Invoice request approved",
        "invoice_request": _serialize_invoice_request(req),
    }


@router.put("/{job_id}/invoice-request/reject", response_model=dict)
def reject_invoice_request(
    job_id: int,
    reason: str = "",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Reject the pending invoice request for a job."""
    get_job_by_id(db, job_id)

    req = get_pending_invoice_request(db, job_id)
    if not req or req.status != "pending":
        raise HTTPException(status_code=404, detail="No pending invoice request found for this job")

    req.status = "rejected"
    req.rejection_reason = reason or None
    db.commit()
    db.refresh(req)

    return {
        "message": "Invoice request rejected",
        "invoice_request": _serialize_invoice_request(req),
    }


@router.get("/{job_id}/invoice-request/download")
def download_invoice_bill(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Download approved invoice bill using the project billing template."""
    xlsx_bytes = BillingService.generate_invoice_xlsx(
        db,
        job_id,
        admin_id=current_user.id,
        is_superadmin=getattr(current_user, "is_superadmin", False),
    )
    filename = f"billing_invoice_{job_id}.xlsx"
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/invoice-requests/pending", response_model=dict)
def list_pending_invoice_requests(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """List all pending invoice requests visible to the current admin."""
    from app.model.invoice_request import InvoiceRequest

    is_superadmin = getattr(current_user, "is_superadmin", False)

    if is_superadmin:
        reqs = db.query(InvoiceRequest).filter(InvoiceRequest.status == "pending").all()
    else:
        # Admins see pending requests for jobs they own
        reqs = (
            db.query(InvoiceRequest)
            .join(models.Job, InvoiceRequest.job_id == models.Job.id)
            .filter(
                InvoiceRequest.status == "pending",
                models.Job.admin_assigned == current_user.id,
            )
            .all()
        )

    items = []
    for req in reqs:
        job = db.get(models.Job, req.job_id)
        items.append({
            **_serialize_invoice_request(req),
            "job_name": job.name if job else None,
            "job_id": req.job_id,
        })

    return {"pending_count": len(items), "requests": items}


@router.post("/upload-file", response_model=dict)
async def upload_job_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Upload a file (e.g. Final Drawing) and return the S3 URL"""
    upload = await read_validated_upload(file)

    # Upload
    file_url = upload_file_to_s3(
        file_content=upload.content,
        filename=upload.filename,
        content_type=upload.content_type,
    )

    db.add(
        MediaDocument(
            owner_type="admin",
            owner_id=current_user.id,
            status="uploaded",
            doc_link=file_url,
            uploaded_by_admin_id=current_user.id,
        )
    )
    db.commit()

    return {"url": file_url}
