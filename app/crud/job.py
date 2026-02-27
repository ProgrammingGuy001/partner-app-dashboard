from datetime import datetime
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.crud.ip import assign_ip, unassign_ip
from app.model.ip import ip
from app.model.job import Customer, Job, JobChecklist, JobRate
from app.model.job_status_log import JobStatusLog
from app.schemas.job import JobCreate, JobUpdate
from app.utils.ip_assignment import is_admin_allowed_for_ip


def _upsert_customer(
    db: Session,
    *,
    customer_name: str | None,
    customer_phone: str | None,
    address: str | None,
    city: str | None,
    pincode: int | None,
    existing_customer: Customer | None = None,
) -> Customer | None:
    if (
        customer_name is None
        and customer_phone is None
        and address is None
        and city is None
        and pincode is None
    ):
        return existing_customer

    customer = existing_customer
    if customer is None:
        customer = Customer(
            name=customer_name or "Unknown",
            phone_number=customer_phone,
            address=address,
            city=city,
            pincode=pincode,
        )
        db.add(customer)
        db.flush()
        return customer

    if customer_name is not None:
        customer.name = customer_name
    if customer_phone is not None:
        customer.phone_number = customer_phone
    if address is not None:
        customer.address = address
    if city is not None:
        customer.city = city
    if pincode is not None:
        customer.pincode = pincode
    return customer


def _upsert_job_rate(
    db: Session, *, job_type: str | None, rate: Decimal | None, existing_rate: JobRate | None = None
) -> JobRate | None:
    if job_type is None and rate is None:
        return existing_rate

    target_type = job_type or (existing_rate.job_type_name if existing_rate else None) or "custom"
    job_rate = db.query(JobRate).filter(JobRate.job_type_name == target_type).first()
    if not job_rate:
        job_rate = JobRate(job_type_name=target_type, base_rate=rate or Decimal("0"))
        db.add(job_rate)
        db.flush()
        return job_rate

    # Avoid mutating shared catalog rates when both type and rate are provided from job forms.
    # Catalog updates should happen through explicit rate-management flows.
    if rate is not None and job_type is None:
        job_rate.base_rate = rate
    return job_rate


def _get_customer_by_id(db: Session, customer_id: int) -> Customer:
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail=f"Customer with ID {customer_id} not found")
    return customer


def _get_job_rate_by_id(db: Session, job_rate_id: int) -> JobRate:
    job_rate = db.query(JobRate).filter(JobRate.id == job_rate_id).first()
    if not job_rate:
        raise HTTPException(status_code=404, detail=f"Job rate with ID {job_rate_id} not found")
    return job_rate


def get_job_by_id(db: Session, job_id: int, user_id: int = None):
    """Get a job by ID with authorization checks."""
    try:
        job = (
            db.query(Job)
            .options(
                joinedload(Job.assigned_ip),
                joinedload(Job.customer),
                joinedload(Job.job_rate),
            )
            .filter(Job.id == job_id)
            .first()
        )
        if not job:
            raise HTTPException(status_code=404, detail=f"Job with ID {job_id} not found")
        if user_id is not None and job.user_id != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to access this job")
        return job
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


def get_all_jobs(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    status: str = None,
    type: str = None,
    search: str = None,
    user_id: int = None,
    admin_id: int = None,
):
    """Get jobs with optional filtering."""
    try:
        query = db.query(Job).options(
            joinedload(Job.assigned_ip),
            joinedload(Job.customer),
            joinedload(Job.job_rate),
        )
        if user_id:
            query = query.filter(Job.user_id == user_id)
        if status:
            query = query.filter(Job.status == status)
        if type:
            query = query.join(Job.job_rate).filter(JobRate.job_type_name == type)
        if search:
            query = query.join(Job.customer).filter(
                or_(
                    Job.name.ilike(f"{search}%"),
                    Customer.name.ilike(f"{search}%"),
                    Customer.city.ilike(f"{search}%"),
                )
            )
        return query.distinct().offset(skip).limit(limit).all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


def create_job(db: Session, job: JobCreate, user_id: int, is_superadmin: bool = False):
    """Create a new job using canonical jobs/customers/job_rates tables."""
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
            job_data.pop("address", None)
            job_data.pop("city", None)
            job_data.pop("pincode", None)
        else:
            customer = _upsert_customer(
                db,
                customer_name=job_data.pop("customer_name", None),
                customer_phone=job_data.pop("customer_phone", None),
                address=job_data.pop("address", None),
                city=job_data.pop("city", None),
                pincode=job_data.pop("pincode", None),
            )

        job_rate_id = job_data.pop("job_rate_id", None)
        if job_rate_id is not None:
            job_rate = _get_job_rate_by_id(db, job_rate_id)
            # Keep type/rate in payload backward compatible, but canonical reference comes from job_rate_id.
            job_data.pop("type", None)
            job_data.pop("rate", None)
        else:
            job_rate = _upsert_job_rate(
                db,
                job_type=job_data.pop("type", None),
                rate=job_data.pop("rate", None),
            )

        db_job = Job(
            name=job_data.pop("name", None),
            customer_id=customer.id if customer else None,
            assigned_ip_id=job_data.pop("assigned_ip_id", None),
            status=job_data.pop("status", "created"),
            delivery_date=job_data.pop("delivery_date", None),
            additional_expense=job_data.pop("additional_expense", Decimal("0.00")),
            job_rate_id=job_rate.id if job_rate else None,
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

        db.add(
            JobStatusLog(
                job_id=db_job.id,
                status="created",
                created_at=datetime.utcnow(),
                notes="Job created",
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
        raise HTTPException(status_code=500, detail=f"Error creating job: {str(e)}")


def update_job(db: Session, job_id: int, job_update: JobUpdate, admin_id: int = None, is_superadmin: bool = False):
    """Update job details, customer, and job rate references."""
    try:
        db_job = (
            db.query(Job)
            .options(joinedload(Job.customer), joinedload(Job.job_rate))
            .filter(Job.id == job_id)
            .first()
        )
        if not db_job:
            raise HTTPException(status_code=404, detail=f"Job with ID {job_id} not found")

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
            update_data.pop("address", None)
            update_data.pop("city", None)
            update_data.pop("pincode", None)
        else:
            customer = _upsert_customer(
                db,
                customer_name=update_data.pop("customer_name", None),
                customer_phone=update_data.pop("customer_phone", None),
                address=update_data.pop("address", None),
                city=update_data.pop("city", None),
                pincode=update_data.pop("pincode", None),
                existing_customer=db_job.customer,
            )
            if customer:
                db_job.customer_id = customer.id

        job_rate_id_provided = "job_rate_id" in update_data
        job_rate_id = update_data.pop("job_rate_id", None)
        if job_rate_id_provided:
            db_job.job_rate_id = _get_job_rate_by_id(db, job_rate_id).id if job_rate_id is not None else None
            update_data.pop("type", None)
            update_data.pop("rate", None)
        else:
            job_rate = _upsert_job_rate(
                db,
                job_type=update_data.pop("type", None),
                rate=update_data.pop("rate", None),
                existing_rate=db_job.job_rate,
            )
            if job_rate:
                db_job.job_rate_id = job_rate.id

        if "size" in update_data:
            db_job.area = update_data.pop("size")

        field_map = {
            "name": "name",
            "status": "status",
            "start_date": "start_date",
            "delivery_date": "delivery_date",
            "checklist_link": "checklist_link",
            "google_map_link": "google_map_link",
            "additional_expense": "additional_expense",
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
        raise HTTPException(status_code=500, detail=f"Error updating job: {str(e)}")


def delete_job(db: Session, job_id: int, admin_id: int = None, is_superadmin: bool = False):
    """Delete a job and related runtime mappings."""
    try:
        db_job = db.query(Job).filter(Job.id == job_id).first()
        if not db_job:
            raise HTTPException(status_code=404, detail=f"Job with ID {job_id} not found")

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
        raise HTTPException(status_code=500, detail=f"Error deleting job: {str(e)}")


def start_job(db: Session, job_id: int, admin_id: int = None, is_superadmin: bool = False, notes: str = None):
    """Start/resume a job and assign IP."""
    try:
        db_job = db.query(Job).filter(Job.id == job_id).first()
        if not db_job:
            raise HTTPException(status_code=404, detail=f"Job with ID {job_id} not found")

        prev_status = db_job.status
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
        raise HTTPException(status_code=500, detail=f"Error starting job: {str(e)}")


def pause_job(db: Session, job_id: int, admin_id: int = None, is_superadmin: bool = False, notes: str = None):
    """Pause a job and unassign its IP."""
    try:
        db_job = db.query(Job).filter(Job.id == job_id).first()
        if not db_job:
            raise HTTPException(status_code=404, detail=f"Job with ID {job_id} not found")
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
        raise HTTPException(status_code=500, detail=f"Error pausing job: {str(e)}")


def finish_job(db: Session, job_id: int, admin_id: int = None, is_superadmin: bool = False, notes: str = None):
    """Finish a job and unassign its IP."""
    try:
        db_job = db.query(Job).filter(Job.id == job_id).first()
        if not db_job:
            raise HTTPException(status_code=404, detail=f"Job with ID {job_id} not found")
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
        raise HTTPException(status_code=500, detail=f"Error finishing job: {str(e)}")


def get_job_status_history(db: Session, job_id: int):
    """Get status history for a job."""
    try:
        db_job = db.query(Job).filter(Job.id == job_id).first()
        if not db_job:
            raise HTTPException(status_code=404, detail=f"Job with ID {job_id} not found")

        return (
            db.query(JobStatusLog)
            .filter(JobStatusLog.job_id == job_id)
            .order_by(JobStatusLog.created_at.desc())
            .all()
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching job status history: {str(e)}")
