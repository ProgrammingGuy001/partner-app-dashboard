
from sqlalchemy import Integer, String, Boolean, DateTime, ForeignKey, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from typing import List
from app.database import Base


# Many-to-many relationship table for IP-Admin assignments
class IPAdminAssignment(Base):
    __tablename__ = "ip_admin_assignments"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ip_id: Mapped[int] = mapped_column(Integer, ForeignKey("ip.id"), nullable=False)
    admin_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class ip(Base):
    __tablename__ = "ip"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, index=True)
    phone_number: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False)
    city: Mapped[str] = mapped_column(String, nullable=False)
    pincode: Mapped[str] = mapped_column(String, nullable=False)
    is_assigned:Mapped[bool]=mapped_column(Boolean,default=False, index=True)

    # Verification flags
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_pan_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_bank_details_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_id_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    otp: Mapped[str | None] = mapped_column(String, nullable=True)
    otp_expiry: Mapped[datetime | None] = mapped_column(DateTime(timezone= True), nullable=True)

    # Verification details
    pan_number: Mapped[str | None] = mapped_column(String, nullable=True)
    pan_name: Mapped[str | None] = mapped_column(String, nullable=True)
    account_number: Mapped[str | None] = mapped_column(String, nullable=True)
    ifsc_code: Mapped[str | None] = mapped_column(String, nullable=True)
    account_holder_name: Mapped[str | None] = mapped_column(String, nullable=True)

    # Timestamps
    registered_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    
    # Relationships
    admin_assignments: Mapped[List["IPAdminAssignment"]] = relationship(
        "IPAdminAssignment", backref="ip", cascade="all, delete-orphan"
    )
    
    def __repr__(self):
        return f"<User {self.phone_number}>"

