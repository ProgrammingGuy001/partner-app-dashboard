from sqlalchemy.orm import Session, selectinload
from app.model.so_detail import SODetail
from app.model.site_requisite import SiteRequisite
from app.schemas.requisite_schema import SiteRequisiteSubmit
from datetime import datetime
from typing import List

class RequisiteService:
    
    @staticmethod
    def submit_site_requisite(db: Session, data: SiteRequisiteSubmit):
        """Submit site requisite with all bucket items"""
        
        # Upsert SO Detail
        so_detail = db.query(SODetail).filter(
            SODetail.sales_order == data.sales_order
        ).first()

        if not so_detail:
            # Create new SO if it doesn't exist
            so_detail = SODetail(
                sales_order=data.sales_order,
                sr_poc=data.sr_poc,
                status="pending",
                cabinet_position=data.cabinet_position
            )
            db.add(so_detail)
            db.flush()  # Ensures so_detail.id is available
        else:
            # If SO exists, update cabinet position and POC
            so_detail.cabinet_position = data.cabinet_position
            so_detail.sr_poc = data.sr_poc
            
            # Delete existing requisites for this SO to replace them
            db.query(SiteRequisite).filter(SiteRequisite.so_detail_id == so_detail.id).delete(synchronize_session=False)
        
        # Add all requisite items
        for item in data.items:
            site_req = SiteRequisite(
                so_detail_id=so_detail.id,
                product_name=item.product_name,
                quantity=item.quantity,
                issue_description=item.issue_description,
                responsible_department=item.responsible_department
            )
            db.add(site_req)
        
        db.commit()
        
        # Re-fetch with eager loading for response serialization
        return db.query(SODetail).options(
            selectinload(SODetail.site_requisites)
        ).filter(SODetail.id == so_detail.id).first()
    
    @staticmethod
    def get_history(db: Session, limit: int = 50, offset: int = 0) -> List[SODetail]:
        """Get all site requisite history"""
        return db.query(SODetail).options(
            selectinload(SODetail.site_requisites)
        ).order_by(
            SODetail.created_date.desc()
        ).offset(offset).limit(limit).all()
    
    @staticmethod
    def get_history_by_sales_order(db: Session, sales_order: str):
        """Get history for specific sales order"""
        return db.query(SODetail).options(
            selectinload(SODetail.site_requisites)
        ).filter(
            SODetail.sales_order == sales_order
        ).first()
    
    @staticmethod
    def update_status(db: Session, so_id: int, status: str):
        """Update SO status"""
        so_detail = db.query(SODetail).filter(SODetail.id == so_id).first()
        if so_detail:
            so_detail.status = status
            if status == "completed":
                so_detail.closed_date = datetime.utcnow()
            db.commit()
            db.refresh(so_detail)
            return so_detail