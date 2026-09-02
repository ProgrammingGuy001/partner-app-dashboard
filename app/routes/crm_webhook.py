"""Inbound webhook for Odoo CRM lead stage changes.

Odoo's stock "Send Webhook Notification" server action posts plain JSON with no custom
headers, so the shared secret rides in the query string instead of an Authorization header.
"""
import logging
import secrets
from datetime import datetime
from functools import lru_cache
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.crud.checklist import get_job_type_checklist_ids, sync_job_checklists
from app.crud.job import _upsert_customer
from app.database import get_db
from app.model.job import Job
from app.model.job_status_log import JobStatusLog
from app.model.user import User
from app.utils.rate_limiter import limiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks/crm", tags=["CRM Webhook"])

# Odoo crm.lead stage -> job type. A stage that isn't listed isn't field work; ignore it.
STAGE_JOB_TYPES = {
    6: "measurement",
    39: "site_validation",
    31: "site_readiness",
    16: "grn",
    20: "installation",
}


class CrmLeadPayload(BaseModel):
    # Odoo adds keys to the payload freely (_model, _name, company_id, ...); ignore them.
    model_config = ConfigDict(extra="ignore")

    id: int
    stage_id: int
    name: Optional[str] = None
    phone: Optional[str] = None
    email_from: Optional[str] = None
    street: Optional[str] = None
    street2: Optional[str] = None
    city: Optional[str] = None
    state_id: Optional[int] = None
    zip: Optional[str] = None
    # A lead may or may not carry its sales order, and the field is named differently
    # depending on how the CRM was customised. Any of these will do; none is fine too -
    # the job is created without one and a supervisor can fill it in later.
    sales_order: Optional[str] = Field(
        default=None,
        max_length=100,
        validation_alias=AliasChoices(
            "sales_order", "x_studio_sales_order", "so_number", "order_ref"
        ),
    )

    @field_validator(
        "name", "phone", "email_from", "street", "street2", "city", "zip",
        "sales_order", mode="before"
    )
    @classmethod
    def _odoo_blank_is_none(cls, value):
        # Odoo serializes an empty char field as `false`, not null.
        return None if value is False else value


@lru_cache(maxsize=256)
def _state_name(state_id: int) -> Optional[str]:
    """Turn Odoo's res.country.state id into the name Customer.state stores.

    ponytail: per-process cache with no invalidation — state names don't change. Odoo
              being down doesn't block the job; the customer just lands without a state.
    """
    try:
        from app.services.odoo_service import OdooService

        rows = OdooService._execute_kw(
            "res.country.state", "read", [[state_id]], {"fields": ["name"]}
        )
        return (rows[0].get("name") or None) if rows else None
    except Exception:
        logger.warning("Could not resolve Odoo state %s", state_id, exc_info=True)
        return None


def _pincode(value: Optional[str]) -> Optional[int]:
    digits = "".join(ch for ch in (value or "") if ch.isdigit())
    return int(digits) if digits else None


@router.post("/lead")
@limiter.limit("60/minute")
def receive_crm_lead(
    request: Request,
    response: Response,
    payload: CrmLeadPayload,
    token: str = Query(min_length=1),
    db: Session = Depends(get_db),
):
    """Create a job for a CRM lead that entered a field-work stage.

    Returns 200 for anything deliberately skipped (unmapped stage, replayed webhook) so
    Odoo doesn't retry it forever; only a real failure gets a 4xx/5xx.
    """
    if not settings.CRM_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="CRM webhook is not configured")
    if not secrets.compare_digest(token, settings.CRM_WEBHOOK_SECRET):
        raise HTTPException(status_code=401, detail="Invalid webhook token")

    job_type = STAGE_JOB_TYPES.get(payload.stage_id)
    if job_type is None:
        return {"status": "ignored", "stage_id": payload.stage_id}

    existing = db.scalars(
        select(Job).where(
            Job.crm_lead_id == payload.id, Job.crm_stage_id == payload.stage_id
        )
    ).first()
    if existing:
        return {"status": "duplicate", "job_id": existing.id, "type": existing.job_type}

    # jobs.admin_assigned is NOT NULL in the database: every job has an owning admin.
    # Park CRM jobs on a superadmin, who reassigns to the real supervisor on approval.
    owner_id = db.scalars(
        select(User.id)
        .where(
            User.is_superadmin.is_(True),
            User.is_active.is_(True),
            User.is_approved.is_(True),
        )
        .order_by(User.id)
    ).first()
    if owner_id is None:
        raise HTTPException(
            status_code=503, detail="No active superadmin to own CRM-created jobs"
        )

    # Later stages of the same lead reuse its customer rather than cloning it, and pick up
    # any address the CRM has corrected since.
    earlier = db.scalars(
        select(Job)
        .where(Job.crm_lead_id == payload.id)
        .order_by(Job.id.desc())
    ).first()

    try:
        customer = _upsert_customer(
            db,
            existing_customer=earlier.customer if earlier else None,
            customer_name=payload.name,
            customer_phone=payload.phone,
            address_line_1=payload.street,
            address_line_2=payload.street2,
            city=payload.city,
            state=_state_name(payload.state_id) if payload.state_id else None,
            pincode=_pincode(payload.zip),
        )
        # Built directly rather than through create_job: that path needs an admin id for
        # admin_assigned and JobCreate demands a delivery date plus a drawing link for
        # site_validation/installation, none of which a CRM lead carries. A superadmin
        # fills in supervisor, rate and area when approving.
        job = Job(
            customer_id=customer.id if customer else None,
            status="pending_approval",
            admin_assigned=owner_id,
            job_type=job_type,
            crm_lead_id=payload.id,
            crm_stage_id=payload.stage_id,
            sales_order=(payload.sales_order or "").strip() or None,
        )
        db.add(job)
        db.flush()
        checklist_ids = get_job_type_checklist_ids(db, job_type)
        if checklist_ids:
            sync_job_checklists(db, job, checklist_ids)
        db.add(
            JobStatusLog(
                job_id=job.id,
                status="pending_approval",
                created_at=datetime.utcnow(),
                notes=f"Created from CRM lead {payload.id} at stage {payload.stage_id}",
                actor_type="crm",
                actor_id=None,
            )
        )
        db.commit()
    except IntegrityError:
        # Two fires for the same lead+stage raced; the partial unique index caught it.
        db.rollback()
        existing = db.scalars(
            select(Job).where(
                Job.crm_lead_id == payload.id, Job.crm_stage_id == payload.stage_id
            )
        ).first()
        if not existing:
            raise
        return {"status": "duplicate", "job_id": existing.id, "type": existing.job_type}
    except Exception as exc:
        db.rollback()
        logger.exception("Error creating job from CRM lead %s", payload.id)
        raise HTTPException(status_code=500, detail="Could not create the job.") from exc

    response.status_code = status.HTTP_201_CREATED
    return {"status": "created", "job_id": job.id, "type": job_type}
