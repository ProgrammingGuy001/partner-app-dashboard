import logging
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.database import get_db
from app.model.site_grn import GRNPackage, SiteGRN
from app.model.user import User
from app.schemas.site_grn import (
    GRNCreate,
    GRNResponse,
    GRNSubmit,
    JobGRNPaperwork,
    OdooPickingInfo,
    OdooPackageInfo,
    RepairOrderInfo,
)
from app.services.odoo_service import OdooService

from app.utils.error_text import sync_error_summary

logger = logging.getLogger(__name__)

admin_router = APIRouter(prefix="/admin/grn", tags=["Site GRN - Admin"])
ip_router = APIRouter(prefix="/api/v1/dashboard/grn", tags=["Site GRN - IP"])


def _require_admin(current_user=Depends(get_current_user)) -> User:
    if not isinstance(current_user, User):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def _require_ip(current_user=Depends(get_current_user)):
    from app.model.ip import ip as IPUser
    if not isinstance(current_user, IPUser):
        raise HTTPException(status_code=403, detail="IP user access required")
    return current_user


def _load_grn(db: Session, grn_id: int) -> SiteGRN:
    grn = (
        db.query(SiteGRN)
        .options(
            selectinload(SiteGRN.packages),
            selectinload(SiteGRN.ip_user),
            selectinload(SiteGRN.created_by),
            selectinload(SiteGRN.job),
        )
        .filter(SiteGRN.id == grn_id)
        .first()
    )
    if not grn:
        raise HTTPException(status_code=404, detail="GRN not found")
    return grn


def _job_paperwork(db: Session, job) -> JobGRNPaperwork:
    """The SO, its repair orders and the GRNs raised against one GRN job.

    Odoo being unreachable, or the SO not existing yet, degrades to an empty RO list
    with a note: the GRNs are what the visit actually needs, and they are local.
    """
    repair_orders: list[RepairOrderInfo] = []
    lookup_error = None
    if job.sales_order:
        try:
            repair_orders = [
                RepairOrderInfo(id=order.get("id"), name=order["name"])
                for order in OdooService.get_repair_orders_for_sales_order(job.sales_order)
                if order.get("name")
            ]
        except Exception as exc:
            logger.warning("Repair order lookup failed for SO %s", job.sales_order, exc_info=True)
            lookup_error = sync_error_summary(exc)
    grns = (
        db.query(SiteGRN)
        .options(
            selectinload(SiteGRN.packages),
            selectinload(SiteGRN.ip_user),
            selectinload(SiteGRN.created_by),
            selectinload(SiteGRN.job),
        )
        .filter(SiteGRN.job_id == job.id)
        .order_by(SiteGRN.created_at.desc())
        .all()
    )
    return JobGRNPaperwork(
        job_id=job.id,
        sales_order=job.sales_order,
        repair_orders=repair_orders,
        lookup_error=lookup_error,
        grns=grns,
    )


def _sync_grn_to_odoo(grn: SiteGRN) -> None:
    """Attempt every GRN writeback and persist a complete reconciliation error."""
    errors = []
    missing_packages = [package.package_name for package in grn.packages if not package.is_received]
    if grn.odoo_picking_id:
        for label, operation in (
            ("result note", lambda: OdooService.post_grn_result_to_odoo(grn.odoo_picking_id, missing_packages)),
            ("GRN status", lambda: OdooService.update_x_site_grn_status(
                grn.odoo_picking_id, grn.has_missing, grn.submitted_at
            )),
        ):
            try:
                operation()
            except Exception as exc:
                logger.exception("GRN Odoo sync step failed: %s (grn=%s)", label, grn.id)
                errors.append(f"{label}: {sync_error_summary(exc)}")

    line_updates = [
        {
            "line_id": package.odoo_line_id,
            "is_received": package.is_received,
            "scan_barcode": package.barcode,
            "scan_time": grn.submitted_at,
        }
        for package in grn.packages
        if package.odoo_line_id
    ]
    if line_updates:
        try:
            OdooService.writeback_grn_lines(line_updates)
        except Exception as exc:
            logger.exception("GRN line writeback failed (grn=%s)", grn.id)
            errors.append(f"GRN lines: {sync_error_summary(exc)}")

    grn.odoo_sync_error = "; ".join(error[:500] for error in errors) if errors else None


def _complete_grn(db: Session, grn: SiteGRN, data: GRNSubmit) -> None:
    if grn.status != "pending":
        raise HTTPException(status_code=400, detail="GRN already submitted")

    packages = {package.id: package for package in grn.packages}
    for submitted in data.packages:
        if submitted.package_id in packages:
            packages[submitted.package_id].is_received = submitted.is_received

    grn.has_missing = any(not package.is_received for package in grn.packages)
    grn.status = "submitted"
    grn.submitted_at = datetime.now(timezone.utc)
    db.commit()

    _sync_grn_to_odoo(grn)
    db.commit()


# ─── Admin: lookup source document in Odoo ────────────────────────────────────

@admin_router.get("/lookup/{source_doc:path}", response_model=List[OdooPickingInfo])
def lookup_source_document(
    source_doc: str,
    current_user: User = Depends(_require_admin),
):
    pickings = OdooService.get_pickings_by_source_doc(source_doc)
    if not pickings:
        raise HTTPException(status_code=404, detail=f"No open GRN found for '{source_doc}'")

    result = []
    for picking in pickings:
        raw_packages = OdooService.get_packages_for_picking(picking["picking_id"])
        result.append(OdooPickingInfo(
            picking_id=picking["picking_id"],
            picking_name=picking["picking_name"],
            origin=picking.get("origin"),
            partner_name=picking.get("partner_name"),
            packages=[OdooPackageInfo(**p) for p in raw_packages],
        ))
    return result


# ─── Admin: create GRN ────────────────────────────────────────────────────────

@admin_router.post("/", response_model=List[GRNResponse])
def create_grn(
    data: GRNCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_admin),
):
    if not data.assign_to_self:
        from app.model.ip import ip as IPUser
        if not db.query(IPUser.id).filter(IPUser.id == data.ip_user_id).first():
            raise HTTPException(status_code=404, detail="IP user not found")

    if data.job_id is not None:
        from app.model.job import Job
        job = db.query(Job).filter(Job.id == data.job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        if job.type != "grn":
            raise HTTPException(status_code=409, detail="Site GRNs can only be linked to a GRN job")

    # Lookup pickings in Odoo — one source document can map to multiple
    pickings = OdooService.get_pickings_by_source_doc(data.source_document)
    if not pickings:
        raise HTTPException(
            status_code=404,
            detail=f"No open GRN found for source document '{data.source_document}'"
        )

    selected_picking_ids = set(data.picking_ids or [])
    if selected_picking_ids:
        pickings = [p for p in pickings if p["picking_id"] in selected_picking_ids]
        found_picking_ids = {p["picking_id"] for p in pickings}
        missing_picking_ids = selected_picking_ids - found_picking_ids
        if missing_picking_ids:
            raise HTTPException(
                status_code=400,
                detail=f"Selected delivery order(s) not found for source document: {sorted(missing_picking_ids)}",
            )
        if not pickings:
            raise HTTPException(status_code=400, detail="No selected delivery orders to create GRN for")

    # One GRN per selected picking; skip pickings whose GRN lines carry no packages
    created_ids = []
    for picking in pickings:
        existing_grn = (
            db.query(SiteGRN)
            .filter(SiteGRN.odoo_picking_id == picking["picking_id"])
            .first()
        )
        if existing_grn:
            raise HTTPException(
                status_code=409,
                detail=f"A GRN already exists for delivery order '{picking['picking_name']}'",
            )

        raw_packages = OdooService.get_packages_for_picking(picking["picking_id"])
        if not raw_packages:
            continue

        grn = SiteGRN(
            source_document=data.source_document,
            odoo_picking_id=picking["picking_id"],
            odoo_picking_name=picking["picking_name"],
            ip_user_id=data.ip_user_id,
            job_id=data.job_id,
            created_by_admin_id=current_user.id,
            status="pending",
            has_missing=False,
        )
        db.add(grn)
        db.flush()

        for pkg in raw_packages:
            db.add(GRNPackage(
                grn_id=grn.id,
                odoo_package_id=pkg.get("odoo_package_id"),
                odoo_line_id=pkg.get("odoo_line_id"),
                package_name=pkg["package_name"],
                barcode=pkg.get("barcode"),
                is_received=False,
            ))
        created_ids.append(grn.id)

    if not created_ids:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"No packages found in GRN lines for '{data.source_document}'"
        )

    db.commit()
    return [_load_grn(db, grn_id) for grn_id in created_ids]


# ─── Admin: list GRNs ─────────────────────────────────────────────────────────

@admin_router.get("/", response_model=List[GRNResponse])
def list_grns(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    job_id: int | None = Query(None, gt=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_admin),
):
    query = (
        db.query(SiteGRN)
        .options(
            selectinload(SiteGRN.packages),
            selectinload(SiteGRN.ip_user),
            selectinload(SiteGRN.created_by),
            selectinload(SiteGRN.job),
        )
    )
    if job_id is not None:
        query = query.filter(SiteGRN.job_id == job_id)
    return query.order_by(SiteGRN.created_at.desc()).offset(offset).limit(limit).all()


@admin_router.get("/job/{job_id}", response_model=JobGRNPaperwork)
def get_job_paperwork_as_supervisor(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_admin),
):
    """The SO, RO and GRNs behind a GRN job, as its supervisor sees them."""
    from app.crud.job import get_job_by_id

    job = get_job_by_id(db, job_id, user_id=None if current_user.is_superadmin else current_user.id)
    return _job_paperwork(db, job)


# ─── Admin: get single GRN ────────────────────────────────────────────────────

@admin_router.get("/{grn_id}", response_model=GRNResponse)
def get_grn(
    grn_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_admin),
):
    grn = _load_grn(db, grn_id)
    return grn


@admin_router.post("/{grn_id}/retry-sync", response_model=GRNResponse)
def retry_grn_sync(
    grn_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_admin),
):
    grn = _load_grn(db, grn_id)
    if grn.status == "pending":
        raise HTTPException(status_code=409, detail="Submit the GRN before retrying Odoo sync")
    _sync_grn_to_odoo(grn)
    db.commit()
    return _load_grn(db, grn_id)


@admin_router.post("/{grn_id}/submit", response_model=GRNResponse)
def submit_grn_as_supervisor(
    grn_id: int,
    data: GRNSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_admin),
):
    grn = _load_grn(db, grn_id)
    _complete_grn(db, grn, data)
    return _load_grn(db, grn_id)


@admin_router.get("/debug/grn-line-fields")
def probe_grn_line_fields(
    current_user: User = Depends(_require_admin),
):
    """Introspect x_site_grn_line fields to understand types before writeback."""
    return OdooService.probe_grn_line_fields()


# ─── IP: get assigned GRNs ────────────────────────────────────────────────────

@ip_router.get("/assigned", response_model=List[GRNResponse])
def get_assigned_grns(
    db: Session = Depends(get_db),
    current_user=Depends(_require_ip),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    grns = (
        db.query(SiteGRN)
        .options(
            selectinload(SiteGRN.packages),
            selectinload(SiteGRN.ip_user),
            selectinload(SiteGRN.created_by),
        )
        .filter(SiteGRN.ip_user_id == current_user.id, SiteGRN.status == "pending")
        .order_by(SiteGRN.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return grns


@ip_router.get("/job/{job_id}", response_model=JobGRNPaperwork)
def get_job_paperwork(
    job_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(_require_ip),
):
    """Same paperwork the supervisor sees, for a job this IP is on."""
    from app.crud.job import get_ip_job_by_id

    job = get_ip_job_by_id(db, job_id, current_user.id)
    return _job_paperwork(db, job)


# ─── IP: submit GRN ───────────────────────────────────────────────────────────

@ip_router.post("/{grn_id}/submit", response_model=GRNResponse)
def submit_grn(
    grn_id: int,
    data: GRNSubmit,
    db: Session = Depends(get_db),
    current_user=Depends(_require_ip),
):
    grn = _load_grn(db, grn_id)

    if grn.ip_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="This GRN is not assigned to you")

    _complete_grn(db, grn, data)
    return _load_grn(db, grn_id)
