from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.model.ip import ip
from app.model.user import User
from app.utils.helpers import verify_token
from app.api.cookie_security import cookie_bearer
from typing import Union

def get_current_user(
    token: str = Depends(cookie_bearer),
    db: Session = Depends(get_db)
) -> Union[ip, User]:
    """Dependency to get current authenticated user (IP or Admin)"""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
        
    # The token is in the format "Bearer <token>"
    parts = token.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format"
        )
    
    token = parts[1]
    
    payload = verify_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload"
        )
    
    # Try to parse as integer (IP user ID)
    # If sub is email (e.g. "a@gmail.com"), int() will raise ValueError
    try:
        user_id = int(sub)
        user = db.query(ip).filter(ip.id == user_id).first()
        if user is not None:
            return user
    except (ValueError, TypeError):
        # Not an integer ID, continue to check as email
        pass
    
    # Try as email (Admin user)
    admin_user = db.query(User).filter(User.email == sub).first()
    if admin_user is not None:
        if not admin_user.isActive:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is inactive"
            )
        if not admin_user.isApproved:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not approved"
            )
        return admin_user
    
    # Neither IP nor Admin user found
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="User not found"
    )


def get_verified_user(current_user: Union[ip, User] = Depends(get_current_user)) -> ip:
    """Dependency to ensure user has verified their phone (IP Only)"""
    if isinstance(current_user, User):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin users cannot access this resource"
        )
        
    # Now we know it's an IP user
    if not current_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Phone number not verified. Please verify your OTP first."
        )
    return current_user