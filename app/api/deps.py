from typing import Union

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.cookie_security import cookie_bearer
from app.core.security import decode_access_token, strip_bearer_prefix
from app.database import get_db
from app.model.ip import ip
from app.model.user import User

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

    payload = decode_access_token(strip_bearer_prefix(token))
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

    try:
        user_id = int(sub)
        user = db.scalar(
            select(ip)
            .options(selectinload(ip.financial))
            .where(ip.id == user_id)
        )
        if user is not None:
            return user
    except (ValueError, TypeError):
        pass

    admin_user = db.scalar(select(User).where(User.email == sub))
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


def get_fully_verified_user(current_user: ip = Depends(get_verified_user)) -> ip:
    """Dependency to ensure user has completed ALL verifications including admin ID approval"""
    if not current_user.is_pan_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="PAN not verified. Please complete PAN verification."
        )
    if not current_user.is_bank_details_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bank details not verified. Please complete bank verification."
        )
    if not current_user.is_id_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ID not verified. Please wait for admin approval."
        )
    return current_user
