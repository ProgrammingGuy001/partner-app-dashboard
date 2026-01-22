from sqlalchemy import Column, Integer, String, DECIMAL, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class SiteRequisite(Base):
    __tablename__ = "site_requisite"
    
    id = Column(Integer, primary_key=True, index=True)
    so_detail_id = Column(Integer, ForeignKey("so_detail.id"), nullable=False)
    product_name = Column(String(255), nullable=False)
    quantity = Column(DECIMAL(10, 2), default=1.00)
    issue_description = Column(Text, nullable=True)
    responsible_department = Column(String(100), nullable=True)
    created_date = Column(DateTime, default=datetime.utcnow)
    
    # Relationship
    so_detail = relationship("SODetail", back_populates="site_requisites")
