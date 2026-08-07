import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.model.refresh_token import RefreshToken
from app.model.user import User

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_hashed_password(password: str, hashed_password: str) -> bool:
    return pwd_context.verify(password, hashed_password)


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS))
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def _refresh_token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def store_refresh_token(db: Session, subject: str, token: str) -> None:
    """Persist a hash of an issued refresh token so logout/rotation can revoke it."""
    now = datetime.now(timezone.utc)
    # Opportunistic cleanup of this subject's expired rows.
    db.query(RefreshToken).filter(
        RefreshToken.subject == subject, RefreshToken.expires_at < now
    ).delete(synchronize_session=False)
    db.add(
        RefreshToken(
            subject=subject,
            token_hash=_refresh_token_hash(token),
            expires_at=now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        )
    )
    db.commit()


def consume_refresh_token(db: Session, token: str) -> bool:
    """Single-use check: True and delete the row if the token is known and unexpired."""
    row = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == _refresh_token_hash(token))
        .first()
    )
    if row is None:
        return False
    expires_at = row.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    valid = expires_at >= datetime.now(timezone.utc)
    db.delete(row)
    db.commit()
    return valid


def revoke_refresh_tokens(db: Session, subject: str) -> None:
    """Revoke every refresh token for a subject (logout / password reset)."""
    db.query(RefreshToken).filter(RefreshToken.subject == subject).delete(
        synchronize_session=False
    )
    db.commit()


def strip_bearer_prefix(token: str | None) -> str | None:
    if not token:
        return None
    if token.startswith("Bearer "):
        return token.replace("Bearer ", "", 1)
    return token


def decode_token(token: str | None, *, expected_type: str) -> dict[str, Any] | None:
    normalized_token = strip_bearer_prefix(token)
    if not normalized_token:
        return None

    try:
        payload = jwt.decode(normalized_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None

    token_type = payload.get("type")
    if token_type != expected_type:
        return None
    return payload


def decode_access_token(token: str | None) -> dict[str, Any] | None:
    return decode_token(token, expected_type="access")


def decode_refresh_token(token: str | None) -> dict[str, Any] | None:
    return decode_token(token, expected_type="refresh")


def get_cookie_security_settings() -> tuple[bool, str]:
    secure = settings.is_secure_cookie_environment
    return secure, "none" if secure else "lax"


def set_bearer_cookie(response: Response, *, key: str, token: str, max_age: int | None = None) -> None:
    secure, samesite = get_cookie_security_settings()
    response.set_cookie(
        key=key,
        value=f"Bearer {token}",
        httponly=True,
        secure=secure,
        samesite=samesite,
        max_age=max_age,
    )


def clear_cookie(response: Response, *, key: str) -> None:
    secure, samesite = get_cookie_security_settings()
    response.delete_cookie(
        key=key,
        httponly=True,
        secure=secure,
        samesite=samesite,
    )


def verify_token(request: Request, credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    token = request.cookies.get(settings.ADMIN_AUTH_COOKIE_NAME)

    # Legacy fallback for existing sessions before cookie split.
    if not token:
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

    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    email: str | None = payload.get("sub")
    if email is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return email

def verify_refresh_token_cookie(request: Request):
    token = request.cookies.get(settings.ADMIN_REFRESH_COOKIE_NAME)
    payload = decode_refresh_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token" if token else "No refresh token provided",
        )

    email: str | None = payload.get("sub")
    if email is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )
    return email

def get_current_user(email: str = Depends(verify_token), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).one_or_none()
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


def generate_service_token():
    payload = {
        "iss": "modulaPartner",
        "aud": "ModulaCare",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=2),
    }
    return jwt.encode(payload, settings.SERVICE_SECRET_KEY, algorithm=settings.ALGORITHM)
