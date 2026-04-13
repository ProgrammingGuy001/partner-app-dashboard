from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class SODetail(Base):
    __tablename__ = "so_detail"

    id = Column(Integer, primary_key=True, index=True)
    sales_order = Column(String(100), nullable=False, index=True)
    created_date = Column(DateTime, default=datetime.utcnow)
    closed_date = Column(DateTime, nullable=True)
    status = Column(String(20), default="pending")
    sr_poc = Column(String(255), nullable=True)
    cabinet_position = Column(String(255), nullable=True)
    ip_user_id = Column(Integer, ForeignKey("ip_user.id"), nullable=True, index=True)

    # Odoo-enriched fields (populated on submit)
    customer_name = Column(String(512), nullable=True)
    project_name = Column(String(512), nullable=True)
    delivery_address = Column(Text, nullable=True)
    so_poc = Column(String(255), nullable=True)
    so_status = Column(String(100), nullable=True)
    repair_reference = Column(String(255), nullable=True)
    expected_delivery = Column(Date, nullable=True)
    do_number = Column(String(255), nullable=True)

    # Relationship
    site_requisites = relationship("SiteRequisite", back_populates="so_detail", cascade="all, delete-orphan")
