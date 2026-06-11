import logging
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.database import get_db
from app.model.site_grn import AdminNotification, GRNPackage, SiteGRN
from app.model.user import User
from app.schemas.site_grn import (
    GRNCreate,
    GRNResponse,
    GRNSubmit,
    NotificationResponse,
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

@admin_router.get("/lookup/{source_doc}", response_model=OdooPickingInfo)
def lookup_source_document(
    source_doc: str,
    current_user: User = Depends(_require_admin),
):
    picking = OdooService.get_picking_by_source_doc(source_doc)
    if not picking:
        raise HTTPException(status_code=404, detail=f"No picking found for '{source_doc}'")

    raw_packages = OdooService.get_packages_for_picking(picking["picking_id"])
    packages = [OdooPackageInfo(**p) for p in raw_packages]

    return OdooPickingInfo(
        picking_id=picking["picking_id"],
        picking_name=picking["picking_name"],
        origin=picking.get("origin"),
        partner_name=picking.get("partner_name"),
        packages=packages,
    )


# ─── Admin: create GRN ────────────────────────────────────────────────────────

@admin_router.post("/", response_model=GRNResponse)
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

    # Lookup picking in Odoo
    picking = OdooService.get_picking_by_source_doc(data.source_document)
    if not picking:
        raise HTTPException(
            status_code=404,
            detail=f"No delivery order found for source document '{data.source_document}'"
        )

    # Fetch packages
    raw_packages = OdooService.get_packages_for_picking(picking["picking_id"])

    grn = SiteGRN(
        source_document=data.source_document,
        odoo_picking_id=picking["picking_id"],
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
            package_name=pkg["package_name"],
            is_received=False,
        ))

    db.commit()
    db.refresh(grn)
    return _load_grn(db, grn.id)


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


# ─── Admin: notifications ─────────────────────────────────────────────────────

@admin_router.get("/notifications/list", response_model=List[NotificationResponse])
def get_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_admin),
):
    q = db.query(AdminNotification)
    if unread_only:
        q = q.filter(AdminNotification.is_read == False)
    notifs = q.order_by(AdminNotification.created_at.desc()).limit(limit).all()
    return notifs


@admin_router.patch("/notifications/{notif_id}/read")
def mark_notification_read(
    notif_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_admin),
):
    notif = db.query(AdminNotification).filter(AdminNotification.id == notif_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    return {"message": "Marked as read"}


@admin_router.patch("/notifications/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_admin),
):
    db.query(AdminNotification).filter(AdminNotification.is_read == False).update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read"}


# ─── IP: get assigned GRN ─────────────────────────────────────────────────────

@ip_router.get("/assigned", response_model=GRNResponse)
def get_assigned_grn(
    db: Session = Depends(get_db),
    current_user=Depends(_require_ip),
):
    grn = (
        db.query(SiteGRN)
        .options(selectinload(SiteGRN.packages), selectinload(SiteGRN.ip_user))
        .filter(SiteGRN.ip_user_id == current_user.id, SiteGRN.status == "pending")
        .order_by(SiteGRN.created_at.desc())
        .first()
    )
    if not grn:
        raise HTTPException(status_code=404, detail="No pending GRN assigned to you")
    return grn


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

    # Create in-app notification if any packages missing
    if has_missing:
        missing_list = ", ".join(missing_packages[:5])
        if len(missing_packages) > 5:
            missing_list += f" (+{len(missing_packages) - 5} more)"

        notif = AdminNotification(
            title=f"Missing packages on GRN #{grn_id}",
            body=f"GRN for {grn.source_document} submitted with {len(missing_packages)} missing package(s): {missing_list}",
            grn_id=grn_id,
            is_read=False,
        )
        db.add(notif)
        db.commit()

    # Writeback to Odoo (non-fatal)
    if grn.odoo_picking_id:
        try:
            OdooService.post_grn_result_to_odoo(grn.odoo_picking_id, missing_packages)
            OdooService.update_x_site_grn_status(grn.odoo_picking_id, has_missing)
        except Exception as e:
            logger.warning("Odoo GRN writeback failed for GRN %s: %s", grn_id, e)

    return _load_grn(db, grn_id)
