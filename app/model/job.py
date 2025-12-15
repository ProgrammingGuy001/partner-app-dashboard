from sqlalchemy import Column, Integer, String, Boolean, Numeric, Date
from sqlalchemy.orm import  Mapped, mapped_column
from app.database import Base
from decimal import Decimal
from datetime import date


class Job(Base):
    __tablename__ = "job"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String)
    customer_name: Mapped[str] = mapped_column(String)
    address: Mapped[str] = mapped_column(String)
    city: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="created")
    pincode: Mapped[int] = mapped_column(Integer)
    assigned_ip_id: Mapped[int] = mapped_column(Integer, nullable=True)
    type: Mapped[str] = mapped_column(String)
    rate: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    size: Mapped[int] = mapped_column(Integer, nullable=True)
    delivery_date: Mapped[date] = mapped_column(Date)
    checklist_link: Mapped[str] = mapped_column(String, nullable=True)
    google_map_link: Mapped[str] = mapped_column(String, nullable=True)
    additional_expense: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=True, default=0)
    
    
    def __repr__(self):
        return f"<Job {self.name}>"
    
                                 # JSON string for checklist items

   
    
