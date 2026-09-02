from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    BackgroundTasks,
    UploadFile,
    File,
    Form,
    Path,
    Query,
    Response,
)
from botocore.exceptions import BotoCoreError, ClientError
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import or_
from typing import Annotated, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from app.database import get_db
from app.config import settings
from app.schemas.job import (
    JobStart,
    JobPause,
    JobFinish,
    JobCreate,
    JobUpdate,
    JobResponse,
    JobStartWithOTP,
    JobFinishWithOTP,
    JobApprovalRequestCreate,
    JobApprovalRequestResponse,
    OTPResponse,
    CustomerOptionResponse,
    MonthlyDocumentRequest,
    ProjectDocumentRequest,
    MapUrlResolveRequest,
    MapUrlResolveResponse,
)
from app.schemas.job_status_log import JobStatusLogResponse
from app.schemas.checklist import (
    JobChecklistItemStatusUpdate,
    JobChecklistItemStatusResponse,
)
from app.crud.job import (
    get_job_by_id,
    get_all_jobs,
    create_job,
    update_job,
    delete_job,
    start_job,
    pause_job,
    finish_job,
    get_job_status_history,
    validate_job_start,
    validate_job_completion,
    approve_job_creation,
    reject_job_creation,
)
from app.crud.checklist import update_job_checklist_item_status
from app.core.security import get_current_user
from app.utils.job_documents import (
    INSTALLATION_CLOSURE_DOCUMENTS,
    SITE_REPORT_SLOTS,
)
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
from app.services.document_automation_service import (
    generate_monthly_document,
    generate_ncr_document,
)
import app.model as models
from app.model.job_approval_request import JobApprovalRequest
from app.model.media_document import MediaDocument

# Every slot an admin may upload a completion document into.
COMPLETION_DOCUMENT_SLOTS = frozenset(
    (*INSTALLATION_CLOSURE_DOCUMENTS, *SITE_REPORT_SLOTS.values())
)

router = APIRouter(prefix="/jobs", tags=["Jobs"])


def _scoped_admin_id(current_user: models.User) -> int | None:
    return None if getattr(current_user, "is_superadmin", False) else current_user.id


def _attach_generated_completion_document(
    job,
    document_type: str,
    document,
    db: Session,
    current_user: models.User,
):
    try:
        file_url = upload_file_to_s3(
            file_content=document.content,
            filename=document.filename,
            content_type=document.content_type,
        )
    except (BotoCoreError, ClientError):
        return Response(
            content=document.content,
            media_type=document.content_type,
            headers={
                "Content-Disposition": f'attachment; filename="{document.filename}"',
                "Content-Encoding": "identity",
            },
        )
    existing = (
        db.query(MediaDocument)
        .filter(
            MediaDocument.owner_type == "job_completion",
            MediaDocument.owner_id == job.id,
            MediaDocument.status == document_type,
        )
        .order_by(MediaDocument.uploaded_at.desc())
        .first()
    )
    if existing:
        existing.doc_link = file_url
        existing.uploaded_by_admin_id = current_user.id
        existing.uploaded_at = datetime.utcnow()
    else:
        db.add(
            MediaDocument(
                owner_type="job_completion",
                owner_id=job.id,
                status=document_type,
                doc_link=file_url,
                uploaded_by_admin_id=current_user.id,
            )
        )
    setattr(job, f"{document_type}_document_link", file_url)
    db.commit()
    return {"url": file_url, "filename": document.filename}


@router.get("/lookup-so/{so_number}", response_model=dict)
def lookup_sales_order(
    so_number: Annotated[
        str, Path(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_.-]+$")
    ],
    current_user: models.User = Depends(get_current_user),
):
    """Fetch customer and project details from Odoo by Sales Order number.
    Used to auto-populate job creation forms."""
    from app.services.odoo_service import OdooService

    return OdooService.get_sales_order_details(so_number)


@router.post("/resolve-map-url", response_model=MapUrlResolveResponse)
def resolve_map_url(
    payload: MapUrlResolveRequest,
    current_user: models.User = Depends(get_current_user),
):
    """Turn a pasted Google Maps link into a map pin for the job form.

    Sync, not async: it uses requests, so FastAPI runs it in a threadpool. Login is the
    only throttle on making the server fetch a URL, which is why the host allowlist in
    maps_url lives one layer down and covers every redirect hop.
    """
    import requests as _requests

    from app.utils.maps_url import resolve as resolve_maps_url

    try:
        return resolve_maps_url(payload.url)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except _requests.RequestException:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not reach Google Maps to open that link",
        )


@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
def create_new_job(
    job: JobCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Create a job. Regular admins submit it for superadmin approval before it becomes active."""
    is_superadmin = getattr(current_user, "is_superadmin", False)
    return create_job(db, job, user_id=current_user.id, is_superadmin=is_superadmin)


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
    is_superadmin = getattr(current_user, "is_superadmin", False)
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
    search: Optional[str] = Query(
        None, description="Search by customer name, phone or city"
    ),
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
    return (
        query.order_by(models.Customer.created_at.desc(), models.Customer.id.desc())
        .limit(limit)
        .all()
    )


@router.get("/pending-approval", response_model=List[JobResponse])
def list_pending_approval_jobs(
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """List all jobs pending superadmin approval."""
    if not getattr(current_user, "is_superadmin", False):
        raise HTTPException(
            status_code=403, detail="Only superadmins can view pending approval jobs"
        )
    from sqlalchemy import select as sa_select
    from app.model.job import Job
    from app.crud.job import JOB_LOAD_OPTIONS

    stmt = (
        sa_select(Job)
        .options(*JOB_LOAD_OPTIONS)
        .where(Job.status == "pending_approval")
        .order_by(Job.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return db.scalars(stmt).unique().all()


@router.post("/{job_id}/approve-creation", response_model=JobResponse)
def approve_job_creation_route(
    job_id: Annotated[int, Path(gt=0)],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Superadmin approves a pending job, making it active."""
    if not getattr(current_user, "is_superadmin", False):
        raise HTTPException(
            status_code=403, detail="Only superadmins can approve job creation"
        )
    return approve_job_creation(db, job_id, admin_id=current_user.id)


@router.post("/documents/monthly")
def download_monthly_projects(
    request: MonthlyDocumentRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Generate a monthly workbook manually or from visible completed jobs."""
    month_start = datetime.strptime(request.month_year, "%Y-%m")
    month_end = datetime(
        month_start.year + (month_start.month == 12), month_start.month % 12 + 1, 1
    )
    jobs = get_all_jobs(
        db,
        limit=1000,
        status="completed",
        user_id=_scoped_admin_id(current_user),
    )
    jobs_by_id = {job.id: job for job in jobs}
    requested_ids = {
        project.job_id for project in request.projects if project.job_id is not None
    }
    unavailable = sorted(requested_ids - jobs_by_id.keys())
    if unavailable:
        raise HTTPException(
            status_code=422,
            detail=f"Only visible completed jobs can be included. Invalid job IDs: {unavailable}",
        )
    completed_in_month = (
        {
            job_id
            for (job_id,) in db.query(models.JobStatusLog.job_id)
            .filter(
                models.JobStatusLog.job_id.in_(requested_ids),
                models.JobStatusLog.status == "completed",
                models.JobStatusLog.created_at >= month_start,
                models.JobStatusLog.created_at < month_end,
            )
            .all()
        }
        if requested_ids
        else set()
    )
    wrong_month = sorted(requested_ids - completed_in_month)
    if wrong_month:
        raise HTTPException(
            status_code=422,
            detail=f"These jobs were not completed in {request.month_year}: {wrong_month}",
        )
    document = generate_monthly_document(request, jobs_by_id)
    return Response(
        content=document.content,
        media_type=document.content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{document.filename}"',
            "Content-Encoding": "identity",
        },
    )


@router.post("/documents/ncr")
def download_manual_ncr(
    request: ProjectDocumentRequest,
    current_user: models.User = Depends(get_current_user),
):
    """Generate a standalone NCR from manually entered values."""
    if request.data_source != "manual":
        raise HTTPException(status_code=422, detail="Select a job to use app data")
    document = generate_ncr_document(None, request)
    return Response(
        content=document.content,
        media_type=document.content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{document.filename}"',
            "Content-Encoding": "identity",
        },
    )


@router.post("/{job_id}/reject-creation", response_model=JobResponse)
def reject_job_creation_route(
    job_id: Annotated[int, Path(gt=0)],
    reason: str = Query("", max_length=1000),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Superadmin rejects a pending job with an optional reason."""
    if not getattr(current_user, "is_superadmin", False):
        raise HTTPException(
            status_code=403, detail="Only superadmins can reject job creation"
        )
    return reject_job_creation(db, job_id, reason, admin_id=current_user.id)


@router.get("/{job_id}", response_model=JobResponse)
def read_job(
    job_id: Annotated[int, Path(gt=0)],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Get a specific job by ID."""
    return get_job_by_id(db, job_id, user_id=_scoped_admin_id(current_user))


@router.post("/{job_id}/documents/project-ncr")
def generate_and_attach_ncr(
    job_id: Annotated[int, Path(gt=0)],
    request: ProjectDocumentRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    job = get_job_by_id(db, job_id, user_id=_scoped_admin_id(current_user))
    document = generate_ncr_document(job, request)
    return _attach_generated_completion_document(job, "ncr", document, db, current_user)


@router.post("/{job_id}/documents/project-report")
def generate_and_attach_project_report(
    job_id: Annotated[int, Path(gt=0)],
    request: MonthlyDocumentRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Generate one job's Project Report from the supplied monthly-project workbook."""
    if len(request.projects) != 1 or (
        request.data_source == "app" and request.projects[0].job_id != job_id
    ):
        raise HTTPException(
            status_code=422, detail="Project Report must contain only the selected job"
        )
    job = get_job_by_id(db, job_id, user_id=_scoped_admin_id(current_user))
    document = generate_monthly_document(request, {job.id: job})
    return _attach_generated_completion_document(
        job, "project_report", document, db, current_user
    )


@router.put("/{job_id}", response_model=JobResponse)
def update_existing_job(
    job_id: Annotated[int, Path(gt=0)],
    job_update: JobUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Update a job; roster sync validates the IP's dates and slots."""
    get_job_by_id(db, job_id, user_id=_scoped_admin_id(current_user))
    is_superadmin = getattr(current_user, "is_superadmin", False)
    return update_job(
        db, job_id, job_update, admin_id=current_user.id, is_superadmin=is_superadmin
    )


@router.delete("/{job_id}", status_code=status.HTTP_200_OK)
def delete_existing_job(
    job_id: Annotated[int, Path(gt=0)],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Delete a job and unassign its IP."""
    get_job_by_id(db, job_id, user_id=_scoped_admin_id(current_user))
    is_superadmin = getattr(current_user, "is_superadmin", False)
    return delete_job(db, job_id, admin_id=current_user.id, is_superadmin=is_superadmin)


# ============ OTP Flow Endpoints ============


@router.post("/{job_id}/request-start-otp", response_model=OTPResponse)
def request_start_otp(
    job_id: Annotated[int, Path(gt=0)],
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Send OTP to customer phone for job start verification"""
    is_superadmin = getattr(current_user, "is_superadmin", False)
    job = validate_job_start(
        db,
        job_id,
        admin_id=current_user.id,
        is_superadmin=is_superadmin,
    )
    if not job.customer_phone:
        raise HTTPException(
            status_code=400, detail="Customer phone not set for this job"
        )

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
def verify_start_otp_and_start(
    job_id: Annotated[int, Path(gt=0)],
    otp_data: JobStartWithOTP,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Verify start OTP and start the job"""
    job = get_job_by_id(db, job_id, user_id=_scoped_admin_id(current_user))

    # Skip OTP verification if no customer phone set (backward compatibility)
    if job.customer_phone:
        if not CustomerOTPService.verify_start_otp(db, job_id, otp_data.otp):
            raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    is_superadmin = getattr(current_user, "is_superadmin", False)
    return start_job(
        db,
        job_id,
        admin_id=current_user.id,
        is_superadmin=is_superadmin,
        notes=otp_data.notes,
    )


@router.post("/{job_id}/request-end-otp", response_model=OTPResponse)
def request_end_otp(
    job_id: Annotated[int, Path(gt=0)],
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Send OTP to customer phone for job completion verification"""
    job = get_job_by_id(db, job_id, user_id=_scoped_admin_id(current_user))
    if not job.customer_phone:
        raise HTTPException(
            status_code=400, detail="Customer phone not set for this job"
        )

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
def verify_end_otp_and_finish(
    job_id: Annotated[int, Path(gt=0)],
    otp_data: JobFinishWithOTP,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Verify end OTP and complete the job"""
    job = get_job_by_id(db, job_id, user_id=_scoped_admin_id(current_user))

    # Skip OTP verification if no customer phone set (backward compatibility)
    if job.customer_phone:
        validate_job_completion(
            db,
            job_id,
            admin_id=current_user.id,
            is_superadmin=getattr(current_user, "is_superadmin", False),
            handover_document_link=otp_data.handover_document_link,
            ncr_document_link=otp_data.ncr_document_link,
            project_report_document_link=otp_data.project_report_document_link,
            site_report_document_link=otp_data.site_report_document_link,
        )
        if not CustomerOTPService.verify_end_otp(db, job_id, otp_data.otp):
            raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    is_superadmin = getattr(current_user, "is_superadmin", False)
    return finish_job(
        db,
        job_id,
        admin_id=current_user.id,
        is_superadmin=is_superadmin,
        notes=otp_data.notes,
        handover_document_link=otp_data.handover_document_link,
        ncr_document_link=otp_data.ncr_document_link,
        project_report_document_link=otp_data.project_report_document_link,
        site_report_document_link=otp_data.site_report_document_link,
    )


# ============ Superadmin Approval Flow (fallback when the customer OTP can't be used) ============


def _require_superadmin(
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    if not getattr(current_user, "is_superadmin", False):
        raise HTTPException(
            status_code=403, detail="Only superadmins can review job approval requests"
        )
    return current_user


def _load_approval_request(db: Session, request_id: int) -> JobApprovalRequest:
    request = (
        db.query(JobApprovalRequest)
        .options(
            selectinload(JobApprovalRequest.job),
            selectinload(JobApprovalRequest.requested_by),
        )
        .filter(JobApprovalRequest.id == request_id)
        .first()
    )
    if not request:
        raise HTTPException(status_code=404, detail="Job approval request not found")
    return request


def _execute_approved_request(
    db: Session, request: JobApprovalRequest, approver: models.User
) -> None:
    """Run the transition the request was raised for, as the approving superadmin."""
    requester = request.requested_by_name or "a supervisor"
    notes = f"Approved by superadmin (requested by {requester}): {request.reason}"
    if request.action == "start":
        start_job(
            db, request.job_id, admin_id=approver.id, is_superadmin=True, notes=notes
        )
    else:
        finish_job(
            db,
            request.job_id,
            admin_id=approver.id,
            is_superadmin=True,
            notes=notes,
            handover_document_link=request.handover_document_link,
            ncr_document_link=request.ncr_document_link,
            project_report_document_link=request.project_report_document_link,
        )


@router.get(
    "/approval-requests/pending", response_model=List[JobApprovalRequestResponse]
)
def list_pending_job_approval_requests(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(_require_superadmin),
):
    """Start/finish approval requests awaiting a superadmin decision."""
    return (
        db.query(JobApprovalRequest)
        .options(
            selectinload(JobApprovalRequest.job),
            selectinload(JobApprovalRequest.requested_by),
        )
        .filter(JobApprovalRequest.status == "pending")
        .order_by(JobApprovalRequest.requested_at.desc())
        .all()
    )


@router.post("/{job_id}/approval-requests", response_model=JobApprovalRequestResponse)
def create_job_approval_request(
    job_id: Annotated[int, Path(gt=0)],
    data: JobApprovalRequestCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Ask a superadmin to start/finish this job instead of verifying a customer OTP.

    Preconditions are checked now, not at approval time, so a supervisor can't queue a
    request that could never be approved. A superadmin needs no second approver, so their
    own request is approved and executed in this same call.
    """
    is_superadmin = getattr(current_user, "is_superadmin", False)
    admin_id = _scoped_admin_id(current_user)
    if data.action == "start":
        validate_job_start(db, job_id, admin_id=admin_id, is_superadmin=is_superadmin)
    else:
        validate_job_completion(
            db,
            job_id,
            admin_id=admin_id,
            is_superadmin=is_superadmin,
            handover_document_link=data.handover_document_link,
            ncr_document_link=data.ncr_document_link,
            project_report_document_link=data.project_report_document_link,
            site_report_document_link=data.site_report_document_link,
        )

    existing = (
        db.query(JobApprovalRequest)
        .filter(
            JobApprovalRequest.job_id == job_id,
            JobApprovalRequest.action == data.action,
            JobApprovalRequest.status == "pending",
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"A {data.action} approval request for this job is already pending",
        )

    request = JobApprovalRequest(
        job_id=job_id,
        action=data.action,
        status="approved" if is_superadmin else "pending",
        reason=data.reason,
        requested_by_id=current_user.id,
        handover_document_link=data.handover_document_link,
        ncr_document_link=data.ncr_document_link,
        project_report_document_link=data.project_report_document_link,
        reviewed_by_id=current_user.id if is_superadmin else None,
        reviewed_at=datetime.utcnow() if is_superadmin else None,
    )
    db.add(request)
    if is_superadmin:
        # Flush, don't commit: start_job/finish_job commit the row along with the
        # transition, and roll it back with them if the transition fails.
        db.flush()
        _execute_approved_request(db, request, current_user)
    else:
        db.commit()
    return _load_approval_request(db, request.id)


@router.get(
    "/{job_id}/approval-requests", response_model=List[JobApprovalRequestResponse]
)
def list_job_approval_requests(
    job_id: Annotated[int, Path(gt=0)],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Approval requests raised against one job, newest first."""
    get_job_by_id(db, job_id, user_id=_scoped_admin_id(current_user))
    return (
        db.query(JobApprovalRequest)
        .options(
            selectinload(JobApprovalRequest.job),
            selectinload(JobApprovalRequest.requested_by),
        )
        .filter(JobApprovalRequest.job_id == job_id)
        .order_by(JobApprovalRequest.requested_at.desc())
        .all()
    )


@router.put(
    "/approval-requests/{request_id}/approve", response_model=JobApprovalRequestResponse
)
def approve_job_approval_request(
    request_id: Annotated[int, Path(gt=0)],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(_require_superadmin),
):
    """Approve the request and perform the start/finish it was raised for."""
    request = _load_approval_request(db, request_id)
    if request.status != "pending":
        raise HTTPException(
            status_code=400, detail=f"Request is already {request.status}"
        )

    # start_job/finish_job re-check the job status, so a job started via OTP in the
    # meantime raises here and the request stays pending for the superadmin to reject.
    _execute_approved_request(db, request, current_user)

    request.status = "approved"
    request.reviewed_by_id = current_user.id
    request.reviewed_at = datetime.utcnow()
    db.commit()
    return _load_approval_request(db, request_id)


@router.put(
    "/approval-requests/{request_id}/reject", response_model=JobApprovalRequestResponse
)
def reject_job_approval_request(
    request_id: Annotated[int, Path(gt=0)],
    reason: str = Query("", max_length=1000),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(_require_superadmin),
):
    """Reject the request, leaving the job untouched."""
    request = _load_approval_request(db, request_id)
    if request.status != "pending":
        raise HTTPException(
            status_code=400, detail=f"Request is already {request.status}"
        )

    request.status = "rejected"
    request.review_notes = reason or "Rejected by superadmin"
    request.reviewed_by_id = current_user.id
    request.reviewed_at = datetime.utcnow()
    db.commit()
    return _load_approval_request(db, request_id)


# ============ Legacy Endpoints (without OTP) ============


@router.post("/{job_id}/start", response_model=JobResponse)
def start_existing_job(
    job_id: Annotated[int, Path(gt=0)],
    job_start: JobStart = JobStart(),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Start or resume a job (legacy - no OTP). Use verify-start-otp for OTP flow."""
    job = get_job_by_id(db, job_id, user_id=_scoped_admin_id(current_user))
    # If customer phone is set, require OTP flow
    if job.customer_phone:
        raise HTTPException(
            status_code=400,
            detail="This job requires OTP verification. Use /request-start-otp then /verify-start-otp",
        )
    is_superadmin = getattr(current_user, "is_superadmin", False)
    return start_job(
        db,
        job_id,
        admin_id=current_user.id,
        is_superadmin=is_superadmin,
        notes=job_start.notes,
    )


@router.post("/{job_id}/pause", response_model=JobResponse)
def pause_existing_job(
    job_id: Annotated[int, Path(gt=0)],
    job_pause: JobPause = JobPause(),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Pause a job. Changes status to 'paused' and tracks paused_date. Logs the action with optional notes."""
    get_job_by_id(db, job_id, user_id=_scoped_admin_id(current_user))
    is_superadmin = getattr(current_user, "is_superadmin", False)
    return pause_job(
        db,
        job_id,
        admin_id=current_user.id,
        is_superadmin=is_superadmin,
        notes=job_pause.notes,
    )


@router.post("/{job_id}/finish", response_model=JobResponse)
def finish_existing_job(
    job_id: Annotated[int, Path(gt=0)],
    job_finish: JobFinish,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Finish a job (legacy - no OTP). Use verify-end-otp for OTP flow."""
    job = get_job_by_id(db, job_id, user_id=_scoped_admin_id(current_user))
    # If customer phone is set, require OTP flow
    if job.customer_phone:
        raise HTTPException(
            status_code=400,
            detail="This job requires OTP verification. Use /request-end-otp then /verify-end-otp",
        )
    is_superadmin = getattr(current_user, "is_superadmin", False)
    return finish_job(
        db,
        job_id,
        admin_id=current_user.id,
        is_superadmin=is_superadmin,
        notes=job_finish.notes,
        handover_document_link=job_finish.handover_document_link,
        ncr_document_link=job_finish.ncr_document_link,
        project_report_document_link=job_finish.project_report_document_link,
        site_report_document_link=job_finish.site_report_document_link,
    )


@router.get("/{job_id}/history", response_model=List[JobStatusLogResponse])
def get_job_history(
    job_id: Annotated[int, Path(gt=0)],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Get complete status change history for a job, including all pauses and resumes."""
    get_job_by_id(db, job_id, user_id=_scoped_admin_id(current_user))
    return get_job_status_history(db, job_id, verify_exists=False)


@router.put(
    "/{job_id}/checklists/items/{item_id}/approve",
    response_model=JobChecklistItemStatusResponse,
)
def approve_checklist_item(
    job_id: Annotated[int, Path(gt=0)],
    item_id: Annotated[int, Path(gt=0)],
    status_update: JobChecklistItemStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
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
    notes: str | None = Field(default=None, max_length=1000)


@router.get("/{job_id}/billing", response_model=dict)
def get_job_billing(
    job_id: Annotated[int, Path(gt=0)],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Get billing data for a job. Only available for external IP jobs."""
    job = get_job_by_id(db, job_id, user_id=_scoped_admin_id(current_user))

    if not job.assigned_ip or job.assigned_ip.is_internal:
        raise HTTPException(
            status_code=400, detail="Billing only available for external IP jobs"
        )

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
            _serialize_invoice_request(req) for req in get_invoice_requests(db, job_id)
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
    job_id: Annotated[int, Path(gt=0)],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Create an invoice request for a job. Only for external IP jobs."""
    job = get_job_by_id(db, job_id, user_id=_scoped_admin_id(current_user))

    if not job.assigned_ip or job.assigned_ip.is_internal:
        raise HTTPException(
            status_code=400, detail="Invoice requests only for external IP jobs"
        )

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
    job_id: Annotated[int, Path(gt=0)],
    body: CreateInvoiceRequestRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Create another invoice request for completion-based or phase-based billing."""
    job = get_job_by_id(db, job_id, user_id=_scoped_admin_id(current_user))

    if not job.assigned_ip or job.assigned_ip.is_internal:
        raise HTTPException(
            status_code=400, detail="Invoice requests only for external IP jobs"
        )

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
    job_id: Annotated[int, Path(gt=0)],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Approve the pending invoice request for a job."""
    from datetime import datetime as dt

    get_job_by_id(db, job_id, user_id=_scoped_admin_id(current_user))

    req = get_pending_invoice_request(db, job_id)
    if not req or req.status != "pending":
        raise HTTPException(
            status_code=404, detail="No pending invoice request found for this job"
        )

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
    job_id: Annotated[int, Path(gt=0)],
    reason: str = Query("", max_length=1000),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Reject the pending invoice request for a job."""
    get_job_by_id(db, job_id, user_id=_scoped_admin_id(current_user))

    req = get_pending_invoice_request(db, job_id)
    if not req or req.status != "pending":
        raise HTTPException(
            status_code=404, detail="No pending invoice request found for this job"
        )

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
    job_id: Annotated[int, Path(gt=0)],
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
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Encoding": "identity",
        },
    )


@router.get("/{job_id}/invoice-requests/{invoice_request_id}/download")
def download_invoice_request_bill(
    job_id: Annotated[int, Path(gt=0)],
    invoice_request_id: Annotated[int, Path(gt=0)],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    xlsx_bytes = BillingService.generate_invoice_xlsx(
        db,
        job_id,
        admin_id=current_user.id,
        is_superadmin=getattr(current_user, "is_superadmin", False),
        invoice_request_id=invoice_request_id,
    )
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="billing_invoice_{invoice_request_id}.xlsx"',
            "Content-Encoding": "identity",
        },
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
        items.append(
            {
                **_serialize_invoice_request(req),
                "job_name": job.name if job else None,
                "job_id": req.job_id,
            }
        )

    return {"pending_count": len(items), "requests": items}


@router.post("/upload-file", response_model=dict)
async def upload_job_file(
    file: UploadFile = File(...),
    job_id: Optional[int] = Form(None),
    document_type: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Upload a general file or a typed completion document owned by a job."""
    if bool(job_id) != bool(document_type):
        raise HTTPException(
            status_code=400, detail="job_id and document_type must be supplied together"
        )
    if document_type and document_type not in COMPLETION_DOCUMENT_SLOTS:
        raise HTTPException(status_code=422, detail="Invalid completion document type")
    job = (
        get_job_by_id(db, job_id, user_id=_scoped_admin_id(current_user))
        if job_id
        else None
    )
    upload = await read_validated_upload(
        file,
        allowed_extensions=(
            [*settings.allowed_extensions_list, ".xlsx"]
            if document_type == "project_report"
            else None
        ),
    )

    # Upload
    file_url = upload_file_to_s3(
        file_content=upload.content,
        filename=upload.filename,
        content_type=upload.content_type,
    )

    db.add(
        MediaDocument(
            owner_type="job_completion" if job_id else "admin",
            owner_id=job_id or current_user.id,
            status=document_type or "uploaded",
            doc_link=file_url,
            uploaded_by_admin_id=current_user.id,
        )
    )
    if document_type:
        # The three installation slots each own a column; the single-visit reports
        # share one, since a job only ever files one of them.
        column = (
            "site_report_document_link"
            if document_type in SITE_REPORT_SLOTS.values()
            else f"{document_type}_document_link"
        )
        setattr(job, column, file_url)
    db.commit()

    return {"url": file_url}
