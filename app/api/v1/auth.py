from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from app.database import get_db
from app.model.ip import ip

from app.schemas.ip import (
    UserRegistration, 
    LoginRequest, 
    OTPVerification,  
    UserResponse,
    TokenResponse
)
from app.services.otp_service import OTPService
from app.utils.helpers import create_access_token
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user_data: UserRegistration, db: Session = Depends(get_db)):
    """Register a new user"""
    
    # Check if user already exists
    existing_user = db.query(ip).filter(ip.phone_number == user_data.phone_number).first()
    print("user details", existing_user)
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
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
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


@router.post("/verify-otp", response_model=TokenResponse)
def verify_otp(otp_data: OTPVerification, db: Session = Depends(get_db)):
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
    user.verified_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    
    # Generate access token
    access_token = create_access_token(data={"sub": str(user.id)})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }


@router.post("/resend-otp")
def resend_otp(login_data: LoginRequest, db: Session = Depends(get_db)):
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


@router.post("/logout")
def logout(
    current_user: ip = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    
    # Optionally log the logout time for audit purposes
    #current_user.last_logout_at = datetime.utcnow()
    current_user.is_verified = False
    db.commit()
    
    return {
        "message": f"User with phone_number {current_user.phone_number} logged out successfully.",
        "logout_time": current_user.last_logout_at
    }