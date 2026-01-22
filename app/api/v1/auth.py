from app.schemas.ip import UserResponse as IPUserResponse
from app.schemas.user import UserResponse as AdminUserResponse
from typing import Union
from app.model.user import User
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.database import get_db
from app.config import settings
from app.model.ip import ip

from app.schemas.ip import (
    UserRegistration, 
    LoginRequest, 
    OTPVerification,
    UserResponse,
)
from app.services.otp_service import OTPService
from app.utils.helpers import create_access_token
from app.utils.rate_limiter import limiter
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user_data: UserRegistration, db: Session = Depends(get_db)):
    """Register a new user"""
    
    # Check if user already exists
    existing_user = db.query(ip).filter(ip.phone_number == user_data.phone_number).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this phone_number number already exists"
        )
    
    # Create new ip
    new_user = ip(
        phone_number=user_data.phone_number,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        city=user_data.city,
        pincode=user_data.pincode,
        is_verified=False
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user


@router.post("/login")
@limiter.limit("5/minute")  # Max 5 login attempts per minute per IP
def login(request: Request, login_data: LoginRequest, db: Session = Depends(get_db)):
    """Login user and send OTP"""
    
    # Normalize phone_number number
    phone_number = login_data.phone_number
    if not phone_number.startswith('91') and len(phone_number) == 10:
        phone_number = '91' + phone_number
    
    # Check if user exists
    user = db.query(ip).filter(ip.phone_number == phone_number).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found. Please register first."
        )
    
    # Generate and send OTP
    # Extract first name from phone number or use default
    first_name = user.first_name.split()[0] if user.phone_number else "User"

    # otp_result = OTPService.send_otp(phone_number, first_name)
    otp_result = OTPService.send_otp(db, phone_number, first_name)

    if not otp_result["success"]:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send OTP. Please try again."
        )
    
    return {
        "message": "OTP sent successfully to your phone_number",
        "phone_number": phone_number
    }


@router.post("/verify-otp", response_model=UserResponse)
@limiter.limit("10/minute")  # Max 10 OTP verification attempts per minute per IP
def verify_otp(request: Request, otp_data: OTPVerification, response: Response, db: Session = Depends(get_db)):
    """Verify OTP and authenticate user"""
    
    # Normalize phone_number number
    phone_number = otp_data.phone_number
    if not phone_number.startswith('91') and len(phone_number) == 10:
        phone_number = '91' + phone_number
    
    # Check if user exists
    user = db.query(ip).filter(ip.phone_number == phone_number).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Verify OTP
    is_valid = OTPService.verify_otp(db, phone_number, otp_data.otp)
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP"
        )
    
    # Update user verification status
    user.is_verified = True
    user.verified_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    
    # Generate access token
    access_token = create_access_token(data={"sub": str(user.id)})
    
    # Set cookie
    response.set_cookie(
        key="access_token",
        value=f"Bearer {access_token}",
        httponly=True,
        samesite="lax",
        secure=settings.ENVIRONMENT == "production"  # Only True in production
    )
    
    return user


@router.post("/resend-otp")
@limiter.limit("3/minute")  # Max 3 resend attempts per minute per IP (stricter to prevent SMS bombing)
def resend_otp(request: Request, login_data: LoginRequest, db: Session = Depends(get_db)):
    """Resend OTP to user"""
    
    # Normalize phone_number number
    phone_number = login_data.phone_number
    if not phone_number.startswith('91') and len(phone_number) == 10:
        phone_number = '91' + phone_number
    
    # Check if user exists
    user = db.query(ip).filter(ip.phone_number == phone_number).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Generate and send OTP
    first_name = user.first_name.split()[0] if user.phone_number else "User"
    otp_result = OTPService.send_otp(db, phone_number, first_name)
    
    if not otp_result["success"]:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send OTP. Please try again."
        )
    
    return {
        "message": "OTP resent successfully",
        "phone_number": phone_number
    }


@router.get("/me", response_model=Union[IPUserResponse, AdminUserResponse])
def read_users_me(current_user: Union[ip, User] = Depends(get_current_user)):
    """Get current user"""
    return current_user
    

@router.post("/logout")
def logout(
    response: Response,
    current_user: Union[ip, User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    
    # Clear cookie first
    response.delete_cookie(key="access_token")
    
    if isinstance(current_user, ip):
        current_user.is_verified = False
        db.commit()
        message = f"User with phone number {current_user.phone_number} logged out successfully."
    elif isinstance(current_user, User):
        message = f"User with email {current_user.email} logged out successfully."
    else:
        # Fallback for any other user types that might be introduced
        message = "User logged out successfully."

    return {"message": message}