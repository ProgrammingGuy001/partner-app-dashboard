from sqlalchemy.orm import Session
from app.model.ip import ip as IPUser
from fastapi import HTTPException

def get_ip_user_by_id(db:Session,id:int):
    return db.query(IPUser).filter(IPUser.id==id).first()

def get_ip_user_by_phone(db: Session, phone_number: str):
    return db.query(IPUser).filter(IPUser.phone_number == phone_number).first()

def get_all_ip_users(db: Session):
    return db.query(IPUser).all()

def verify_ip_user(db: Session, phone_number: str):
    db_ip_user = get_ip_user_by_phone(db, phone_number)
    if db_ip_user:
        db_ip_user.is_id_verified = True
        db.commit()
        db.refresh(db_ip_user)
    return db_ip_user

def assign_ip_user(db: Session, ip_user_id: int, commit: bool = True):
    """Assign an IPUser to a job - marks is_assigned=True"""
    try:
        ip_user = db.query(IPUser).filter(IPUser.id == ip_user_id).first()
        if not ip_user:
            raise HTTPException(status_code=404, detail=f"IPUser with ID {ip_user_id} not found")
        
        if ip_user.is_assigned:
            raise HTTPException(status_code=400, detail=f"IPUser {ip_user_id} is already assigned to another job")
        
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
        raise HTTPException(status_code=500, detail=f"Error assigning IPUser: {str(e)}")

def unassign_ip_user(db: Session, ip_user_id: int, commit: bool = True):
    """Unassign an IPUser from a job - marks is_assigned=False"""
    try:
        ip_user = db.query(IPUser).filter(IPUser.id == ip_user_id).first()
        if not ip_user:
            raise HTTPException(status_code=404, detail=f"IPUser with ID {ip_user_id} not found")
        
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
        raise HTTPException(status_code=500, detail=f"Error unassigning IPUser: {str(e)}")

def check_ip_user_available(db: Session, ip_user_id: int) -> bool:
    """Check if an IPUser is available (exists and not assigned)"""
    ip_user = db.query(IPUser).filter(IPUser.id == ip_user_id).first()
    if not ip_user:
        raise HTTPException(status_code=404, detail=f"IPUser with ID {ip_user_id} not found")
    return not ip_user.is_assigned
