from sqlalchemy.orm import Session
from sqlalchemy import exists, and_
from app.model.ip import IPAdminAssignment

def is_admin_allowed_for_ip(
    db: Session,
    ip_id: int,
    admin_id: int
) -> bool:
    """
    Checks if a specific admin is authorized to manage a specific IP.
    This is determined by the existence of a record in the IPAdminAssignment table.
    """
    return db.query(
        exists().where(
            and_(
                IPAdminAssignment.ip_id == ip_id,
                IPAdminAssignment.admin_id == admin_id
            )
        )
    ).scalar()