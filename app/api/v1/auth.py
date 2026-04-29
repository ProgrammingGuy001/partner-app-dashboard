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
from app.core.security import (
    clear_cookie,
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
    set_bearer_cookie,
    strip_bearer_prefix,
)

from app.schemas.ip import (
    UserRegistration,
    LoginRequest,
    OTPVerification,
    RefreshTokenRequest,
    UserResponse,
    MobileAuthResponse,
    RefreshTokenResponse,
)
from app.services.otp_service import OTPService
from app.utils.rate_limiter import limiter
from app.api.deps import get_current_user
from app.api.cookie_security import cookie_bearer

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
        pincode=int(user_data.pincode),
        is_phone_verified=False,
        is_internal=user_data.is_internal
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


@router.post("/verify-otp", response_model=MobileAuthResponse)
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
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    set_bearer_cookie(response, key=settings.IP_AUTH_COOKIE_NAME, token=access_token)
    set_bearer_cookie(
        response,
        key=settings.IP_REFRESH_COOKIE_NAME,
        token=refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )

    # Return user with tokens for mobile app (cookies don't work well on mobile)
    return {
        **UserResponse.model_validate(user).model_dump(),
        "access_token": access_token,
        "refresh_token": refresh_token
    }


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


@router.get("/verify-token")
def verify_access_token(token: str | None = Depends(cookie_bearer)):
    if not token:
        raise HTTPException(status_code=401, detail="No token provided")

    payload = decode_access_token(strip_bearer_prefix(token))
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return {"valid": True, "user_id": payload["sub"]}


@router.post("/refresh-token", response_model=RefreshTokenResponse)
def refresh_token(
    request: Request,
    response: Response,
    refresh_data: RefreshTokenRequest | None = None,
):
    refresh_token_cookie = request.cookies.get(settings.IP_REFRESH_COOKIE_NAME)
    provided_refresh_token = refresh_data.refresh_token if refresh_data else None
    refresh_token_value = refresh_token_cookie or provided_refresh_token

    if not refresh_token_value:
        raise HTTPException(status_code=401, detail="No refresh token provided")

    refresh_token_value = strip_bearer_prefix(refresh_token_value)

    payload = decode_refresh_token(refresh_token_value)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    sub = payload["sub"]
    access_token = create_access_token(data={"sub": sub})
    new_refresh_token = create_refresh_token(data={"sub": sub})
    set_bearer_cookie(response, key=settings.IP_AUTH_COOKIE_NAME, token=access_token)
    set_bearer_cookie(
        response,
        key=settings.IP_REFRESH_COOKIE_NAME,
        token=new_refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )

    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
    }


@router.get("/me", response_model=Union[IPUserResponse, AdminUserResponse])
def read_users_me(current_user: Union[ip, User] = Depends(get_current_user)):
    """Get current user"""
    return current_user


@router.post("/logout")
def logout(
    response: Response,
    current_user: Union[ip, User] = Depends(get_current_user),
):

    # Clear cookie first
    clear_cookie(response, key=settings.IP_AUTH_COOKIE_NAME)
    # Legacy cleanup for older cookie name.
    clear_cookie(response, key="access_token")
    clear_cookie(response, key=settings.IP_REFRESH_COOKIE_NAME)

    if isinstance(current_user, ip):
        # Do NOT reset is_phone_verified — that flag records a permanent one-time
        # verification of the phone number. Session termination is handled entirely
        # by the deleted cookies and JWT expiry above.
        message = f"User with phone number {current_user.phone_number} logged out successfully."
    elif isinstance(current_user, User):
        message = f"User with email {current_user.email} logged out successfully."
    else:
        # Fallback for any other user types that might be introduced
        message = "User logged out successfully."

    return {"message": message}
