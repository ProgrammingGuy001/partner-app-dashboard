from sqlalchemy import Column, Integer, String, DateTime, DECIMAL, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class SODetail(Base):
    __tablename__ = "so_detail"
    
    id = Column(Integer, primary_key=True, index=True)
    sales_order = Column(String(100), unique=True, nullable=False, index=True)
    created_date = Column(DateTime , default=datetime.utcnow)
    closed_date = Column(DateTime, nullable=True)
    status = Column(String(20), default="pending")
    sr_poc = Column(String(255))
    cabinet_position = Column(String(255))
    
    # Relationship
    site_requisites = relationship("SiteRequisite", back_populates="so_detail", cascade="all, delete-orphan")
