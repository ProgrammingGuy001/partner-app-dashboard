import logging
from sqlalchemy.orm import Session
from app.model.job import Job
from app.model.ip import ip
from fastapi import HTTPException
from app.utils.ip_assignment import is_admin_allowed_for_ip
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def get_ip_by_id(db: Session, id: int):
    return db.query(ip).filter(ip.id == id).first()


def get_ip_by_phone(db: Session, phone_number: str):
    return db.query(ip).filter(ip.phone_number == phone_number).first()


def get_all_ips(db: Session, admin_id: int):
    return db.query(ip).filter(ip.admin_assignments.any(admin_id=admin_id)).all()


def get_approved_ips(db: Session, admin_id: int):
    return (
        db.query(ip)
        .filter(
            ip.is_id_verified.is_(True), ip.admin_assignments.any(admin_id=admin_id)
        )
        .all()
    )


def verify_ip_user(db: Session, phone_number: str):
    db_ip = get_ip_by_phone(db, phone_number)
    if db_ip:
        db_ip.is_id_verified = True
        db_ip.is_verified = True
        db_ip.is_pan_verified = True
        db_ip.is_bank_details_verified = True
        db_ip.verified_at = datetime.now(timezone.utc)
        if db_ip.financial:
            db_ip.financial.is_verified = True
        db.commit()
        db.refresh(db_ip)

    return db_ip


def assign_ip(
    db: Session,
    ip_id: int,
    admin_id: int,
    is_superadmin: bool = False,
    commit: bool = True,
):
    """Mark an IP as working; schedule conflicts are enforced by roster slots."""
    try:
        ip_user = db.query(ip).filter(ip.id == ip_id).with_for_update().first()

        if not ip_user:
            raise HTTPException(status_code=404, detail=f"IP with ID {ip_id} not found")

        if not is_superadmin and not is_admin_allowed_for_ip(db, ip_id, admin_id):
            raise HTTPException(
                status_code=403,
                detail=f"Admin {admin_id} is not allowed to be assigned IP {ip_id}",
            )

        ip_user.is_assigned = True

        if commit:
            db.commit()
            db.refresh(ip_user)
        else:
            db.flush()  # Flush changes without committing

        return ip_user
    except HTTPException:
        raise
    except Exception as e:
        if commit:
            db.rollback()
        logger.exception("Error assigning IP")
        raise HTTPException(status_code=500, detail="Could not assign the IP.") from e


def unassign_ip(
    db: Session,
    ip_id: int,
    admin_id: int,
    is_superadmin: bool = False,
    commit: bool = True,
    excluding_job_id: int | None = None,
):
    """Refresh whether an IP still has another in-progress job."""
    try:
        ip_user = db.query(ip).filter(ip.id == ip_id).with_for_update().first()
        if not ip_user:
            raise HTTPException(status_code=404, detail=f"IP with ID {ip_id} not found")
        if not is_superadmin and not is_admin_allowed_for_ip(db, ip_id, admin_id):
            raise HTTPException(
                status_code=403,
                detail=f"Admin {admin_id} is not allowed to be unassigned IP {ip_id}",
            )

        active_jobs = db.query(Job.id).filter(
            Job.assigned_ip_id == ip_id,
            Job.status == "in_progress",
        )
        if excluding_job_id is not None:
            active_jobs = active_jobs.filter(Job.id != excluding_job_id)
        ip_user.is_assigned = active_jobs.first() is not None

        if commit:
            db.commit()
            db.refresh(ip_user)
        else:
            db.flush()  # Flush changes without committing

        return ip_user
    except HTTPException:
        raise
    except Exception as e:
        if commit:
            db.rollback()
        logger.exception("Error unassigning IP")
        raise HTTPException(status_code=500, detail="Could not unassign the IP.") from e
