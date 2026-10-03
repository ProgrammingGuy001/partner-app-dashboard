from sqlalchemy.orm import Session
from sqlalchemy import exists, and_
from app.model.ip import IPAdminAssignment
from app.model.user import User
from app.utils.admin_scope import supervisor_ids

def is_admin_allowed_for_ip(
    db: Session,
    ip_id: int,
    admin_id: int
) -> bool:
    """
    Checks if a specific admin is authorized to manage a specific IP.
    This is determined by the existence of a record in the IPAdminAssignment table.
    """
    actor = db.get(User, admin_id)
    ids = supervisor_ids(db, actor) if actor else [admin_id]
    if ids is None:
        return True
    return db.query(
        exists().where(
            and_(
                IPAdminAssignment.ip_id == ip_id,
                IPAdminAssignment.admin_id.in_(ids)
            )
        )
    ).scalar()
