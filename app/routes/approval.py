from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from app.database import get_db
from app.crud.ip import verify_ip_user, get_ip_by_phone, get_all_ips, get_approved_ips
from app.core.security import get_current_user
from app.model.user import User
from app.model.ip import ip, IPAdminAssignment

router = APIRouter(prefix="/admin", tags=["Admin"])


class VerifyIPRequest(BaseModel):
    admin_ids: Optional[List[int]] = None


class AdminUserResponse(BaseModel):
    id: int
    email: str
    isActive: bool
    isApproved: bool
    is_superadmin: bool

    class Config:
        from_attributes = True


class AssignAdminRequest(BaseModel):
    admin_ids: List[int]


def _serialize_ip_user(ip_user: ip) -> dict:
    return {
        "id": ip_user.id,
        "phone_number": ip_user.phone_number,
        "first_name": ip_user.first_name,
        "last_name": ip_user.last_name,
        "city": ip_user.city,
        "pincode": ip_user.pincode,
        "is_assigned": ip_user.is_assigned,
        "is_verified": ip_user.is_verified,
        "is_pan_verified": ip_user.is_pan_verified,
        "is_bank_details_verified": ip_user.is_bank_details_verified,
        "is_id_verified": ip_user.is_id_verified,
        "pan_number": ip_user.pan_number,
        "pan_name": ip_user.pan_name,
        "account_number": ip_user.account_number,
        "ifsc_code": ip_user.ifsc_code,
        "account_holder_name": ip_user.account_holder_name,
        "registered_at": ip_user.registered_at,
        "verified_at": ip_user.verified_at,
        "assigned_admin_ids": [a.admin_id for a in ip_user.admin_assignments],
    }


@router.post("/verify-ip/{phone_number}")
def verify_ip(
    phone_number: str,
    request: VerifyIPRequest = VerifyIPRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Verify an IP user and optionally assign admins to manage them"""
    db_ip = get_ip_by_phone(db, phone_number)
    if not db_ip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="IP user not found"
        )
    
    verified_ip = verify_ip_user(db, phone_number)
    
    # Assign admins if provided
    if request.admin_ids:
        # Clear existing assignments
        db.query(IPAdminAssignment).filter(IPAdminAssignment.ip_id == verified_ip.id).delete()
        
        # Add new assignments
        for admin_id in request.admin_ids:
            admin = db.query(User).filter(User.id == admin_id).first()
            if not admin:
                raise HTTPException(status_code=404, detail=f"Admin with ID {admin_id} not found")
            assignment = IPAdminAssignment(ip_id=verified_ip.id, admin_id=admin_id)
            db.add(assignment)
        db.commit()
    
    # Get assigned admin IDs
    assigned_admins = db.query(IPAdminAssignment).filter(IPAdminAssignment.ip_id == verified_ip.id).all()
    assigned_admin_ids = [a.admin_id for a in assigned_admins]
    
    return {
        "message": "IP user verified successfully",
        "phone_number": verified_ip.phone_number,
        "is_id_verified": verified_ip.is_id_verified,
        "is_verified": verified_ip.is_verified,
        "is_pan_verified": verified_ip.is_pan_verified,
        "is_bank_details_verified": verified_ip.is_bank_details_verified,
        "assigned_admin_ids": assigned_admin_ids
    }


@router.get("/ips")
def get_ips(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get all IPs with their assigned admin IDs"""
    is_superadmin = getattr(current_user, 'is_superadmin', False)

    if is_superadmin:
        ips = db.query(ip).all()
    else:
        ips = get_all_ips(db, admin_id=current_user.id)
    
    return [_serialize_ip_user(ip_user) for ip_user in ips]


@router.get("/ips/approved")
def get_approved_ips_list(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get only approved/verified IPs for job assignment dropdown.
    Superadmins see all approved IPs, regular admins only see IPs assigned to them.
    """
    is_superadmin = getattr(current_user, 'is_superadmin', False)
    
    if is_superadmin:
        # Superadmins see all approved IPs
        approved_ips = db.query(ip).filter(ip.is_id_verified == True).all()
    else:
        # Regular admins only see IPs assigned to them that are approved
        approved_ips = get_approved_ips(db, admin_id=current_user.id)

    return [_serialize_ip_user(ip_user) for ip_user in approved_ips]


@router.get("/admin-users", response_model=List[AdminUserResponse])
def get_admin_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get list of admin users for IP assignment dropdown"""
    return db.query(User).filter(User.isActive == True, User.isApproved == True).all()


@router.post("/ips/{ip_id}/assign-admins")
def assign_admins_to_ip(
    ip_id: int,
    request: AssignAdminRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Assign multiple admins to an IP"""
    # Get IP
    ip_user = db.query(ip).filter(ip.id == ip_id).first()
    if not ip_user:
        raise HTTPException(status_code=404, detail="IP not found")
    
    # Check if current user is superadmin
    if not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Only superadmins can assign admins to IPs")
    
    # Clear existing assignments
    db.query(IPAdminAssignment).filter(IPAdminAssignment.ip_id == ip_id).delete()
    
    # Add new assignments
    for admin_id in request.admin_ids:
        admin = db.query(User).filter(User.id == admin_id).first()
        if not admin:
            raise HTTPException(status_code=404, detail=f"Admin with ID {admin_id} not found")
        assignment = IPAdminAssignment(ip_id=ip_id, admin_id=admin_id)
        db.add(assignment)
    
    db.commit()
    
    return {"message": "Admins assigned successfully", "ip_id": ip_id, "admin_ids": request.admin_ids}


@router.get("/ips/{ip_id}/admins")
def get_ip_admins(ip_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get list of admins assigned to an IP"""
    ip_user = db.query(ip).filter(ip.id == ip_id).first()
    if not ip_user:
        raise HTTPException(status_code=404, detail="IP not found")
    
    assignments = db.query(IPAdminAssignment).filter(IPAdminAssignment.ip_id == ip_id).all()
    admin_ids = [a.admin_id for a in assignments]
    
    admins = db.query(User).filter(User.id.in_(admin_ids)).all() if admin_ids else []
    
    return [AdminUserResponse.model_validate(admin) for admin in admins]
