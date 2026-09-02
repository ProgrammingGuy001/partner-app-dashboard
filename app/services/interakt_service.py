import logging
import re
from datetime import date

import requests

from app.config import settings

logger = logging.getLogger("uvicorn.error")
INTERAKT_MESSAGE_URL = "https://api.interakt.ai/v1/public/message/"


def split_phone(phone_number: str, country_code: str = "+91") -> tuple[str, str]:
    """Return the country code and local number shape required by Interakt."""
    country_digits = re.sub(r"\D", "", country_code)
    digits = re.sub(r"\D", "", phone_number or "").lstrip("0")
    if country_digits and digits.startswith(country_digits) and len(digits) > 10:
        digits = digits[len(country_digits) :]
    if not country_digits or not 6 <= len(digits) <= 15:
        raise ValueError("Customer phone number is not valid for WhatsApp")
    return f"+{country_digits}", digits


def send_ip_visit_notification(
    *,
    customer_phone: str | None,
    customer_name: str,
    ip_name: str,
    job_type: str,
    ip_phone: str | None,
    work_date: date,
    template_name: str | None = None,
    callback_ref: str | None = None,
) -> bool:
    """Queue an approved Interakt template about an IP's visit to a customer's site.

    Both templates (assignment and hour-before reminder) take the same four body
    variables, in this order: customer name, IP name, job type, IP phone number.
    """
    template_name = template_name or settings.INTERAKT_VISIT_TEMPLATE_NAME
    callback_ref = (
        callback_ref or f"roster:{template_name}:{work_date.isoformat()}"
    )[:512]
    if not customer_phone:
        logger.info(
            "Interakt visit notification skipped ref=%s template=%s work_date=%s: customer phone missing",
            callback_ref,
            template_name,
            work_date,
        )
        return False
    if not settings.INTERAKT_API_KEY or not template_name:
        logger.info(
            "Interakt visit notification disabled ref=%s template=%s work_date=%s: credentials/template not configured",
            callback_ref,
            template_name,
            work_date,
        )
        return False

    try:
        country_code, local_phone = split_phone(
            customer_phone, settings.INTERAKT_COUNTRY_CODE
        )
        logger.info(
            "Interakt visit notification triggered ref=%s template=%s work_date=%s recipient=***%s",
            callback_ref,
            template_name,
            work_date,
            local_phone[-4:],
        )
        payload = {
            "countryCode": country_code,
            "phoneNumber": local_phone,
            # What Interakt echoes back on its delivery callback. "<entry id>:<kind>" is
            # the only thing in that payload that maps a status onto a roster row.
            "callbackData": callback_ref,
            "type": "Template",
            "template": {
                "name": template_name,
                "languageCode": settings.INTERAKT_VISIT_TEMPLATE_LANGUAGE,
                "bodyValues": [
                    customer_name or "Customer",
                    ip_name,
                    job_type,
                    ip_phone or "the number on your job card",
                ],
            },
        }
        if settings.INTERAKT_CAMPAIGN_ID:
            payload["campaignId"] = settings.INTERAKT_CAMPAIGN_ID

        response = requests.post(
            INTERAKT_MESSAGE_URL,
            headers={
                "Authorization": f"Basic {settings.INTERAKT_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=10,
        )
        response.raise_for_status()
        result = response.json()
        if not result.get("result"):
            raise ValueError(result.get("message") or "Interakt rejected the message")
        logger.info(
            "Interakt visit notification queued ref=%s template=%s work_date=%s recipient=***%s message_id=%s",
            callback_ref,
            template_name,
            work_date,
            local_phone[-4:],
            result.get("id"),
        )
        return True
    except (ValueError, requests.RequestException) as exc:
        logger.warning(
            "Interakt visit notification failed ref=%s template=%s work_date=%s: %s",
            callback_ref,
            template_name,
            work_date,
            exc,
        )
        return False
