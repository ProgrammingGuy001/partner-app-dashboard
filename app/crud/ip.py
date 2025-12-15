from sqlalchemy.orm import Session
from app.model.ip import ip
from fastapi import HTTPException

def get_ip_by_id(db:Session,id:int):
    return db.query(ip).filter(ip.id==id).first()

def get_ip_by_phone(db: Session, phone_number: str):
    return db.query(ip).filter(ip.phone_number == phone_number).first()

def get_all_ips(db: Session):
    return db.query(ip).all()

def get_approved_ips(db: Session):
    """Get only approved/verified IPs for dropdown"""
    return db.query(ip).filter(ip.is_id_verified == True).all()

def verify_ip_user(db: Session, phone_number: str):
    db_ip = get_ip_by_phone(db, phone_number)
    if db_ip:
        db_ip.is_id_verified = True
        db_ip.is_verified = True
        db_ip.is_pan_verified = True
        db_ip.is_bank_details_verified = True
        db.commit()
        db.refresh(db_ip)
    return db_ip

def assign_ip(db: Session, ip_id: int, commit: bool = True):
    """Assign an IP to a job - marks is_assigned=True"""
    try:
        ip_user = db.query(ip).filter(ip.id == ip_id).first()
        if not ip_user:
            raise HTTPException(status_code=404, detail=f"IP with ID {ip_id} not found")
        
        if ip_user.is_assigned:
            raise HTTPException(status_code=400, detail=f"IP {ip_id} is already assigned to another job")
        
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

def unassign_ip(db: Session, ip_id: int, commit: bool = True):
    """Unassign an IP from a job - marks is_assigned=False"""
    try:
        ip_user = db.query(ip).filter(ip.id == ip_id).first()
        if not ip_user:
            raise HTTPException(status_code=404, detail=f"IP with ID {ip_id} not found")
        
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