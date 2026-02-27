from datetime import datetime
from typing import List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship, synonym

from app.database import Base


class IPAdminAssignment(Base):
    __tablename__ = "ip_user_admin_assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ip_id: Mapped[int] = mapped_column(Integer, ForeignKey("ip_user.id"), nullable=False, index=True)
    admin_id: Mapped[int] = mapped_column(Integer, ForeignKey("admin.id"), nullable=False, index=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    ip_user: Mapped["ip"] = relationship("ip", back_populates="admin_assignments")
    admin: Mapped["User"] = relationship("User", back_populates="ip_assignments")


class IPFinancial(Base):
    __tablename__ = "ip_financials"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("ip_user.id"), unique=True, index=True, nullable=True
    )
    pan_number: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    pan_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    is_pan_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    account_number: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    ifsc_code: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    account_holder_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    is_bank_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    highest_qualification: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    highest_qualification_document_url: Mapped[Optional[str]] = mapped_column(
        String, nullable=True
    )
    is_education_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    ip_user: Mapped["ip"] = relationship("ip", back_populates="financial")


class ip(Base):
    __tablename__ = "ip_user"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, index=True)
    phone_number: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    first_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    last_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    pincode: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_assigned: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    is_phone_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_id_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Optional legacy column present in DB.
    admin_access: Mapped[Optional[list[int]]] = mapped_column(ARRAY(Integer), nullable=True)

    financial: Mapped[Optional["IPFinancial"]] = relationship(
        "IPFinancial", back_populates="ip_user", uselist=False, cascade="all, delete-orphan"
    )
    admin_assignments: Mapped[List["IPAdminAssignment"]] = relationship(
        "IPAdminAssignment", back_populates="ip_user", cascade="all, delete-orphan"
    )

    # Compatibility aliases/properties for existing API contracts.
    is_verified = synonym("is_phone_verified")

    @property
    def is_pan_verified(self) -> bool:
        return bool(self.financial and self.financial.is_pan_verified)

    @is_pan_verified.setter
    def is_pan_verified(self, value: bool) -> None:
        self._ensure_financial().is_pan_verified = value

    @property
    def is_bank_details_verified(self) -> bool:
        return bool(self.financial and self.financial.is_bank_verified)

    @is_bank_details_verified.setter
    def is_bank_details_verified(self, value: bool) -> None:
        self._ensure_financial().is_bank_verified = value

    @property
    def pan_number(self) -> Optional[str]:
        return self.financial.pan_number if self.financial else None

    @pan_number.setter
    def pan_number(self, value: Optional[str]) -> None:
        self._ensure_financial().pan_number = value

    @property
    def pan_name(self) -> Optional[str]:
        return self.financial.pan_name if self.financial else None

    @pan_name.setter
    def pan_name(self, value: Optional[str]) -> None:
        self._ensure_financial().pan_name = value

    @property
    def account_number(self) -> Optional[str]:
        return self.financial.account_number if self.financial else None

    @account_number.setter
    def account_number(self, value: Optional[str]) -> None:
        self._ensure_financial().account_number = value

    @property
    def ifsc_code(self) -> Optional[str]:
        return self.financial.ifsc_code if self.financial else None

    @ifsc_code.setter
    def ifsc_code(self, value: Optional[str]) -> None:
        self._ensure_financial().ifsc_code = value

    @property
    def account_holder_name(self) -> Optional[str]:
        return self.financial.account_holder_name if self.financial else None

    @account_holder_name.setter
    def account_holder_name(self, value: Optional[str]) -> None:
        self._ensure_financial().account_holder_name = value

    @property
    def registered_at(self) -> datetime:
        return self.created_at

    @property
    def verified_at(self) -> Optional[datetime]:
        return self.financial.verified_at if self.financial else None

    @verified_at.setter
    def verified_at(self, value: Optional[datetime]) -> None:
        self._ensure_financial().verified_at = value

    def _ensure_financial(self) -> IPFinancial:
        if self.financial is None:
            self.financial = IPFinancial()
        return self.financial

    def __repr__(self) -> str:
        return f"<IPUser {self.phone_number}>"
