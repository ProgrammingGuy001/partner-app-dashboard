# This file is deprecated - Checklist models are now defined in app.model.job
# Please use: from app.model.job import Checklist, ChecklistItem, JobChecklistLink

# from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
# from sqlalchemy.orm import relationship
# from app.db.session import Base
# 
# class Checklist(Base):
#     __tablename__ = "checklists"
# 
#     id = Column(Integer, primary_key=True, index=True)
#     name = Column(String, index=True)
#     items = relationship("ChecklistItem", back_populates="checklist")
# 
# class ChecklistItem(Base):
#     __tablename__ = "checklist_items"
# 
#     id = Column(Integer, primary_key=True, index=True)
#     name = Column(String, index=True)
#     description = Column(String, nullable=True)
#     is_completed = Column(Boolean, default=False)
#     checklist_id = Column(Integer, ForeignKey("checklists.id"))
#     checklist = relationship("Checklist", back_populates="items")
