from sqlalchemy.orm import Session
from app.model.job import Job
from app.model.ip import ip
from fastapi import HTTPException
from app.utils.ip_assignment import is_admin_allowed_for_ip
from datetime import datetime, timezone

def get_ip_by_id(db:Session,id:int):
    return db.query(ip).filter(ip.id==id).first()

def get_ip_by_phone(db: Session, phone_number: str):
    return db.query(ip).filter(ip.phone_number == phone_number).first()

def get_all_ips(db: Session, admin_id: int):
    return db.query(ip).filter(
        ip.admin_assignments.any(admin_id=admin_id)
    ).all()

def get_approved_ips(db: Session, admin_id: int):
    return db.query(ip).filter(
        ip.is_id_verified == True,
        ip.admin_assignments.any(admin_id=admin_id)
    ).all()
    
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

def assign_ip(db: Session, ip_id: int, admin_id: int, is_superadmin: bool = False, commit: bool = True):
    try:
        ip_user = db.query(ip).filter(ip.id == ip_id).with_for_update().first()
        
        if not ip_user:
            raise HTTPException(status_code=404, detail=f"IP with ID {ip_id} not found")
        
        if ip_user.is_assigned:
            active_job = db.query(Job).filter(
                Job.assigned_ip_id == ip_id, 
                Job.status == 'in_progress'
            ).first()
            
            error_detail = f"IP {ip_id} is already assigned to another job"
            if active_job:
                error_detail += f" (Job ID: {active_job.id}, Name: {active_job.name})"
            
            raise HTTPException(status_code=400, detail=error_detail)
        if not is_superadmin and not is_admin_allowed_for_ip(db, ip_id, admin_id):
            raise HTTPException(status_code=403, detail=f"Admin {admin_id} is not allowed to be assigned IP {ip_id}")
        
        
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
        raise HTTPException(status_code=500, detail=f"Error assigning IP: {str(e)}")

def unassign_ip(db: Session, ip_id: int, admin_id: int, is_superadmin: bool = False, commit: bool = True):
    """Unassign an IP from a job - marks is_assigned=False"""
    try:
        ip_user = db.query(ip).filter(ip.id == ip_id).first()
        if not ip_user:
            raise HTTPException(status_code=404, detail=f"IP with ID {ip_id} not found")
        if not is_superadmin and not is_admin_allowed_for_ip(db, ip_id, admin_id):
            raise HTTPException(status_code=403, detail=f"Admin {admin_id} is not allowed to be unassigned IP {ip_id}")
        
        ip_user.is_assigned = False
        
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
        raise HTTPException(status_code=500, detail=f"Error unassigning IP: {str(e)}")

def check_ip_available(db: Session, ip_id: int) -> bool:
    """Check if an IP is available (exists and not assigned)"""
    ip_user = db.query(ip).filter(ip.id == ip_id).first()
    if not ip_user:
        raise HTTPException(status_code=404, detail=f"IP with ID {ip_id} not found")
    return not ip_user.is_assigned
