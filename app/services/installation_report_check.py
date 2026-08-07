"""Self-check for the installation report renderer. No test framework needed.

    python -m app.services.installation_report_check

Renders a real PDF through Chromium and asserts the page count, the field mapping
and that user-supplied text cannot inject markup.
"""

import asyncio
import io
from datetime import date
from types import SimpleNamespace

from PIL import Image
from pypdf import PdfReader

from app.schemas.attendance import (
    DailyInstallationReportData,
    DailyReportCompletedRow,
    DailyReportUpcomingRow,
)
from app.services.installation_report_service import (
    MAX_PHOTOS,
    _build_report_page,
    _site_address,
    _supervisor_name,
    build_report_payload,
    generate_daily_installation_report,
)


def _photo(color: str, size=(1600, 1200)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="JPEG")
    return buf.getvalue()


def _fixtures():
    job = SimpleNamespace(
        id=42,
        name="Prestige Lakeside — Kitchen",
        customer_name="Acme Interiors",
        sales_order="SO-10231",
        address_line_1="12 MG Road",
        address_line_2="Indiranagar",
        city="Bengaluru",
        state="Karnataka",
        pincode=560038,
        assigned_ip=SimpleNamespace(first_name="Ravi", last_name="Kumar", phone_number="9876543210"),
    )
    details = DailyInstallationReportData(
        accomplishments=["Base cabinets aligned", "Countertop dry-fitted"],
        completed_work=[
            DailyReportCompletedRow(
                action_item="Wall unit mounting",
                date="31/07/2026",
                challenges_faced="Uneven wall, packed out with shims",
            )
        ],
        num_ips="2", ip_in_time="09:00", ip_out_time="18:00",
        num_helpers="1", helper_in_time="09:30", helper_out_time="18:00",
        num_labour="3", labour_in_time="09:00", labour_out_time="17:30",
        mandays="6",
        upcoming_work=[
            DailyReportUpcomingRow(
                action_item="Shutter alignment",
                date="01/08/2026",
                potential_issues="Awaiting hinge delivery",
            )
        ],
    )
    return job, details


def check_mapping():
    job, details = _fixtures()
    assert _supervisor_name(job) == "Ravi Kumar"
    assert _site_address(job) == "12 MG Road, Indiranagar, Bengaluru, Karnataka - 560038"

    # No assigned IP and no address must not explode.
    bare = SimpleNamespace(
        id=1, name="X", customer_name=None, sales_order=None,
        address_line_1=None, address_line_2=None, city=None, state=None,
        pincode=None, assigned_ip=None,
    )
    assert _supervisor_name(bare) == ""
    assert _site_address(bare) == ""

    payload = build_report_payload(job, date(2026, 7, 31), details, [])
    assert payload["projectName"] == "Prestige Lakeside — Kitchen"
    assert payload["reportDate"] == "31/07/2026"
    assert payload["manpower"]["mandays"] == "6"
    assert payload["completedWork"][0]["challengesFaced"].startswith("Uneven wall")
    assert payload["upcomingWork"][0]["potentialIssues"] == "Awaiting hinge delivery"

    manual = {
        "projectName": "Manual Site",
        "salesOrder": "SO-MANUAL",
        "projectSupervisor": "Site Lead",
        "siteAddress": "Temporary installation site",
    }
    manual_payload = build_report_payload(None, date(2026, 7, 31), details, [], project=manual)
    assert manual_payload["projectName"] == "Manual Site"
    assert manual_payload["siteAddress"] == "Temporary installation site"
    print("mapping: OK")


def check_escaping():
    """Report text is IP-supplied; it must land as text, never as markup."""
    job, details = _fixtures()
    details.accomplishments = ['<script>alert(1)</script>', 'Fixed "the" <b>panel</b>']
    markup = _build_report_page(build_report_payload(job, date(2026, 7, 31), details, []))
    assert "<script>" not in markup, "script tag survived escaping"
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in markup
    assert "&lt;b&gt;panel&lt;/b&gt;" in markup
    print("escaping: OK")


async def check_render():
    job, details = _fixtures()
    photos = [
        {"bytes": _photo("#8899aa"), "filename": "wall-unit.jpg"},
        {"bytes": _photo("#aa8866"), "filename": "countertop.jpg"},
    ]
    doc = await generate_daily_installation_report(job, date(2026, 7, 31), details, photos=photos)

    assert doc.content_type == "application/pdf"
    assert doc.content[:4] == b"%PDF", "output is not a PDF"
    assert doc.filename == "Daily Installation Report - Job 42 - 2026-07-31.pdf"

    pages = PdfReader(io.BytesIO(doc.content)).pages
    assert len(pages) == 1 + len(photos), f"expected {1 + len(photos)} pages, got {len(pages)}"

    text = pages[0].extract_text() or ""
    for expected in ("Daily Installation Report", "SO-10231", "Ravi Kumar", "Bengaluru", "31/07/2026"):
        assert expected in text, f"missing from page 1: {expected!r}"

    out = "/tmp/daily-installation-report-sample.pdf"
    with open(out, "wb") as fh:
        fh.write(doc.content)
    print(f"render: OK — {len(pages)} pages, {len(doc.content) // 1024} KB, wrote {out}")

    # The photo cap bounds how much work one request can ask for.
    many = [{"bytes": _photo("#cccccc", (400, 300)), "filename": f"p{i}.jpg"} for i in range(MAX_PHOTOS + 3)]
    capped = await generate_daily_installation_report(job, date(2026, 7, 31), details, photos=many)
    capped_pages = len(PdfReader(io.BytesIO(capped.content)).pages)
    assert capped_pages == 1 + MAX_PHOTOS, f"cap not enforced: {capped_pages} pages"
    print(f"photo cap: OK — {MAX_PHOTOS + 3} supplied, {capped_pages} pages rendered")


if __name__ == "__main__":
    check_mapping()
    check_escaping()
    asyncio.run(check_render())
    print("installation report: all checks passed")
