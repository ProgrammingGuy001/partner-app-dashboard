from fastapi import APIRouter, Depends, HTTPException, Response, status, Request
from sqlalchemy.orm import Session
from datetime import timedelta
from pydantic import BaseModel
from app.database import get_db
from app.schemas.user import UserCreate,UserResponse
from app.core.security import (
    clear_cookie,
    create_access_token,
    create_refresh_token,
    get_current_user,
    set_bearer_cookie,
    verify_hashed_password,
    verify_refresh_token_cookie,
    verify_token as security_verify_token,
)
from app.crud.user import get_user_by_email, create_user
from app.config import settings

from app.utils.rate_limiter import limiter

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(user: UserCreate, db: Session = Depends(get_db)):
    if get_user_by_email(db, user.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    new_user = create_user(db, user)
    return {"message": "User created successfully", "user": new_user.email}

class LoginRequest(BaseModel):
    email: str
    password: str

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

    return {"message": "Login successful"}


@router.get("/verify-token")
def verify_access_token(email: str = Depends(security_verify_token)):
    return {"valid": True, "email": email}


@router.post("/refresh-token")
def refresh_token(request: Request, response: Response):
    email = verify_refresh_token_cookie(request)

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": email}, expires_delta=access_token_expires)
    set_bearer_cookie(
        response,
        key=settings.ADMIN_AUTH_COOKIE_NAME,
        token=access_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )

    return {"message": "Token refreshed successfully"}


@router.get("/me", response_model=UserResponse)
def read_users_me(current_user: UserResponse = Depends(get_current_user)):
    return current_user


@router.post("/logout")
def logout(response: Response):
    """Clear the access_token and refresh_token cookies to log user out"""
    clear_cookie(response, key=settings.ADMIN_AUTH_COOKIE_NAME)
    clear_cookie(response, key="access_token")
    clear_cookie(response, key=settings.ADMIN_REFRESH_COOKIE_NAME)
    return {"message": "Logged out successfully"}
