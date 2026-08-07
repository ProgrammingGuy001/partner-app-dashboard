import logging
from datetime import datetime
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.crud.ip import assign_ip, unassign_ip
from app.model.ip import ip
from app.model.job import (
    ChecklistItem,
    Customer,
    Job,
    JobChecklist,
    JobChecklistItemStatus,
    JobRate,
)
from app.model.job_status_log import JobStatusLog
from app.model.media_document import MediaDocument
from app.model.user import User
from app.schemas.job import JobCreate, JobUpdate, validate_job_slot
from app.utils.ip_assignment import is_admin_allowed_for_ip

logger = logging.getLogger(__name__)

JOB_LOAD_OPTIONS = (
    selectinload(Job.assigned_ip),
    selectinload(Job.customer),
    selectinload(Job.job_rate),
    selectinload(Job.job_checklists),
    selectinload(Job.user),
)


def _resolve_rate_card(db: Session, job_rate_id: int) -> JobRate:
    """A picked rate card overrides whatever type/rate the client typed in."""
    rate_card = db.get(JobRate, job_rate_id)
    if not rate_card:
        raise HTTPException(status_code=404, detail=f"Job rate {job_rate_id} not found")
    return rate_card


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
        logger.exception("Database error")
        raise HTTPException(status_code=500, detail="Could not complete the request. Try again.") from e


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
                    Customer.name.ilike(search_pattern),
                    Customer.city.ilike(search_pattern),
                )
            )
        stmt = stmt.order_by(Job.created_at.desc(), Job.id.desc()).offset(skip).limit(limit)
        return db.scalars(stmt).unique().all()
    except Exception as e:
        logger.exception("Database error")
        raise HTTPException(status_code=500, detail="Could not complete the request. Try again.") from e


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
        logger.exception("Database error")
        raise HTTPException(status_code=500, detail="Could not complete the request. Try again.") from e


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
        logger.exception("Database error")
        raise HTTPException(status_code=500, detail="Could not complete the request. Try again.") from e


def _validate_supervisor(db: Session, admin_id: int | None) -> None:
    """A job's supervisor must be a live, approved admin. Superadmins don't run sites."""
    if admin_id is None:
        return
    supervisor = db.query(User).filter(User.id == admin_id).first()
    if not supervisor:
        raise HTTPException(status_code=404, detail=f"Supervisor with ID {admin_id} not found")
    if supervisor.is_superadmin:
        raise HTTPException(status_code=400, detail="A superadmin cannot be assigned as supervisor")
    if not supervisor.is_active or not supervisor.is_approved:
        raise HTTPException(
            status_code=400, detail=f"Supervisor {admin_id} is not an active, approved admin"
        )


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

        _validate_supervisor(db, job.admin_assigned)

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

        job_rate_id = job_data.pop("job_rate_id", None)
        job_type = job_data.pop("type", None)
        job_rate_val = job_data.pop("rate", None)
        job_data.pop("status", None)

        if job_rate_id is not None:
            # Copy-on-write: later edits to the card must not rewrite historical jobs.
            rate_card = _resolve_rate_card(db, job_rate_id)
            job_type = rate_card.job_type_name
            job_rate_val = rate_card.base_rate

        # Only a superadmin sets an incentive; anyone else's value is discarded.
        incentive = job_data.pop("incentive", Decimal("0.00"))
        if not is_superadmin:
            incentive = Decimal("0.00")

        initial_status = "created" if is_superadmin else "pending_approval"

        latitude = job_data.pop("latitude", None)
        longitude = job_data.pop("longitude", None)
        geofence_radius = job_data.pop("geofence_radius", None)

        # Re-checked here, not just in JobCreate: a rate card can override the posted type.
        try:
            validate_job_slot(job_type, job_data.get("slot_start"), job_data.get("slot_end"))
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

        db_job = Job(
            customer_id=customer.id if customer else None,
            assigned_ip_id=job_data.pop("assigned_ip_id", None),
            status=initial_status,
            delivery_date=job_data.pop("delivery_date", None),
            incentive=incentive,
            job_rate_id=job_rate_id,
            job_type=job_type,
            rate_amount=job_rate_val,
            area=job_data.pop("size", None),
            # Falls back to the creator when no supervisor is picked. The creator is
            # recorded independently in the JobStatusLog entry below either way.
            admin_assigned=job_data.pop("admin_assigned", None) or user_id,
            start_date=job_data.pop("start_date", None),
            latitude=latitude,
            longitude=longitude,
            geofence_radius=geofence_radius,
            sales_order=job_data.pop("sales_order", None),
            drawing_document_link=job_data.pop("drawing_document_link", None),
            slot_start=job_data.pop("slot_start", None),
            slot_end=job_data.pop("slot_end", None),
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
                actor_type="admin",
                actor_id=user_id,
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
        logger.exception("Error creating job")
        raise HTTPException(status_code=500, detail="Could not create the job.") from e


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

        job_rate_id = update_data.pop("job_rate_id", None)
        if job_rate_id is not None:
            # A picked card wins over any manually typed type/rate in the same payload.
            rate_card = _resolve_rate_card(db, job_rate_id)
            db_job.job_rate_id = rate_card.id
            db_job.job_type = rate_card.job_type_name
            db_job.rate_amount = rate_card.base_rate
            update_data.pop("type", None)
            update_data.pop("rate", None)
        else:
            if "type" in update_data:
                db_job.job_type = update_data.pop("type")
            if "rate" in update_data:
                db_job.rate_amount = update_data.pop("rate")

        if "size" in update_data:
            db_job.area = update_data.pop("size")

        if not is_superadmin:
            update_data.pop("status", None)
            # Rate card aside, an incentive is a superadmin call.
            update_data.pop("incentive", None)

        if "admin_assigned" in update_data:
            _validate_supervisor(db, update_data["admin_assigned"])

        # The payload is partial, so the merged pair is what has to hold. db_job.job_type is
        # already final here, which also catches switching a slotted job to installation.
        try:
            validate_job_slot(
                db_job.job_type,
                update_data.get("slot_start", db_job.slot_start),
                update_data.get("slot_end", db_job.slot_end),
            )
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

        field_map = {
            "status": "status",
            "admin_assigned": "admin_assigned",
            "start_date": "start_date",
            "delivery_date": "delivery_date",
            "latitude": "latitude",
            "longitude": "longitude",
            "geofence_radius": "geofence_radius",
            "incentive": "incentive",
            "sales_order": "sales_order",
            "drawing_document_link": "drawing_document_link",
            "slot_start": "slot_start",
            "slot_end": "slot_end",
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
        logger.exception("Error updating job")
        raise HTTPException(status_code=500, detail="Could not update the job.") from e


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
        logger.exception("Error deleting job")
        raise HTTPException(status_code=500, detail="Could not delete the job.") from e


def validate_job_start(db: Session, job_id: int, admin_id: int = None, is_superadmin: bool = False):
    """Validate start preconditions before an OTP is consumed or state changes."""
    db_job = get_job_by_id(db, job_id, user_id=None if is_superadmin else admin_id)

    if db_job.status == "pending_approval":
        raise HTTPException(status_code=400, detail="Job is pending superadmin approval and cannot be started yet.")
    if db_job.status not in {"created", "paused"}:
        raise HTTPException(status_code=400, detail=f"Job cannot be started. Current status: {db_job.status}")

    if not db_job.assigned_ip_id:
        raise HTTPException(
            status_code=400,
            detail="Cannot start job: No IP assigned. Please edit the job to assign an IP first.",
        )

    # Material receipt is the first prerequisite of an installation job.
    if db_job.type == "installation":
        from app.model.site_grn import SiteGRN

        linked_grns = db.query(SiteGRN.status).filter(SiteGRN.job_id == job_id).all()
        if not linked_grns:
            raise HTTPException(
                status_code=400,
                detail="Link a Site GRN to this job before starting an installation job",
            )
        incomplete_count = sum(status != "submitted" for status, in linked_grns)
        if incomplete_count:
            raise HTTPException(
                status_code=400,
                detail=f"Complete all Site GRNs linked to this job before starting ({incomplete_count} incomplete)",
            )
    return db_job


def start_job(db: Session, job_id: int, admin_id: int = None, is_superadmin: bool = False, notes: str = None):
    """Start/resume a job and assign IP."""
    try:
        db_job = validate_job_start(db, job_id, admin_id=admin_id, is_superadmin=is_superadmin)
        prev_status = db_job.status

        assign_ip(db, db_job.assigned_ip_id, admin_id, is_superadmin, commit=False)
        db_job.status = "in_progress"
        db.add(
            JobStatusLog(
                job_id=job_id,
                status="in_progress",
                created_at=datetime.utcnow(),
                notes=notes or ("Job resumed" if prev_status == "paused" else "Job started"),
                actor_type="admin",
                actor_id=admin_id,
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
        logger.exception("Error starting job")
        raise HTTPException(status_code=500, detail="Could not start the job.") from e


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
                actor_type="admin",
                actor_id=admin_id,
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
        logger.exception("Error pausing job")
        raise HTTPException(status_code=500, detail="Could not pause the job.") from e


def validate_job_completion(
    db: Session,
    job_id: int,
    admin_id: int = None,
    is_superadmin: bool = False,
    handover_document_link: str = None,
    ncr_document_link: str = None,
    project_report_document_link: str = None,
):
    """Validate completion evidence before an OTP is consumed or state changes."""
    db_job = get_job_by_id(db, job_id, user_id=None if is_superadmin else admin_id)
    if db_job.status != "in_progress":
        raise HTTPException(
            status_code=400,
            detail=f"Only jobs in progress can be finished. Current status: {db_job.status}",
        )

    if not all((handover_document_link, ncr_document_link, project_report_document_link)):
        raise HTTPException(status_code=400, detail="Handover, NCR, and Project Report documents are required")
    if db_job.ncr_document_link != ncr_document_link:
        raise HTTPException(
            status_code=400,
            detail="Generate and attach the Level 2 NCR from the admin document form before completion",
        )

    required_documents = {
        "handover": handover_document_link,
        "ncr": ncr_document_link,
        "project_report": project_report_document_link,
    }
    documents = db.query(MediaDocument).filter(
        MediaDocument.owner_type == "job_completion",
        MediaDocument.owner_id == job_id,
        MediaDocument.doc_link.in_(required_documents.values()),
    ).all()
    documents_by_type = {document.status: document.doc_link for document in documents}
    if documents_by_type != required_documents:
        raise HTTPException(
            status_code=400,
            detail="Completion documents must be uploaded for this job in the correct document slots",
        )

    if db_job.type == "installation":
        from app.model.site_grn import SiteGRN

        has_submitted_grn = db.query(SiteGRN.id).filter(
            SiteGRN.job_id == job_id,
            SiteGRN.status == "submitted",
        ).first()
        if not has_submitted_grn:
            raise HTTPException(
                status_code=400,
                detail="A submitted Site GRN linked to this job is required before an installation job can be completed",
            )

    assigned_item_ids = [
        item_id
        for item_id, in (
            db.query(ChecklistItem.id)
            .join(JobChecklist, JobChecklist.checklist_id == ChecklistItem.checklist_id)
            .filter(JobChecklist.job_id == job_id)
            .all()
        )
    ]
    if assigned_item_ids:
        approved_count = db.query(JobChecklistItemStatus.id).filter(
            JobChecklistItemStatus.job_id == job_id,
            JobChecklistItemStatus.checklist_item_id.in_(assigned_item_ids),
            JobChecklistItemStatus.review_status == "approved",
        ).count()
        if approved_count != len(assigned_item_ids):
            raise HTTPException(
                status_code=409,
                detail=f"All checklist items must be approved before completion ({approved_count}/{len(assigned_item_ids)} approved)",
            )
    return db_job


def finish_job(
    db: Session,
    job_id: int,
    admin_id: int = None,
    is_superadmin: bool = False,
    notes: str = None,
    handover_document_link: str = None,
    ncr_document_link: str = None,
    project_report_document_link: str = None,
):
    """Finish a job and unassign its IP."""
    try:
        db_job = validate_job_completion(
            db,
            job_id,
            admin_id=admin_id,
            is_superadmin=is_superadmin,
            handover_document_link=handover_document_link,
            ncr_document_link=ncr_document_link,
            project_report_document_link=project_report_document_link,
        )

        if db_job.assigned_ip_id:
            unassign_ip(db, db_job.assigned_ip_id, admin_id, is_superadmin, commit=False)

        db_job.status = "completed"
        db_job.handover_document_link = handover_document_link
        db_job.ncr_document_link = ncr_document_link
        db_job.project_report_document_link = project_report_document_link
        db.add(
            JobStatusLog(
                job_id=job_id,
                status="completed",
                created_at=datetime.utcnow(),
                notes=notes or "Job completed",
                actor_type="admin",
                actor_id=admin_id,
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
        logger.exception("Error finishing job")
        raise HTTPException(status_code=500, detail="Could not finish the job.") from e


def approve_job_creation(db: Session, job_id: int, admin_id: int = None):
    """Superadmin approves a pending_approval job, moving it to created."""
    try:
        db_job = get_job_by_id(db, job_id, user_id=None)
        if db_job.status != "pending_approval":
            raise HTTPException(status_code=400, detail=f"Job is not pending approval. Current status: {db_job.status}")
        db_job.status = "created"
        db.add(JobStatusLog(job_id=job_id, status="created", created_at=datetime.utcnow(), notes="Approved by superadmin", actor_type="admin", actor_id=admin_id))
        db.commit()
        db.refresh(db_job)
        return db_job
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.exception("Error approving job")
        raise HTTPException(status_code=500, detail="Could not approve the job.") from e


def reject_job_creation(db: Session, job_id: int, reason: str = "", admin_id: int = None):
    """Superadmin rejects a pending_approval job."""
    try:
        db_job = get_job_by_id(db, job_id, user_id=None)
        if db_job.status != "pending_approval":
            raise HTTPException(status_code=400, detail=f"Job is not pending approval. Current status: {db_job.status}")
        db_job.status = "creation_rejected"
        db.add(JobStatusLog(job_id=job_id, status="creation_rejected", created_at=datetime.utcnow(), notes=reason or "Rejected by superadmin", actor_type="admin", actor_id=admin_id))
        db.commit()
        db.refresh(db_job)
        return db_job
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.exception("Error rejecting job")
        raise HTTPException(status_code=500, detail="Could not reject the job.") from e


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
        logger.exception("Error fetching job status history")
        raise HTTPException(status_code=500, detail="Could not load the job history.") from e


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
        logger.exception("Error fetching job checklists")
        raise HTTPException(status_code=500, detail="Could not load the job checklists.") from e


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
        logger.exception("Error fetching checklist items")
        raise HTTPException(status_code=500, detail="Could not load the checklist items.") from e
