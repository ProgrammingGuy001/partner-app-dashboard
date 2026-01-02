from sqlalchemy.orm import Session
from app.model.job import Checklist, ChecklistItem
from app.schemas.checklist import ChecklistCreate, ChecklistItemCreate

def get_checklist(db: Session, checklist_id: int):
    return db.query(Checklist).filter(Checklist.id == checklist_id).first()

def get_checklists(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Checklist).offset(skip).limit(limit).all()

def create_checklist(db: Session, checklist: ChecklistCreate):
    db_checklist = Checklist(**checklist.model_dump())
    db.add(db_checklist)
    db.commit()
    db.refresh(db_checklist)
    return db_checklist

def create_checklist_item(db: Session, item: ChecklistItemCreate, checklist_id: int):
    db_item = ChecklistItem(**item.model_dump(), checklist_id=checklist_id)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item
