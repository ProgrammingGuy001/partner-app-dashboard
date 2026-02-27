from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship, synonym
from typing import List
from app.database import Base
from app.model.job import Job


class User(Base):
    __tablename__ = "admin"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=True)
    password: Mapped[str] = mapped_column(String, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    is_superadmin: Mapped[bool] = mapped_column(Boolean, default=False)

    # Compatibility aliases for existing code paths.
    hashed_password = synonym("password")
    isActive = synonym("is_active")
    isApproved = synonym("is_approved")

    jobs: Mapped[List["Job"]] = relationship("Job", back_populates="user")
    ip_assignments: Mapped[List["IPAdminAssignment"]] = relationship(
        "IPAdminAssignment", back_populates="admin"
    )
