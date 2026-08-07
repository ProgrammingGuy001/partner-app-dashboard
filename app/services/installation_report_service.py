"""Daily Installation Report PDF — Playwright renders HTML, pypdf stitches the pages.

Page 1  : the report form (project info, accomplishments, progress, manpower, upcoming work)
Page 2+ : one progress photo per page

Deliberately offline: the logo is a bundled PNG inlined as a data URI and the type
stack is system fonts, so no page render waits on the network. The upstream draft
pulled the logo from modula.in and Montserrat from Google Fonts behind a 30s
``networkidle`` wait, which on a host without egress cost 30s *per page*.

Requires ``playwright install chromium`` on the host (see app/Dockerfile).
"""

import asyncio
import base64
import html
import io
import logging
import re
from dataclasses import dataclass
from datetime import date
from functools import lru_cache
from pathlib import Path

from PIL import Image
from playwright.async_api import async_playwright
from pypdf import PdfReader, PdfWriter

logger = logging.getLogger(__name__)

# ── Canvas ───────────────────────────────────────────────────────────────────
PAGE_W = 1080
PAGE_H = 1527

# ── Brand ────────────────────────────────────────────────────────────────────
BRAND_BROWN = "#7B3F1E"
BRAND_LIGHT = "#F5E6D8"
TEXT_DARK = "#1A1A1A"

LOGO_PATH = Path(__file__).resolve().parents[1] / "templates" / "documents" / "modula-logo.png"

# One page per photo, one Chromium per report: cap the work a single request can
# ask for. 12 photos ≈ 13 pages, comfortably inside a normal request timeout.
MAX_PHOTOS = 12

# Clients compress progress photos to ~150KB before upload (1280px / q0.70), so
# 2MB is ~13x headroom for an odd device while capping a whole submission at 24MB
# instead of 60MB. Every byte is held in memory until the PDF is rendered.
MAX_PHOTO_UPLOAD_MB = 2

# Photos are re-encoded through Pillow before embedding, which also strips EXIF
# and neutralises anything hidden in the original container.
#
# Sizing note: a photo renders ~974px wide on the page (1080 minus padding and
# border), so 1200px is deliberate headroom for zooming in on site detail — not
# waste. Progress photos are never uploaded to S3; this embedded copy is the only
# one that survives, so it is sized as an archival record, not a thumbnail.
PHOTO_MAX_WIDTH = 1200
PHOTO_JPEG_QUALITY = 75

BROWSER_ARGS = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
]


@dataclass(frozen=True)
class GeneratedDocument:
    content: bytes
    content_type: str
    filename: str


# ─────────────────────────────────────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _esc(value) -> str:
    """Escape user text for HTML, quotes included so it is attribute-safe too."""
    return html.escape(str(value or ""), quote=True)


def _safe_name(value: str, fallback: str) -> str:
    name = re.sub(r"[^A-Za-z0-9._ -]", "-", value.strip()).strip(" .-")
    return name or fallback


# The logo renders 48px tall; the source asset is 3294x889. Chromium embeds PNGs
# losslessly and once *per page*, so shipping the full-size file cost ~86KB on
# every page. Downscale to 2x the render height for crispness and no more.
LOGO_RENDER_HEIGHT = 48


@lru_cache(maxsize=1)
def _logo_data_uri() -> str:
    logo = Image.open(LOGO_PATH)
    target_height = LOGO_RENDER_HEIGHT * 2
    if logo.height > target_height:
        width = round(logo.width * target_height / logo.height)
        logo = logo.resize((width, target_height), Image.LANCZOS)
    buffer = io.BytesIO()
    logo.save(buffer, format="PNG", optimize=True)
    return f"data:image/png;base64,{base64.b64encode(buffer.getvalue()).decode()}"


def _compress_image(buf: bytes) -> bytes:
    """Downscale and re-encode to JPEG so a 12MP phone photo does not blow up the PDF."""
    img = Image.open(io.BytesIO(buf))
    if img.width > PHOTO_MAX_WIDTH:
        ratio = PHOTO_MAX_WIDTH / img.width
        img = img.resize((PHOTO_MAX_WIDTH, int(img.height * ratio)), Image.LANCZOS)
    out = io.BytesIO()
    img.convert("RGB").save(
        out,
        format="JPEG",
        quality=PHOTO_JPEG_QUALITY,
        # Better Huffman tables for the same pixels: ~9% smaller, zero quality cost.
        optimize=True,
        progressive=True,
    )
    return out.getvalue()


def _logo_html(left_content: str) -> str:
    return f"""
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;">
      <div>{left_content}</div>
      <img src="{_logo_data_uri()}" style="height:48px;object-fit:contain;" />
    </div>"""


_BASE_CSS = f"""
* {{ margin:0; padding:0; box-sizing:border-box; }}
html, body {{
  width: {PAGE_W}px;
  font-family: 'Segoe UI', 'DejaVu Sans', Arial, Helvetica, sans-serif;
  color: {TEXT_DARK};
  background: #fff;
}}
.page {{ width: {PAGE_W}px; padding: 48px 52px; }}
.info-table {{ width: 100%; border-collapse: collapse; margin-bottom: 18px; }}
.info-table td, .info-table th {{ border: 1px solid #ccc; padding: 9px 14px; font-size: 15px; }}
.section-header {{
  background: {BRAND_BROWN}; color: #fff; text-align: center;
  font-weight: 700; font-size: 16px; letter-spacing: 0.5px; padding: 8px;
}}
.sub-header {{
  background: {BRAND_LIGHT}; font-weight: 600; text-align: center;
  font-size: 15px; color: {BRAND_BROWN};
}}
.label-cell {{ width: 28%; font-weight: 600; background: #fafafa; color: #444; }}
.value-cell {{ width: 72%; }}
.action-row td {{ min-height: 32px; height: 36px; }}
.mp-label   {{ width:22%; font-weight:600; background:#fafafa; }}
.mp-num     {{ width:9%;  text-align:center; }}
.mp-tag     {{ width:10%; text-align:center; background:{BRAND_LIGHT}; font-weight:600; font-size:13px; }}
.mp-time    {{ width:16%; text-align:center; }}
.mp-mandays {{ width:14%; text-align:center; background:{BRAND_LIGHT}; font-weight:600; font-size:13px; }}
"""


# ─────────────────────────────────────────────────────────────────────────────
#  Page builders
# ─────────────────────────────────────────────────────────────────────────────

def _blank_rows(count: int, columns: int) -> str:
    cells = "".join("<td>&nbsp;</td>" for _ in range(columns))
    return f'<tr class="action-row">{cells}</tr>' * count


def _build_report_page(d: dict) -> str:
    project_rows = ""
    for label, value in [
        ("Project Name", d.get("projectName")),
        ("Report Date", d.get("reportDate") or date.today().strftime("%d/%m/%Y")),
        ("Sales Order", d.get("salesOrder")),
        ("Project Supervisor", d.get("projectSupervisor")),
        ("Site Address", d.get("siteAddress")),
    ]:
        if value:
            project_rows += (
                f'<tr><td class="label-cell">{_esc(label)}</td>'
                f'<td class="value-cell">{_esc(value)}</td></tr>'
            )

    accomplishments = [a for a in (d.get("accomplishments") or []) if str(a).strip()]
    acc_rows = "".join(f'<tr class="action-row"><td>{_esc(a)}</td></tr>' for a in accomplishments)
    acc_rows += _blank_rows(max(0, 3 - len(accomplishments)), 1)

    completed = d.get("completedWork") or []
    cw_rows = "".join(
        f"""<tr class="action-row">
              <td>{_esc(row.get('actionItem'))}</td>
              <td style="width:120px;text-align:center">{_esc(row.get('date'))}</td>
              <td>{_esc(row.get('challengesFaced'))}</td>
            </tr>"""
        for row in completed
    )
    cw_rows += _blank_rows(max(0, 3 - len(completed)), 3)

    mp = d.get("manpower") or {}
    upcoming = d.get("upcomingWork") or []
    uw_rows = "".join(
        f"""<tr class="action-row">
              <td>{_esc(row.get('actionItem'))}</td>
              <td style="width:120px;text-align:center">{_esc(row.get('date'))}</td>
              <td>{_esc(row.get('potentialIssues'))}</td>
            </tr>"""
        for row in upcoming
    )
    uw_rows += _blank_rows(max(0, 3 - len(upcoming)), 3)

    logo = _logo_html(
        '<div style="font-size:38px;font-weight:700;letter-spacing:1px;">Daily Installation Report</div>'
    )

    return f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"/><style>{_BASE_CSS}</style></head>
<body><div class="page">

  {logo}

  <table class="info-table">
    <tr><td colspan="2" class="section-header">Project Information</td></tr>
    {project_rows or '<tr><td colspan="2">&nbsp;</td></tr>'}
  </table>

  <table class="info-table">
    <tr><td class="section-header">Project Status Summary</td></tr>
    <tr><td class="sub-header">Key Accomplishments</td></tr>
    {acc_rows}
  </table>

  <table class="info-table">
    <tr><td colspan="3" class="section-header">Progress Report of the day</td></tr>
    <tr><td colspan="3" class="sub-header">Completed Work</td></tr>
    <tr><th>Action Item</th><th style="width:120px">Date</th><th>Challenges Faced</th></tr>
    {cw_rows}
  </table>

  <table class="info-table">
    <tr>
      <td colspan="6" class="section-header" style="text-align:left;padding-left:16px">
        Man Power Available for the day
      </td>
      <td class="mp-mandays">Mandays</td>
    </tr>
    <tr>
      <td class="mp-label">No. of IPs Present</td>
      <td class="mp-num">{_esc(mp.get('numIPs'))}</td>
      <td class="mp-tag">In Time</td><td class="mp-time">{_esc(mp.get('ipInTime'))}</td>
      <td class="mp-tag">Out Time</td><td class="mp-time">{_esc(mp.get('ipOutTime'))}</td>
      <td rowspan="3" style="text-align:center;vertical-align:middle;font-size:22px;font-weight:700">{_esc(mp.get('mandays'))}</td>
    </tr>
    <tr>
      <td class="mp-label">No. of Helpers</td>
      <td class="mp-num">{_esc(mp.get('numHelpers'))}</td>
      <td class="mp-tag">In Time</td><td class="mp-time">{_esc(mp.get('helperInTime'))}</td>
      <td class="mp-tag">Out Time</td><td class="mp-time">{_esc(mp.get('helperOutTime'))}</td>
    </tr>
    <tr>
      <td class="mp-label">No. of Labour</td>
      <td class="mp-num">{_esc(mp.get('numLabour'))}</td>
      <td class="mp-tag">In Time</td><td class="mp-time">{_esc(mp.get('labourInTime'))}</td>
      <td class="mp-tag">Out Time</td><td class="mp-time">{_esc(mp.get('labourOutTime'))}</td>
    </tr>
  </table>

  <table class="info-table">
    <tr><td colspan="3" class="section-header">Upcoming Work for next day</td></tr>
    <tr><th>Action Item</th><th style="width:120px">Date</th><th>Potential Issues that can hinder</th></tr>
    {uw_rows}
  </table>

</div></body></html>"""


def _build_photo_page(image: bytes, caption: str, page_num: int, total_pages: int) -> str:
    uri = f"data:image/jpeg;base64,{base64.b64encode(image).decode()}"
    logo = _logo_html(
        f'<div style="font-size:22px;font-weight:700;color:{BRAND_BROWN};">'
        f'Pictorial Attachment of Daily Progress Report</div>'
    )
    return f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"/><style>{_BASE_CSS}</style></head>
<body><div class="page">
  {logo}
  <div style="font-size:13px;color:#aaa;margin-bottom:20px;">Page {page_num} of {total_pages}</div>
  <div style="border:1px solid #ddd;border-radius:6px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
    <img src="{uri}" style="display:block;width:100%;max-height:1200px;object-fit:contain;background:#f8f8f8;"/>
    <div style="padding:6px 12px;font-size:13px;color:#888;background:#fafafa;border-top:1px solid #eee;">
      {_esc(caption)}
    </div>
  </div>
</div></body></html>"""


# ─────────────────────────────────────────────────────────────────────────────
#  Render
# ─────────────────────────────────────────────────────────────────────────────

async def _html_to_pdf(page, markup: str) -> bytes:
    # Everything is inlined, so "load" is the last event that matters — no networkidle.
    await page.set_content(markup, wait_until="load", timeout=30_000)
    # Measure .page, not documentElement.scrollHeight — the latter never reports less
    # than the viewport, which pads every short page with blank space.
    content_height = await page.evaluate(
        "() => Math.ceil(document.querySelector('.page').getBoundingClientRect().height)"
    )
    return await page.pdf(
        width=f"{PAGE_W}px",
        height=f"{max(content_height, 400)}px",
        print_background=True,
        margin={"top": "0px", "right": "0px", "bottom": "0px", "left": "0px"},
    )


async def render_installation_report(data: dict) -> bytes:
    """Render the report to PDF bytes. ``photos`` is a list of {bytes, filename}."""
    photos = (data.get("photos") or [])[:MAX_PHOTOS]
    total_pages = 1 + len(photos)

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(args=BROWSER_ARGS)
        try:
            context = await browser.new_context(viewport={"width": PAGE_W, "height": PAGE_H})
            page = await context.new_page()

            buffers = [await _html_to_pdf(page, _build_report_page(data))]

            for index, photo in enumerate(photos):
                caption = f"Photo {index + 1} — {photo.get('filename') or 'photo.jpg'}"
                buffers.append(
                    await _html_to_pdf(
                        page,
                        _build_photo_page(
                            _compress_image(photo["bytes"]), caption, index + 2, total_pages
                        ),
                    )
                )
        finally:
            await browser.close()

    writer = PdfWriter()
    for buf in buffers:
        for pdf_page in PdfReader(io.BytesIO(buf)).pages:
            writer.add_page(pdf_page)

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


# ─────────────────────────────────────────────────────────────────────────────
#  Application entry point
# ─────────────────────────────────────────────────────────────────────────────

def _supervisor_name(job) -> str:
    """The on-site IP who filed the report. assigned_ip is eager-loaded by JOB_LOAD_OPTIONS."""
    person = job.assigned_ip
    if not person:
        return ""
    full = f"{person.first_name or ''} {person.last_name or ''}".strip()
    return full or (person.phone_number or "")


def _site_address(job) -> str:
    parts = [job.address_line_1, job.address_line_2, job.city, job.state]
    address = ", ".join(part for part in parts if part)
    return f"{address} - {job.pincode}" if address and job.pincode else address


def build_report_payload(
    job,
    report_date: date,
    details,
    photos: list[dict],
    project: dict | None = None,
) -> dict:
    """Map the job + DailyInstallationReportData onto the renderer's camelCase dict."""
    if project is None:
        project = {
            "projectName": job.name or job.customer_name or f"Job {job.id}",
            "salesOrder": job.sales_order,
            "projectSupervisor": _supervisor_name(job),
            "siteAddress": _site_address(job),
        }
    return {
        **project,
        "reportDate": report_date.strftime("%d/%m/%Y"),
        "accomplishments": list(details.accomplishments),
        "completedWork": [
            {
                "actionItem": row.action_item,
                "date": row.date,
                "challengesFaced": row.challenges_faced,
            }
            for row in details.completed_work
        ],
        "manpower": {
            "numIPs": details.num_ips,
            "numHelpers": details.num_helpers,
            "numLabour": details.num_labour,
            "ipInTime": details.ip_in_time,
            "ipOutTime": details.ip_out_time,
            "helperInTime": details.helper_in_time,
            "helperOutTime": details.helper_out_time,
            "labourInTime": details.labour_in_time,
            "labourOutTime": details.labour_out_time,
            "mandays": details.mandays,
        },
        "upcomingWork": [
            {
                "actionItem": row.action_item,
                "date": row.date,
                "potentialIssues": row.potential_issues,
            }
            for row in details.upcoming_work
        ],
        "photos": photos,
    }


async def generate_daily_installation_report(
    job,
    report_date: date,
    details,
    photos: list[dict] | None = None,
    project: dict | None = None,
) -> GeneratedDocument:
    """Build the Daily Installation Report for one job/day."""
    payload = build_report_payload(job, report_date, details, photos or [], project=project)
    job_reference = f"Job {job.id}" if job else payload["projectName"]
    logger.info(
        "Rendering daily installation report job=%s date=%s photos=%s",
        job_reference, report_date.isoformat(), len(payload["photos"]),
    )
    content = await render_installation_report(payload)
    filename = _safe_name(
        f"Daily Installation Report - {job_reference} - {report_date.isoformat()}.pdf",
        f"daily-installation-report-{report_date.isoformat()}.pdf",
    )
    return GeneratedDocument(content, "application/pdf", filename)


def generate_daily_installation_report_sync(*args, **kwargs) -> GeneratedDocument:
    """For sync callers (scheduler jobs, scripts). Never call from a running loop."""
    return asyncio.run(generate_daily_installation_report(*args, **kwargs))
