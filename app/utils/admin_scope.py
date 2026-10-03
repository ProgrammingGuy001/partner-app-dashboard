"""Explicit supervisor scope shared by operational routes."""

from fastapi import HTTPException
from sqlalchemy import select
from app.model.user import User, CityOpsSupervisor


def is_global(user):
    return bool(getattr(user, "is_superadmin", False) or getattr(user, "is_dev", False))


def is_manager(user):
    return is_global(user) or bool(getattr(user, "is_city_ops", False))


def supervisor_ids(db, user):
    if is_global(user):
        return None
    if getattr(user, "is_city_ops", False):
        return list(
            db.scalars(
                select(CityOpsSupervisor.supervisor_id).where(
                    CityOpsSupervisor.city_ops_id == user.id
                )
            )
        )
    return [user.id]


def require_supervisor(db, user, supervisor_id):
    ids = supervisor_ids(db, user)
    if ids is not None and supervisor_id not in ids:
        raise HTTPException(
            status_code=403, detail="Supervisor is outside your mapped scope"
        )


def actor_scope_id(db, actor_id, privileged):
    actor = db.get(User, actor_id) if actor_id else None
    return actor_id if getattr(actor, "is_city_ops", False) or not privileged else None


def require_sales_order(db, user, sales_order):
    if not getattr(user, "is_city_ops", False):
        return
    from app.model.job import Job

    if (
        not db.query(Job.id)
        .filter(
            Job.sales_order == sales_order,
            Job.admin_assigned.in_(supervisor_ids(db, user)),
        )
        .first()
    ):
        raise HTTPException(
            status_code=403, detail="Sales order is outside your mapped jobs"
        )
