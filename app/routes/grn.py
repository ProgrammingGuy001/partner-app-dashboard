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
    OdooPickingInfo,
    OdooPackageInfo,
)
from app.services.odoo_service import OdooService

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
        .options(selectinload(SiteGRN.packages), selectinload(SiteGRN.ip_user))
        .filter(SiteGRN.id == grn_id)
        .first()
    )
    if not grn:
        raise HTTPException(status_code=404, detail="GRN not found")
    return grn


# ─── Admin: lookup source document in Odoo ────────────────────────────────────

@admin_router.get("/lookup/{source_doc:path}", response_model=List[OdooPickingInfo])
def lookup_source_document(
    source_doc: str,
    current_user: User = Depends(_require_admin),
):
    pickings = OdooService.get_pickings_by_source_doc(source_doc)
    if not pickings:
        raise HTTPException(status_code=404, detail=f"No picking found for '{source_doc}'")

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
    # Validate IP user exists
    from app.model.ip import ip as IPUser
    ip_user = db.query(IPUser).filter(IPUser.id == data.ip_user_id).first()
    if not ip_user:
        raise HTTPException(status_code=404, detail="IP user not found")

    # Lookup pickings in Odoo — one source document can map to multiple
    pickings = OdooService.get_pickings_by_source_doc(data.source_document)
    if not pickings:
        raise HTTPException(
            status_code=404,
            detail=f"No delivery order found for source document '{data.source_document}'"
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
        raw_packages = OdooService.get_packages_for_picking(picking["picking_id"])
        if not raw_packages:
            continue

        grn = SiteGRN(
            source_document=data.source_document,
            odoo_picking_id=picking["picking_id"],
            odoo_picking_name=picking["picking_name"],
            ip_user_id=data.ip_user_id,
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
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_admin),
):
    grns = (
        db.query(SiteGRN)
        .options(selectinload(SiteGRN.packages), selectinload(SiteGRN.ip_user))
        .order_by(SiteGRN.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return grns


# ─── Admin: get single GRN ────────────────────────────────────────────────────

@admin_router.get("/{grn_id}", response_model=GRNResponse)
def get_grn(
    grn_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_admin),
):
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
):
    grns = (
        db.query(SiteGRN)
        .options(selectinload(SiteGRN.packages), selectinload(SiteGRN.ip_user))
        .filter(SiteGRN.ip_user_id == current_user.id, SiteGRN.status == "pending")
        .order_by(SiteGRN.created_at.desc())
        .all()
    )
    if not grns:
        raise HTTPException(status_code=404, detail="No pending GRN assigned to you")
    return grns


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

    if grn.status != "pending":
        raise HTTPException(status_code=400, detail="GRN already submitted")

    # Build lookup map
    pkg_map = {p.id: p for p in grn.packages}
    submit_map = {s.package_id: s.is_received for s in data.packages}

    for pkg_id, is_received in submit_map.items():
        if pkg_id in pkg_map:
            pkg_map[pkg_id].is_received = is_received

    missing_packages = [p.package_name for p in grn.packages if not p.is_received]
    has_missing = bool(missing_packages)

    grn.status = "submitted"
    grn.has_missing = has_missing
    grn.submitted_at = datetime.now(timezone.utc)

    db.commit()

    # Writeback to Odoo (non-fatal)
    if grn.odoo_picking_id:
        try:
            OdooService.post_grn_result_to_odoo(grn.odoo_picking_id, missing_packages)
            OdooService.update_x_site_grn_status(grn.odoo_picking_id, has_missing, grn.submitted_at)
        except Exception as e:
            logger.warning("Odoo GRN writeback failed for GRN %s: %s", grn_id, e)

    line_updates = [
        {
            'line_id': p.odoo_line_id,
            'is_received': p.is_received,
            'scan_barcode': p.barcode,
            'scan_time': grn.submitted_at,
        }
        for p in grn.packages
        if p.odoo_line_id
    ]
    if line_updates:
        try:
            OdooService.writeback_grn_lines(line_updates)
        except Exception as e:
            logger.warning("GRN line writeback failed for GRN %s: %s", grn_id, e)

    return _load_grn(db, grn_id)
