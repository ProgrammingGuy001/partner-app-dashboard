from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session
from datetime import timedelta
from pydantic import BaseModel
from app.database import get_db
from app.schemas.user import UserCreate
from app.core.security import verify_hashed_password, create_access_token
from app.crud.user import get_user_by_email, create_user
from app.config import settings

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
def login(request: LoginRequest, db: Session = Depends(get_db),status_code=status.HTTP_200_OK):
    user = get_user_by_email(db, request.email)
    if not user or not verify_hashed_password(request.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.isApproved or not user.isActive:
        raise HTTPException(status_code=401, detail="User not approved or inactive")
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": user.email}, expires_delta=access_token_expires)
    
    return {"access_token": access_token, "token_type": "bearer"}