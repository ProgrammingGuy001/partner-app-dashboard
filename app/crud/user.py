from sqlalchemy import func
from sqlalchemy.orm import Session
from app.model.user import User
from app.schemas.user import UserCreate
from app.core.security import hash_password

def create_user(db: Session, user: UserCreate):
    db_user = User(email=user.email.lower(), hashed_password=hash_password(user.password))
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(func.lower(User.email) == email.lower()).first()
