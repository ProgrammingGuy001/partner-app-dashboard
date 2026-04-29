from datetime import datetime
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.crud.ip import assign_ip, unassign_ip
from app.model.ip import ip
from app.model.job import ChecklistItem, Customer, Job, JobChecklist, JobChecklistItemStatus
from app.model.job_status_log import JobStatusLog
from app.schemas.job import JobCreate, JobUpdate
from app.utils.ip_assignment import is_admin_allowed_for_ip

JOB_LOAD_OPTIONS = (
    selectinload(Job.assigned_ip),
    selectinload(Job.customer),
    selectinload(Job.job_rate),
    selectinload(Job.job_checklists),
)


def _upsert_customer(
    db: Session,
    *,
    customer_name: str | None,
    customer_phone: str | None,
    address_line_1: str | None,
    address_line_2: str | None,
    city: str | None,
    state: str | None,
    pincode: int | None,
    existing_customer: Customer | None = None,
) -> Customer | None:
    if (
        customer_name is None
        and customer_phone is None
        and address_line_1 is None
        and address_line_2 is None
        and city is None
        and state is None
        and pincode is None
    ):
        return existing_customer

    customer = existing_customer
    if customer is None:
        customer = Customer(
            name=customer_name or "Unknown",
            phone_number=customer_phone,
            address_line_1=address_line_1,
            address_line_2=address_line_2,
            city=city,
            state=state,
            pincode=pincode,
        )
        db.add(customer)
        db.flush()
        return customer

    if customer_name is not None:
        customer.name = customer_name
    if customer_phone is not None:
        customer.phone_number = customer_phone
    if address_line_1 is not None:
        customer.address_line_1 = address_line_1
    if address_line_2 is not None:
        customer.address_line_2 = address_line_2
    if city is not None:
        customer.city = city
    if state is not None:
        customer.state = state
    if pincode is not None:
        customer.pincode = pincode
    return customer


def _get_customer_by_id(db: Session, customer_id: int) -> Customer:
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail=f"Customer with ID {customer_id} not found")
    return customer


def get_job_by_id(db: Session, job_id: int, user_id: int = None):
    """Get a job by ID with authorization checks."""
    try:
        job = db.scalars(select(Job).options(*JOB_LOAD_OPTIONS).where(Job.id == job_id)).first()
        if not job:
            raise HTTPException(status_code=404, detail=f"Job with ID {job_id} not found")
        if user_id is not None and job.user_id != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to access this job")
        return job
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e


def get_all_jobs(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    status: str = None,
    job_type: str = None,
    search: str = None,
    user_id: int = None,
    admin_id: int = None,
):
    """Get jobs with optional filtering."""
    try:
        stmt = select(Job).options(*JOB_LOAD_OPTIONS)
        if user_id is not None:
            stmt = stmt.where(Job.user_id == user_id)
        if status:
            stmt = stmt.where(Job.status == status)
        else:
            stmt = stmt.where(Job.status.notin_(["pending_approval", "creation_rejected"]))
        if job_type:
            stmt = stmt.where(Job.job_type == job_type)
        if search:
            search_pattern = f"%{search.strip()}%"
            stmt = stmt.join(Job.customer).where(
                or_(
                    Job.name.ilike(search_pattern),
                    Customer.name.ilike(search_pattern),
                    Customer.city.ilike(search_pattern),
                )
            )
        stmt = stmt.order_by(Job.created_at.desc(), Job.id.desc()).offset(skip).limit(limit)
        return db.scalars(stmt).unique().all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e


def get_jobs_for_ip(db: Session, ip_id: int, skip: int = 0, limit: int = 100):
    """Return jobs assigned to a specific IP with related entities eager-loaded."""
    try:
        stmt = (
            select(Job)
            .options(*JOB_LOAD_OPTIONS)
            .where(Job.assigned_ip_id == ip_id)
            .order_by(Job.created_at.desc(), Job.id.desc())
            .offset(skip)
            .limit(limit)
        )
        return db.scalars(stmt).unique().all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e


def get_ip_job_by_id(db: Session, job_id: int, ip_id: int):
    """Get a job assigned to the current IP user."""
    try:
        stmt = select(Job).options(*JOB_LOAD_OPTIONS).where(
            Job.id == job_id,
            Job.assigned_ip_id == ip_id,
        )
        job = db.scalars(stmt).first()
        if not job:
            raise HTTPException(
                status_code=404,
                detail="Job not found or not assigned to you",
            )
        return job
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e


def create_job(db: Session, job: JobCreate, user_id: int, is_superadmin: bool = False):
    """Create a job draft; regular admins require superadmin approval before it becomes active."""
    try:
        if job.assigned_ip_id:
            ip_user = db.query(ip).filter(ip.id == job.assigned_ip_id).first()
            if not ip_user:
                raise HTTPException(status_code=404, detail=f"IP with ID {job.assigned_ip_id} not found")
            if ip_user.is_assigned:
                raise HTTPException(status_code=400, detail=f"IP {ip_user.id} is already assigned to another job")
            if not is_superadmin and not is_admin_allowed_for_ip(db, job.assigned_ip_id, user_id):
                raise HTTPException(
                    status_code=403,
                    detail=f"Admin {user_id} is not allowed to be assigned IP {job.assigned_ip_id}",
                )

        job_data = job.model_dump()
        checklist_ids = job_data.pop("checklist_ids", [])
        job_data.pop("checklist_id", None)
        job_data.pop("user_id", None)

        customer_id = job_data.pop("customer_id", None)
        if customer_id is not None:
            customer = _get_customer_by_id(db, customer_id)
            # Ignore free-text customer payload when an explicit customer_id is supplied.
            job_data.pop("customer_name", None)
            job_data.pop("customer_phone", None)
            job_data.pop("address_line_1", None)
            job_data.pop("address_line_2", None)
            job_data.pop("city", None)
            job_data.pop("state", None)
            job_data.pop("pincode", None)
        else:
            customer = _upsert_customer(
                db,
                customer_name=job_data.pop("customer_name", None),
                customer_phone=job_data.pop("customer_phone", None),
                address_line_1=job_data.pop("address_line_1", None),
                address_line_2=job_data.pop("address_line_2", None),
                city=job_data.pop("city", None),
                state=job_data.pop("state", None),
                pincode=job_data.pop("pincode", None),
            )

        job_data.pop("job_rate_id", None)
        job_type = job_data.pop("type", None)
        job_rate_val = job_data.pop("rate", None)
        job_data.pop("status", None)

        initial_status = "created" if is_superadmin else "pending_approval"

        db_job = Job(
            name=job_data.pop("name", None),
            customer_id=customer.id if customer else None,
            assigned_ip_id=job_data.pop("assigned_ip_id", None),
            status=initial_status,
            delivery_date=job_data.pop("delivery_date", None),
            incentive=job_data.pop("incentive", Decimal("0.00")),
            job_type=job_type,
            rate_amount=job_rate_val,
            area=job_data.pop("size", None),
            admin_assigned=user_id,
            start_date=job_data.pop("start_date", None),
            checklist_link=job_data.pop("checklist_link", None),
            google_map_link=job_data.pop("google_map_link", None),
        )
        db.add(db_job)
        db.flush()

        for checklist_id in checklist_ids or []:
            db.add(JobChecklist(job_id=db_job.id, checklist_id=checklist_id))

        log_status = "created" if initial_status == "created" else "pending_approval"
        log_notes = "Job created" if initial_status == "created" else "Job submitted for superadmin approval"
        db.add(
            JobStatusLog(
                job_id=db_job.id,
                status=log_status,
                created_at=datetime.utcnow(),
                notes=log_notes,
            )
        )

        db.commit()
        db.refresh(db_job)
        return db_job
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating job: {str(e)}") from e


def update_job(db: Session, job_id: int, job_update: JobUpdate, admin_id: int = None, is_superadmin: bool = False):
    """Update job details, customer, and manual type/rate fields."""
    try:
        db_job = get_job_by_id(db, job_id, user_id=None if is_superadmin else admin_id)

        update_data = job_update.model_dump(exclude_unset=True)

        if "assigned_ip_id" in update_data:
            new_ip_id = update_data["assigned_ip_id"]
            old_ip_id = db_job.assigned_ip_id
            if db_job.status == "in_progress" and new_ip_id != old_ip_id:
                if old_ip_id:
                    unassign_ip(db, old_ip_id, admin_id, is_superadmin, commit=False)
                if new_ip_id:
                    assign_ip(db, new_ip_id, admin_id, is_superadmin, commit=False)
            db_job.assigned_ip_id = new_ip_id

        if "checklist_ids" in update_data:
            checklist_ids = update_data.pop("checklist_ids")
            db.query(JobChecklist).filter(JobChecklist.job_id == job_id).delete()
            for checklist_id in checklist_ids or []:
                db.add(JobChecklist(job_id=job_id, checklist_id=checklist_id))

        customer_id_provided = "customer_id" in update_data
        customer_id = update_data.pop("customer_id", None)
        if customer_id_provided:
            db_job.customer_id = _get_customer_by_id(db, customer_id).id if customer_id is not None else None
            update_data.pop("customer_name", None)
            update_data.pop("customer_phone", None)
            update_data.pop("address_line_1", None)
            update_data.pop("address_line_2", None)
            update_data.pop("city", None)
            update_data.pop("state", None)
            update_data.pop("pincode", None)
        else:
            customer = _upsert_customer(
                db,
                customer_name=update_data.pop("customer_name", None),
                customer_phone=update_data.pop("customer_phone", None),
                address_line_1=update_data.pop("address_line_1", None),
                address_line_2=update_data.pop("address_line_2", None),
                city=update_data.pop("city", None),
                state=update_data.pop("state", None),
                pincode=update_data.pop("pincode", None),
                existing_customer=db_job.customer,
            )
            if customer:
                db_job.customer_id = customer.id

        update_data.pop("job_rate_id", None)
        if "type" in update_data:
            db_job.job_type = update_data.pop("type")
        if "rate" in update_data:
            db_job.rate_amount = update_data.pop("rate")

        if "size" in update_data:
            db_job.area = update_data.pop("size")

        if not is_superadmin:
            update_data.pop("status", None)

        field_map = {
            "name": "name",
            "status": "status",
            "start_date": "start_date",
            "delivery_date": "delivery_date",
            "checklist_link": "checklist_link",
            "google_map_link": "google_map_link",
            "incentive": "incentive",
        }
        for source, target in field_map.items():
            if source in update_data:
                setattr(db_job, target, update_data[source])

        db.commit()
        db.refresh(db_job)
        return db_job
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating job: {str(e)}") from e


def delete_job(db: Session, job_id: int, admin_id: int = None, is_superadmin: bool = False):
    """Delete a job and related runtime mappings."""
    try:
        db_job = get_job_by_id(db, job_id, user_id=None if is_superadmin else admin_id)

        if db_job.assigned_ip_id:
            unassign_ip(db, db_job.assigned_ip_id, admin_id, is_superadmin, commit=False)

        db.query(JobChecklist).filter(JobChecklist.job_id == job_id).delete(synchronize_session=False)
        db.query(JobStatusLog).filter(JobStatusLog.job_id == job_id).delete(synchronize_session=False)
        db.delete(db_job)
        db.commit()
        return {"message": "Job deleted successfully"}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting job: {str(e)}") from e


def start_job(db: Session, job_id: int, admin_id: int = None, is_superadmin: bool = False, notes: str = None):
    """Start/resume a job and assign IP."""
    try:
        db_job = get_job_by_id(db, job_id, user_id=None if is_superadmin else admin_id)

        prev_status = db_job.status
        if prev_status == "pending_approval":
            raise HTTPException(status_code=400, detail="Job is pending superadmin approval and cannot be started yet.")
        if prev_status not in {"created", "paused"}:
            raise HTTPException(status_code=400, detail=f"Job cannot be started. Current status: {db_job.status}")

        if not db_job.assigned_ip_id:
            raise HTTPException(
                status_code=400,
                detail="Cannot start job: No IP assigned. Please edit the job to assign an IP first.",
            )

        assign_ip(db, db_job.assigned_ip_id, admin_id, is_superadmin, commit=False)
        db_job.status = "in_progress"
        db.add(
            JobStatusLog(
                job_id=job_id,
                status="in_progress",
                created_at=datetime.utcnow(),
                notes=notes or ("Job resumed" if prev_status == "paused" else "Job started"),
            )
        )
        db.commit()
        db.refresh(db_job)
        return db_job
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error starting job: {str(e)}") from e


def pause_job(db: Session, job_id: int, admin_id: int = None, is_superadmin: bool = False, notes: str = None):
    """Pause a job and unassign its IP."""
    try:
        db_job = get_job_by_id(db, job_id, user_id=None if is_superadmin else admin_id)
        if db_job.status != "in_progress":
            raise HTTPException(
                status_code=400,
                detail=f"Only jobs in progress can be paused. Current status: {db_job.status}",
            )

        if db_job.assigned_ip_id:
            unassign_ip(db, db_job.assigned_ip_id, admin_id, is_superadmin, commit=False)

        db_job.status = "paused"
        db.add(
            JobStatusLog(
                job_id=job_id,
                status="paused",
                created_at=datetime.utcnow(),
                notes=notes or "Job paused",
            )
        )
        db.commit()
        db.refresh(db_job)
        return db_job
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error pausing job: {str(e)}") from e


def finish_job(db: Session, job_id: int, admin_id: int = None, is_superadmin: bool = False, notes: str = None):
    """Finish a job and unassign its IP."""
    try:
        db_job = get_job_by_id(db, job_id, user_id=None if is_superadmin else admin_id)
        if db_job.status != "in_progress":
            raise HTTPException(
                status_code=400,
                detail=f"Only jobs in progress can be finished. Current status: {db_job.status}",
            )

        if db_job.assigned_ip_id:
            unassign_ip(db, db_job.assigned_ip_id, admin_id, is_superadmin, commit=False)

        db_job.status = "completed"
        db.add(
            JobStatusLog(
                job_id=job_id,
                status="completed",
                created_at=datetime.utcnow(),
                notes=notes or "Job completed",
            )
        )
        db.commit()
        db.refresh(db_job)
        return db_job
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error finishing job: {str(e)}") from e


def approve_job_creation(db: Session, job_id: int):
    """Superadmin approves a pending_approval job, moving it to created."""
    try:
        db_job = get_job_by_id(db, job_id, user_id=None)
        if db_job.status != "pending_approval":
            raise HTTPException(status_code=400, detail=f"Job is not pending approval. Current status: {db_job.status}")
        db_job.status = "created"
        db.add(JobStatusLog(job_id=job_id, status="created", created_at=datetime.utcnow(), notes="Approved by superadmin"))
        db.commit()
        db.refresh(db_job)
        return db_job
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error approving job: {str(e)}") from e


def reject_job_creation(db: Session, job_id: int, reason: str = ""):
    """Superadmin rejects a pending_approval job."""
    try:
        db_job = get_job_by_id(db, job_id, user_id=None)
        if db_job.status != "pending_approval":
            raise HTTPException(status_code=400, detail=f"Job is not pending approval. Current status: {db_job.status}")
        db_job.status = "creation_rejected"
        db.add(JobStatusLog(job_id=job_id, status="creation_rejected", created_at=datetime.utcnow(), notes=reason or "Rejected by superadmin"))
        db.commit()
        db.refresh(db_job)
        return db_job
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error rejecting job: {str(e)}") from e


def get_job_status_history(db: Session, job_id: int, verify_exists: bool = True):
    """Get status history for a job."""
    try:
        if verify_exists:
            get_job_by_id(db, job_id)

        return (
            db.query(JobStatusLog)
            .filter(JobStatusLog.job_id == job_id)
            .order_by(JobStatusLog.created_at.desc())
            .all()
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching job status history: {str(e)}") from e


def get_job_checklists_overview(db: Session, job_id: int):
    """Return checklist metadata for a job using a single eager-loaded query."""
    try:
        stmt = (
            select(JobChecklist)
            .options(selectinload(JobChecklist.checklist))
            .where(JobChecklist.job_id == job_id)
            .order_by(JobChecklist.id.asc())
        )
        return db.scalars(stmt).all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching job checklists: {str(e)}") from e


def get_job_checklist_items_with_status(db: Session, job_id: int, checklist_id: int):
    """Return checklist items plus their persisted status for a job."""
    try:
        job_checklist_link = db.scalars(
            select(JobChecklist)
            .options(selectinload(JobChecklist.checklist))
            .where(
                JobChecklist.job_id == job_id,
                JobChecklist.checklist_id == checklist_id,
            )
        ).first()

        if not job_checklist_link:
            raise HTTPException(
                status_code=404,
                detail="Checklist not assigned to this job",
            )

        checklist = job_checklist_link.checklist
        items = db.scalars(
            select(ChecklistItem)
            .where(ChecklistItem.checklist_id == checklist_id)
            .order_by(ChecklistItem.position.asc(), ChecklistItem.id.asc())
        ).all()

        item_ids = [item.id for item in items]
        if not item_ids:
            return checklist, []

        statuses = db.scalars(
            select(JobChecklistItemStatus).where(
                JobChecklistItemStatus.job_id == job_id,
                JobChecklistItemStatus.checklist_item_id.in_(item_ids),
            )
        ).all()
        status_map = {status.checklist_item_id: status for status in statuses}

        items_with_status = []
        for item in items:
            item_status = status_map.get(item.id)
            items_with_status.append(
                {
                    "id": item.id,
                    "checklist_id": item.checklist_id,
                    "text": item.text,
                    "position": item.position,
                    "created_at": item.created_at,
                    "updated_at": item.updated_at,
                    "status": {
                        "id": item_status.id if item_status else None,
                        "job_id": item_status.job_id if item_status else job_id,
                        "checklist_item_id": item_status.checklist_item_id if item_status else item.id,
                        "checked": item_status.checked if item_status else False,
                        "is_approved": item_status.is_approved if item_status else False,
                        "comment": item_status.comment if item_status else None,
                        "admin_comment": item_status.admin_comment if item_status else None,
                        "document_link": item_status.document_link if item_status else None,
                        "created_at": item_status.created_at if item_status else None,
                        "updated_at": item_status.updated_at if item_status else None,
                    },
                }
            )

        return checklist, items_with_status
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching checklist items: {str(e)}") from e
