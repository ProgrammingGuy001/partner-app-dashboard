"""Render a filled-in job checklist to PDF.

Distinct from checklist_template_service, which hands out the *blank* workbook.
This one reports what was actually done: every item with its status, notes, admin
feedback and the evidence photo the IP uploaded.

reportlab Platypus, not LibreOffice or Playwright — the item list is
variable-length, which is exactly what a flowable story paginates for free, and it
needs no binary beyond the wheel.
"""

import io
from xml.sax.saxutils import escape

import requests
from PIL import Image
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (
    HRFlowable,
    Image as RLImage,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.services.document_automation_service import GeneratedDocument, _safe_name
from app.utils.attendance_policy import now_ist

# A 12MP phone photo at full size would make a 40MB PDF; 900px wide is plenty for
# an A4 half-width render.
PHOTO_MAX_WIDTH = 900
PHOTO_JPEG_QUALITY = 72
PHOTO_RENDER_WIDTH = 80 * mm
# A portrait or panorama shot scaled to the width above can be taller than the
# usable page, which would make its KeepTogether block unplaceable. Cap it.
PHOTO_RENDER_MAX_HEIGHT = 110 * mm
# Same ceiling the installation report uses. Past this, items still render — they
# just show the evidence as a link instead of an image.
MAX_PHOTOS = 12
FETCH_TIMEOUT_SECONDS = 10
# ponytail: 8MB ceiling on a single download, so one pathological upload can't
# exhaust memory. Raise if real site photos ever exceed it.
MAX_IMAGE_BYTES = 8 * 1024 * 1024

STATUS_COLORS = {
    "approved": "#15803d",
    "rejected": "#b91c1c",
    "pending": "#b45309",
}
NEUTRAL = "#6b7280"


def _fetch_image(url: str) -> bytes | None:
    """Download and downscale an evidence photo, or None if it isn't usable as one.

    Never raises: a dead link, a timeout, a PDF/DOCX upload or a corrupt file all
    degrade to a plain link in the document. One bad upload must not fail the export.
    """
    try:
        with requests.get(url, timeout=FETCH_TIMEOUT_SECONDS, stream=True) as response:
            response.raise_for_status()
            raw = response.raw.read(MAX_IMAGE_BYTES + 1, decode_content=True)
        if len(raw) > MAX_IMAGE_BYTES:
            return None
        img = Image.open(io.BytesIO(raw))
        img.load()
        if img.width > PHOTO_MAX_WIDTH:
            height = round(img.height * PHOTO_MAX_WIDTH / img.width)
            img = img.resize((PHOTO_MAX_WIDTH, height), Image.LANCZOS)
        out = io.BytesIO()
        img.convert("RGB").save(
            out, format="JPEG", quality=PHOTO_JPEG_QUALITY, optimize=True
        )
        return out.getvalue()
    except Exception:
        # Deliberately broad: requests, PIL and IO all raise their own families and
        # every one of them means the same thing here — fall back to a link.
        return None


def _styles() -> dict:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "ExportTitle", parent=base["Title"], fontSize=16, spaceAfter=2, alignment=TA_LEFT
        ),
        "subtitle": ParagraphStyle(
            "ExportSubtitle",
            parent=base["Normal"],
            fontSize=9,
            textColor=colors.HexColor("#6b7280"),
        ),
        "meta": ParagraphStyle("ExportMeta", parent=base["Normal"], fontSize=9, leading=13),
        "item": ParagraphStyle(
            "ExportItem", parent=base["Normal"], fontSize=10, leading=14, spaceAfter=2
        ),
        "note": ParagraphStyle(
            "ExportNote",
            parent=base["Normal"],
            fontSize=9,
            leading=12,
            leftIndent=6,
            textColor=colors.HexColor("#374151"),
        ),
        "admin": ParagraphStyle(
            "ExportAdminNote",
            parent=base["Normal"],
            fontSize=9,
            leading=12,
            leftIndent=6,
            textColor=colors.HexColor("#b91c1c"),
        ),
    }


def _link(url: str, label: str | None = None) -> str:
    safe = escape(url, {'"': "&quot;"})
    return f'<link href="{safe}" color="#1d4ed8">{escape(label or url)}</link>'


def _ip_name(job) -> str:
    person = getattr(job, "assigned_ip", None)
    if not person:
        return "Unassigned"
    full = f"{person.first_name or ''} {person.last_name or ''}".strip()
    return full or (person.phone_number or "Unassigned")


def _header(job, name: str, document_link: str | None, styles: dict) -> list:
    story = [
        Paragraph(escape(name), styles["title"]),
        Paragraph(
            f"Job #{job.id} &middot; exported {now_ist().strftime('%d %b %Y, %H:%M IST')}",
            styles["subtitle"],
        ),
        Spacer(1, 6),
    ]

    rows = [
        ("Project", job.name or job.customer_name or f"Job {job.id}"),
        ("Sales order", job.sales_order or "—"),
        ("Customer", job.customer_name or "—"),
        ("Installation partner", _ip_name(job)),
        ("Job status", (job.status or "—").replace("_", " ").title()),
    ]
    table = Table(
        [[Paragraph(f"<b>{label}</b>", styles["meta"]), Paragraph(escape(str(value)), styles["meta"])]
         for label, value in rows],
        colWidths=[45 * mm, None],
        hAlign="LEFT",
    )
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(table)

    if document_link:
        story.append(Spacer(1, 4))
        story.append(
            Paragraph(
                f"Completed checklist document: {_link(document_link, 'open')}", styles["meta"]
            )
        )

    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", color=colors.HexColor("#d1d5db")))
    story.append(Spacer(1, 8))
    return story


def _item_block(index: int, item: dict, styles: dict, photos_left: int) -> tuple[list, bool]:
    """One item's flowables, plus whether it consumed a photo slot."""
    status = item.get("status")
    review = (getattr(status, "review_status", None) or "pending") if status else "pending"
    checked = bool(getattr(status, "checked", False)) if status else False

    label = review.upper() if checked or review != "pending" else "NOT DONE"
    color = STATUS_COLORS.get(review, NEUTRAL) if checked or review != "pending" else NEUTRAL

    heading = Table(
        [[
            Paragraph(f"<b>{index}.</b> {escape(item.get('text') or '')}", styles["item"]),
            Paragraph(f'<font color="{color}"><b>{label}</b></font>', styles["item"]),
        ]],
        colWidths=[None, 28 * mm],
        hAlign="LEFT",
    )
    heading.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    block = [heading]

    comment = getattr(status, "comment", None) if status else None
    if comment:
        block.append(Paragraph(f"Notes: {escape(comment)}", styles["note"]))
    admin_comment = getattr(status, "admin_comment", None) if status else None
    if admin_comment:
        block.append(Paragraph(f"Admin feedback: {escape(admin_comment)}", styles["admin"]))

    used_photo = False
    link = getattr(status, "document_link", None) if status else None
    if link:
        image = _fetch_image(link) if photos_left > 0 else None
        if image:
            used_photo = True
            reader = ImageReader(io.BytesIO(image))
            width, height = reader.getSize()
            scale = min(PHOTO_RENDER_WIDTH / width, PHOTO_RENDER_MAX_HEIGHT / height)
            block.append(Spacer(1, 3))
            block.append(
                RLImage(
                    io.BytesIO(image),
                    width=width * scale,
                    height=height * scale,
                    hAlign="LEFT",
                )
            )
        else:
            block.append(Paragraph(f"Evidence: {_link(link, 'open attachment')}", styles["note"]))

    block.append(Spacer(1, 10))
    return block, used_photo


def _page_footer(canv, doc) -> None:
    canv.saveState()
    canv.setFont("Helvetica", 8)
    canv.setFillColor(colors.HexColor("#6b7280"))
    canv.drawRightString(A4[0] - 18 * mm, 12 * mm, f"Page {canv.getPageNumber()}")
    canv.restoreState()


def checklist_export_pdf(job, checklist: dict) -> GeneratedDocument:
    """Render one job's checklist — items, statuses, notes and evidence — to PDF.

    `checklist` is one entry from crud.checklist.get_job_checklists_status: a dict
    with `name`, `document_link` and `items`, each item carrying a `status` row
    (checked / review_status / comment / admin_comment / document_link) and already
    sorted by position.
    """
    name = checklist.get("name") or "Checklist"
    items = checklist.get("items") or []

    styles = _styles()
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=18 * mm,
        title=f"{name} - Job {job.id}",
    )

    story = _header(job, name, checklist.get("document_link"), styles)

    if not items:
        story.append(
            Paragraph(
                "This checklist has no line items — see the completed checklist document above.",
                styles["note"],
            )
        )
    else:
        photos_left = MAX_PHOTOS
        for index, item in enumerate(items, start=1):
            block, used_photo = _item_block(index, item, styles, photos_left)
            if used_photo:
                photos_left -= 1
            # KeepTogether so an item's notes and photo never split from its heading.
            story.append(KeepTogether(block))

    doc.build(story, onFirstPage=_page_footer, onLaterPages=_page_footer)

    return GeneratedDocument(
        content=buffer.getvalue(),
        content_type="application/pdf",
        filename=f"Job-{job.id}-{_safe_name(name, 'Checklist')}.pdf",
    )
