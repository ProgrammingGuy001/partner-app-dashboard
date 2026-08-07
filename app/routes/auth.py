from fastapi import APIRouter, Depends, HTTPException, Response, status, Request
from sqlalchemy.orm import Session
from datetime import timedelta
from pydantic import BaseModel
from app.database import get_db
from app.schemas.user import UserResponse, UserNameUpdate
from app.core.security import (
    clear_cookie,
    consume_refresh_token,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    get_current_user,
    hash_password,
    revoke_refresh_tokens,
    set_bearer_cookie,
    store_refresh_token,
    strip_bearer_prefix,
    verify_hashed_password,
    verify_token as security_verify_token,
)
from app.crud.user import get_user_by_email
from app.model.user import User
from app.routes.dev import log_dev_action
from app.config import settings

from app.utils.rate_limiter import limiter

router = APIRouter(prefix="/auth", tags=["Auth"])

class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str | None = None


class TokenResponse(BaseModel):
    message: str
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"

@router.post("/login")
@limiter.limit("5/minute")
def login(request: Request, response: Response, login_data: LoginRequest, db: Session = Depends(get_db)):
    user = get_user_by_email(db, login_data.email)
    if not user or not verify_hashed_password(login_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.isApproved or not user.isActive:
        raise HTTPException(status_code=401, detail="User not approved or inactive")
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": user.email}, expires_delta=access_token_expires)
    refresh_token = create_refresh_token(data={"sub": user.email})
    store_refresh_token(db, user.email, refresh_token)
    set_bearer_cookie(
        response,
        key=settings.ADMIN_AUTH_COOKIE_NAME,
        token=access_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    set_bearer_cookie(
        response,
        key=settings.ADMIN_REFRESH_COOKIE_NAME,
        token=refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )

    return {
        "message": "Login successful",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.get("/verify-token")
def verify_access_token(email: str = Depends(security_verify_token)):
    return {"valid": True, "email": email}


@router.post("/refresh-token")
def refresh_token(
    request: Request,
    response: Response,
    refresh_data: RefreshTokenRequest | None = None,
    db: Session = Depends(get_db),
):
    refresh_token_value = request.cookies.get(settings.ADMIN_REFRESH_COOKIE_NAME)
    if not refresh_token_value:
        refresh_token_value = refresh_data.refresh_token if refresh_data else None

    normalized_refresh_token = strip_bearer_prefix(refresh_token_value)
    payload = decode_refresh_token(normalized_refresh_token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token" if refresh_token_value else "No refresh token provided",
        )

    email: str | None = payload.get("sub")
    if email is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )

    # Single-use rotation backed by the server-side token store.
    if not consume_refresh_token(db, normalized_refresh_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": email}, expires_delta=access_token_expires)
    new_refresh_token = create_refresh_token(data={"sub": email})
    store_refresh_token(db, email, new_refresh_token)
    set_bearer_cookie(
        response,
        key=settings.ADMIN_AUTH_COOKIE_NAME,
        token=access_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    set_bearer_cookie(
        response,
        key=settings.ADMIN_REFRESH_COOKIE_NAME,
        token=new_refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )

    return {
        "message": "Token refreshed successfully",
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
    }


@router.get("/me", response_model=UserResponse)
def read_users_me(current_user: UserResponse = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
def update_my_profile(
    data: UserNameUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Let an admin set their own display name (used wherever they're shown as job supervisor)."""
    current_user.name = data.name.strip()
    db.commit()
    db.refresh(current_user)
    return current_user


class ResetPasswordRequest(BaseModel):
    email: str
    new_password: str


@router.post("/admin/reset-password")
@limiter.limit("10/minute")
def reset_password(
    request: Request,
    reset_data: ResetPasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Superadmin or dev: reset another admin's password.

    Only updates the target admin's password column — no other data touched.
    """
    if not (current_user.is_superadmin or current_user.is_dev):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only superadmins can reset passwords",
        )

    if len(reset_data.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters",
        )

    target = get_user_by_email(db, reset_data.email)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin not found",
        )

    target.password = hash_password(reset_data.new_password)
    if current_user.is_dev:
        log_dev_action(db, current_user, "reset_password", target.email)
    db.commit()

    # Kill any live sessions issued before the reset.
    revoke_refresh_tokens(db, target.email)

    return {
        "message": "Password reset successfully",
        "email": target.email,
    }


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    """Clear auth cookies and revoke the session's refresh tokens."""
    clear_cookie(response, key=settings.ADMIN_AUTH_COOKIE_NAME)
    clear_cookie(response, key="access_token")
    clear_cookie(response, key=settings.ADMIN_REFRESH_COOKIE_NAME)

    # Best-effort revocation: decode the refresh cookie to find the subject.
    payload = decode_refresh_token(
        strip_bearer_prefix(request.cookies.get(settings.ADMIN_REFRESH_COOKIE_NAME))
    )
    if payload and payload.get("sub"):
        revoke_refresh_tokens(db, payload["sub"])

    return {"message": "Logged out successfully"}
