
from sqlalchemy import Integer, String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from app.database import Base


class ip(Base):
    __tablename__ = "ip"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, index=True)
    phone_number: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False)
    city: Mapped[str] = mapped_column(String, nullable=False)
    pincode: Mapped[str] = mapped_column(String, nullable=False)
    is_assigned:Mapped[bool]=mapped_column(Boolean,default=False )

    # Verification flags
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_pan_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_bank_details_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_id_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    otp: Mapped[str | None] = mapped_column(String, nullable=True)
    otp_expiry: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Verification details
    pan_number: Mapped[str | None] = mapped_column(String, nullable=True)
    pan_name: Mapped[str | None] = mapped_column(String, nullable=True)
    account_number: Mapped[str | None] = mapped_column(String, nullable=True)
    ifsc_code: Mapped[str | None] = mapped_column(String, nullable=True)
    account_holder_name: Mapped[str | None] = mapped_column(String, nullable=True)

    # Timestamps
    registered_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    
    def __repr__(self):
        return f"<User {self.phone_number}>"


