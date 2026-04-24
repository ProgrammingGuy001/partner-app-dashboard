import io
import logging
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from openpyxl.cell.cell import MergedCell
from openpyxl import load_workbook
from sqlalchemy.orm import Session

import app.model as models
from app.model.invoice_request import InvoiceRequest
from app.services.bank_service import BankService


logger = logging.getLogger(__name__)


class BillingService:
    TEMPLATE_CANDIDATES = ("Billing format.xlsx",)

    @classmethod
    def _resolve_template_path(cls) -> Path:
        root = Path(__file__).resolve().parents[2]
        for candidate in cls.TEMPLATE_CANDIDATES:
            path = root / candidate
            if path.exists():
                return path

        for path in root.glob("*.xlsx"):
            if "billing" in path.name.lower():
                return path

        raise FileNotFoundError("Billing template not found in project root")

    @staticmethod
    def _latest_invoice_request(db: Session, job_id: int) -> InvoiceRequest | None:
        return (
            db.query(InvoiceRequest)
            .filter(InvoiceRequest.job_id == job_id)
            .filter(InvoiceRequest.status == "approved")
            .order_by(InvoiceRequest.requested_at.desc())
            .first()
        )

    @staticmethod
    def _amount_to_words(amount: Decimal) -> str:
        ones = [
            "",
            "One",
            "Two",
            "Three",
            "Four",
            "Five",
            "Six",
            "Seven",
            "Eight",
            "Nine",
            "Ten",
            "Eleven",
            "Twelve",
            "Thirteen",
            "Fourteen",
            "Fifteen",
            "Sixteen",
            "Seventeen",
            "Eighteen",
            "Nineteen",
        ]
        tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

        def convert(num: int) -> str:
            if num == 0:
                return ""
            if num < 20:
                return ones[num]
            if num < 100:
                return tens[num // 10] + (f" {ones[num % 10]}" if num % 10 else "")
            if num < 1000:
                return ones[num // 100] + " Hundred" + (f" {convert(num % 100)}" if num % 100 else "")
            if num < 100000:
                return convert(num // 1000) + " Thousand" + (f" {convert(num % 1000)}" if num % 1000 else "")
            if num < 10000000:
                return convert(num // 100000) + " Lakh" + (f" {convert(num % 100000)}" if num % 100000 else "")
            return convert(num // 10000000) + " Crore" + (f" {convert(num % 10000000)}" if num % 10000000 else "")

        rounded = amount.quantize(Decimal("0.01"))
        rupees = int(rounded)
        paise = int((rounded - Decimal(rupees)) * 100)
        words = convert(rupees) if rupees else "Zero"
        result = f"{words} Rupees"
        if paise:
            result += f" and {convert(paise)} Paise"
        return f"{result} Only"

    @staticmethod
    def _set(sheet: Any, cell: str, value: Any) -> None:
        if isinstance(sheet[cell], MergedCell):
            return
        sheet[cell] = value if value is not None else ""

    @staticmethod
    def _clean_text(value: Any) -> str:
        if value is None:
            return ""
        text = str(value).strip()
        return "" if text.lower() == "none" else text

    @classmethod
    def _resolve_bank_details(cls, financial: Any) -> dict[str, str]:
        bank_name = ""
        branch_name = ""
        account_holder_name = cls._clean_text(financial.account_holder_name if financial else None)
        account_number = cls._clean_text(financial.account_number if financial else None)
        ifsc_code = cls._clean_text(financial.ifsc_code if financial else None)

        if not ifsc_code:
            return {
                "bank_name": bank_name,
                "branch_name": branch_name,
                "account_holder_name": account_holder_name,
                "account_number": account_number,
                "ifsc_code": ifsc_code,
            }

        ifsc_lookup = BankService.fetch_ifsc_details(ifsc_code)
        if ifsc_lookup.get("success"):
            bank_name = cls._clean_text(ifsc_lookup.get("bank_name"))
            branch_name = cls._clean_text(ifsc_lookup.get("branch_name"))
            ifsc_code = cls._clean_text(ifsc_lookup.get("ifsc_code")) or ifsc_code
        else:
            logger.info("Unable to enrich IFSC details for billing export: %s", ifsc_lookup.get("message"))

        return {
            "bank_name": bank_name,
            "branch_name": branch_name,
            "account_holder_name": account_holder_name,
            "account_number": account_number,
            "ifsc_code": ifsc_code,
        }

    @classmethod
    def generate_invoice_xlsx(
        cls,
        db: Session,
        job_id: int,
        *,
        ip_user_id: int | None = None,
        admin_id: int | None = None,
        is_superadmin: bool = False,
    ) -> bytes:
        query = db.query(models.Job).filter(models.Job.id == job_id)
        if ip_user_id is not None:
            query = query.filter(models.Job.assigned_ip_id == ip_user_id)
        elif admin_id is not None and not is_superadmin:
            query = query.filter(models.Job.admin_assigned == admin_id)

        job = query.first()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        if not job.assigned_ip or job.assigned_ip.is_internal:
            raise HTTPException(status_code=403, detail="Billing is only available for external IP jobs")

        invoice_request = cls._latest_invoice_request(db, job_id)
        if not invoice_request:
            raise HTTPException(status_code=400, detail="Invoice must be approved before bill generation")

        ip_user = job.assigned_ip
        financial = ip_user.financial
        rate = Decimal(job.rate or 0)
        quantity = Decimal(job.size or 1)
        total_amount = rate * quantity
        today = datetime.utcnow().strftime("%d-%m-%Y")
        invoice_no = invoice_request.invoice_number or f"INV-{job.id}-{datetime.utcnow().year}"
        job_type = (job.type or "B2B Installation/B2C Installation").replace("_", " ").title()
        uom = "Sq. Ft." if job.size else "NO."
        ip_name = f"{ip_user.first_name or ''} {ip_user.last_name or ''}".strip()
        bank_details = cls._resolve_bank_details(financial)

        workbook = load_workbook(cls._resolve_template_path())
        sheet = workbook.active

        cls._set(sheet, "B2", ip_name or "Automatic")
        cls._set(sheet, "B5", f"Project Name :- {cls._clean_text(job.name) or 'Automatic'}")
        cls._set(sheet, "B6", f"Mob. : {cls._clean_text(ip_user.phone_number)}".rstrip())
        cls._set(sheet, "B8", f"Project ID:- {job.id}")
        cls._set(sheet, "B9", f"Invoice no. :- {invoice_no}")
        cls._set(sheet, "B10", f"Invoice Date:- {today}")
        cls._set(sheet, "B11", f"State:- {cls._clean_text(job.state)}".rstrip())
        cls._set(sheet, "B12", f"PAN No. :- {cls._clean_text(financial.pan_number if financial else None)}".rstrip())
        cls._set(sheet, "B14", job.name or "PROJECT NAME")

        cls._set(sheet, "B18", 1)
        cls._set(sheet, "C18", job_type)
        cls._set(sheet, "D18", uom)
        cls._set(sheet, "E18", float(quantity))
        cls._set(sheet, "F18", float(rate))
        cls._set(sheet, "K18", float(total_amount))

        for row in range(19, 30):
            for col in ("B", "C", "D", "E", "F", "G", "H", "I", "K"):
                cls._set(sheet, f"{col}{row}", "")

        cls._set(sheet, "B30", "Total Amount ")
        cls._set(sheet, "K30", float(total_amount))
        cls._set(sheet, "B31", f"Amounts in words :-  {cls._amount_to_words(total_amount)}")

        cls._set(sheet, "B35", "Bank Details :-")
        cls._set(sheet, "B36", f"Name of Bank :- {bank_details['bank_name']}".rstrip())
        cls._set(sheet, "B37", f"Branch :- {bank_details['branch_name']}".rstrip())
        cls._set(sheet, "B38", f"Account holder :- {bank_details['account_holder_name']}".rstrip())
        cls._set(sheet, "B39", f"Acoount No. :- {bank_details['account_number']}".rstrip())
        cls._set(sheet, "B40", f"IFSC CODE :- {bank_details['ifsc_code']}".rstrip())

        output = io.BytesIO()
        workbook.save(output)
        output.seek(0)
        return output.getvalue()
