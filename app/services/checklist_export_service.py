"""Render a filled-in job checklist to PDF.

Distinct from checklist_template_service, which hands out the *blank* workbook.
This one reports what was actually done: every item with its status, notes, admin
feedback and the evidence photo the IP uploaded.

reportlab Platypus, not LibreOffice or Playwright — the item list is
variable-length, which is exactly what a flowable story paginates for free, and it
needs no binary beyond the wheel.
"""

import io
from pathlib import Path
from xml.sax.saxutils import escape

import requests
from PIL import Image
from reportlab.graphics.shapes import Drawing, Rect
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (
    Image as RLImage,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.services.document_automation_service import GeneratedDocument, _safe_name
from app.utils.attendance_policy import now_ist

# A 12MP phone photo at full size would make a 40MB PDF; 900px wide is plenty for
# an A4 page render.
PHOTO_MAX_WIDTH = 900
PHOTO_JPEG_QUALITY = 72
# The supplied paper check sheet carries sixteen evidence photos. Keep a finite
# ceiling, but leave enough room for a real installation rather than dropping the
# last pages of a normal report.
MAX_PHOTOS = 24
FETCH_TIMEOUT_SECONDS = 10
# ponytail: 8MB ceiling on a single download, so one pathological upload can't
# exhaust memory. Raise if real site photos ever exceed it.
MAX_IMAGE_BYTES = 8 * 1024 * 1024

LOGO_PATH = (
    Path(__file__).resolve().parents[1] / "templates" / "documents" / "modula-logo.png"
)
LOGO_RENDER_HEIGHT = 16 * mm


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
            "ExportTitle",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=17,
            leading=20,
            alignment=TA_CENTER,
        ),
        "section": ParagraphStyle(
            "ExportSection",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=12,
            leading=15,
            alignment=TA_CENTER,
            textColor=colors.white,
        ),
        "label": ParagraphStyle(
            "ExportLabel", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=7
        ),
        "value": ParagraphStyle(
            "ExportValue",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=11,
        ),
        "item": ParagraphStyle(
            "ExportItem", parent=base["Normal"], fontSize=7.5, leading=9.5
        ),
        "item_center": ParagraphStyle(
            "ExportItemCenter",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=7.5,
            leading=9.5,
            alignment=TA_CENTER,
        ),
        "note": ParagraphStyle(
            "ExportNote",
            parent=base["Normal"],
            fontSize=7.5,
            leading=9.5,
            textColor=colors.HexColor("#374151"),
        ),
        "photo_caption": ParagraphStyle(
            "ExportPhotoCaption",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#374151"),
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


def _logo_flowable() -> RLImage | None:
    """The Modula mark on the first page. Missing file is not fatal."""
    try:
        reader = ImageReader(str(LOGO_PATH))
        width, height = reader.getSize()
        return RLImage(
            str(LOGO_PATH),
            width=LOGO_RENDER_HEIGHT * width / height,
            height=LOGO_RENDER_HEIGHT,
            hAlign="LEFT",
        )
    except Exception:  # noqa: BLE001 - a missing or unreadable logo must not fail the export
        return None


def _checklist_sheet(
    job,
    name: str,
    document_link: str | None,
    items: list,
    styles: dict,
) -> list:
    story: list = []
    logo = _logo_flowable()
    if logo is not None:
        logo.hAlign = "CENTER"
        story.extend([logo, Spacer(1, 5 * mm)])

    exported = now_ist()
    project = job.name or job.customer_name or f"Job {job.id}"
    details = Table(
        [
            [
                Paragraph("DATE", styles["label"]),
                Paragraph("PROJECT NAME", styles["label"]),
            ],
            [
                Paragraph(exported.strftime("%d/%m/%Y"), styles["value"]),
                Paragraph(escape(str(project)), styles["value"]),
            ],
        ],
        colWidths=[55 * mm, 127 * mm],
        hAlign="CENTER",
    )
    details.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LINEBELOW", (0, 1), (-1, 1), 0.8, colors.HexColor("#111827")),
                ("RIGHTPADDING", (0, 0), (0, -1), 8 * mm),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (1, 0), (1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 1),
                ("BOTTOMPADDING", (0, 1), (-1, 1), 3),
            ]
        )
    )
    story.extend(
        [
            details,
            Spacer(1, 3 * mm),
            Paragraph("Installation checklist", styles["title"]),
            Spacer(1, 2 * mm),
            Table(
                [
                    [
                        Paragraph(
                            escape(
                                name.removesuffix(" Checklist").removesuffix(
                                    " Checksheet"
                                )
                            ),
                            styles["section"],
                        )
                    ]
                ],
                colWidths=[182 * mm],
                style=TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#252525")),
                        ("TOPPADDING", (0, 0), (-1, -1), 4),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ]
                ),
            ),
        ]
    )

    rows = [
        [
            Paragraph("NO.", styles["item_center"]),
            Paragraph("INSTALLATION CHECK POINTS", styles["item_center"]),
            Paragraph("CHECK<br/>BOX", styles["item_center"]),
            Paragraph("REMARKS", styles["item_center"]),
        ]
    ]
    for index, item in enumerate(items, start=1):
        checkbox = Drawing(9, 9)
        checkbox.add(Rect(0.5, 0.5, 8, 8, strokeWidth=0.8, fillColor=None))
        rows.append(
            [
                Paragraph(str(index), styles["item_center"]),
                Paragraph(escape(item.get("text") or ""), styles["item"]),
                checkbox,
                "",
            ]
        )

    if not items:
        rows.append(
            [
                Paragraph("1", styles["item_center"]),
                Paragraph("See the completed checklist document.", styles["item"]),
                Paragraph("&mdash;", styles["item_center"]),
                Paragraph(
                    _link(document_link, "open attachment")
                    if document_link
                    else "No line items",
                    styles["note"],
                ),
            ]
        )

    checklist_table = Table(
        rows,
        colWidths=[10 * mm, 108 * mm, 18 * mm, 46 * mm],
        repeatRows=1,
        hAlign="CENTER",
    )
    checklist_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#ececec")),
                ("GRID", (0, 0), (-1, -1), 0.45, colors.HexColor("#666666")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.extend([checklist_table, Spacer(1, 4 * mm)])

    reviews = [
        status.review_status
        for item in items
        if (status := item.get("status")) and status.checked
    ]
    approval = (
        "Review required"
        if "rejected" in reviews
        else "Approved"
        if items and len(reviews) == len(items) and set(reviews) == {"approved"}
        else "Pending approval"
    )
    signoff = Table(
        [
            [
                Paragraph("CHECKER SIGN", styles["label"]),
                Paragraph("APPROVER STATUS", styles["label"]),
            ],
            [
                Paragraph(escape(_ip_name(job)), styles["value"]),
                Paragraph(approval, styles["value"]),
            ],
        ],
        colWidths=[91 * mm, 91 * mm],
        hAlign="CENTER",
        style=TableStyle(
            [
                ("LINEABOVE", (0, 0), (-1, 0), 0.6, colors.HexColor("#666666")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]
        ),
    )
    story.extend(
        [
            signoff,
            Spacer(1, 2 * mm),
            Paragraph(
                f"Job #{job.id} &middot; Sales order {escape(str(job.sales_order or '-'))}",
                styles["note"],
            ),
        ]
    )
    if document_link:
        story.append(
            Paragraph(
                f"Completed checklist document: {_link(document_link, 'open attachment')}",
                styles["note"],
            )
        )
    return story


def _photo_page(
    number: int, item_number: int, text: str, image: bytes, doc, styles: dict
) -> Table:
    reader = ImageReader(io.BytesIO(image))
    width, height = reader.getSize()
    # Leave a small frame-fit allowance; an exact doc.height table can split its
    # caption and image into two pages because of ReportLab's boundary epsilon.
    photo_height = doc.height - 18 * mm
    scale = min(doc.width / width, photo_height / height)
    photo = RLImage(
        io.BytesIO(image),
        width=width * scale,
        height=height * scale,
        hAlign="CENTER",
    )
    return Table(
        [
            [
                Paragraph(
                    f"PHOTO {number} &middot; ITEM {item_number}: {escape(text)}",
                    styles["photo_caption"],
                )
            ],
            [photo],
        ],
        colWidths=[doc.width],
        rowHeights=[12 * mm, photo_height],
        style=TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 1), (0, 1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        ),
    )


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
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
        title=f"{name} - Job {job.id}",
    )

    photos = []
    for index, item in enumerate(items, start=1):
        status = item.get("status")
        link = getattr(status, "document_link", None) if status else None
        if link and len(photos) < MAX_PHOTOS and (image := _fetch_image(link)):
            photos.append((index, item.get("text") or "", image))

    story = _checklist_sheet(
        job,
        name,
        checklist.get("document_link"),
        items,
        styles,
    )
    for number, (item_number, text, image) in enumerate(photos, start=1):
        story.extend(
            [PageBreak(), _photo_page(number, item_number, text, image, doc, styles)]
        )

    doc.build(story, onFirstPage=_page_footer, onLaterPages=_page_footer)

    return GeneratedDocument(
        content=buffer.getvalue(),
        content_type="application/pdf",
        filename=f"Job-{job.id}-{_safe_name(name, 'Checklist')}.pdf",
    )
