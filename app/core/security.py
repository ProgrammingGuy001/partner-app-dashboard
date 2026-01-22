from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
from app.config import settings
from app.database import get_db
from app.model.user import User

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
# Keep HTTPBearer for Swagger UI support if needed, but we'll manually check cookie
security = HTTPBearer(auto_error=False)

def hash_password(password:str)->str:
    return pwd_context.hash(password)

def verify_hashed_password(password:str,hashed_password:str)->bool:
    return pwd_context.verify(password,hashed_password)

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def verify_token(request: Request, credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    token = request.cookies.get("access_token")
    
    # Fallback to header if cookie is missing (e.g. mobile app or Swagger)
    if not token and credentials:
        token = credentials.credentials
        
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    # Remove 'Bearer ' prefix if present in cookie
    if token.startswith("Bearer "):
        token = token.replace("Bearer ", "")
        
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return email
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_current_user(email: str = Depends(verify_token), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials"
        )
    if not user.isActive:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    if not user.isApproved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not approved"
        )
    return user
    