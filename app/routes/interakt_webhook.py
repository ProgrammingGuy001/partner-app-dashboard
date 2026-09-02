"""Inbound delivery callbacks for the customer WhatsApp notices.

Interakt posts template status changes to a URL set in its dashboard, with no custom
headers, so the shared secret rides in the query string like the CRM webhook. The
callbackData we send with each message ("<roster entry id>:assignment" or ":reminder")
is the only thing in the callback that maps a status back onto a roster row.

Status is recorded, never acted on: a "failed" callback does not clear the send stamp,
because resending is exactly the duplicate that stamp exists to prevent.
"""
import logging
import secrets
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.model.roster import JobRosterEntry
from app.utils.rate_limiter import limiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks/interakt", tags=["Interakt Webhook"])

# The half of callbackData that says which of the two notices this callback is about.
STATUS_COLUMNS = {"assignment": "notified_status", "reminder": "reminder_status"}


class InteraktCallback(BaseModel):
    # Interakt sends far more than we read (customer profile, tags, timestamps); ignore it.
    model_config = ConfigDict(extra="ignore")

    type: Optional[str] = None
    data: dict = Field(default_factory=dict)

    def reference_and_status(self) -> tuple[Optional[str], Optional[str]]:
        """Pull the echo of our callbackData and the status out of a payload we don't own.

        Key names differ between Interakt's message and template callbacks, so take the
        first that is present rather than assuming one shape.
        """
        message = self.data.get("message") or {}
        if not isinstance(message, dict):
            message = {}
        reference = message.get("callback_data") or self.data.get("callback_data")
        status = (
            message.get("channel_message_status")
            or message.get("message_status")
            or self.type
        )
        return (
            reference if isinstance(reference, str) else None,
            status if isinstance(status, str) else None,
        )


@router.post("/status")
@limiter.limit("120/minute")
def receive_interakt_status(
    request: Request,
    payload: InteraktCallback,
    token: str = Query(min_length=1),
    db: Session = Depends(get_db),
):
    """Record what Interakt reports about a notice we sent.

    Returns 200 for anything unrecognised - an old callbackData, a template we don't
    track - so Interakt doesn't retry a callback that will never mean anything to us.
    """
    if not settings.INTERAKT_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Interakt webhook is not configured")
    if not secrets.compare_digest(token, settings.INTERAKT_WEBHOOK_SECRET):
        raise HTTPException(status_code=401, detail="Invalid webhook token")

    reference, status = payload.reference_and_status()
    if not reference or not status:
        logger.info("Interakt callback ignored: no callback_data/status (type=%s)", payload.type)
        return {"status": "ignored"}

    entry_id, _, kind = reference.partition(":")
    column = STATUS_COLUMNS.get(kind)
    if column is None or not entry_id.isdigit():
        logger.info("Interakt callback ignored: unrecognised reference %s", reference[:64])
        return {"status": "ignored", "reference": reference[:64]}

    updated = db.execute(
        update(JobRosterEntry)
        .where(JobRosterEntry.id == int(entry_id))
        .values({column: status[:40]})
    ).rowcount
    db.commit()
    if not updated:
        logger.info("Interakt callback for missing roster entry %s", entry_id)
        return {"status": "unknown_entry", "entry_id": int(entry_id)}
    logger.info("Interakt callback: entry=%s %s=%s", entry_id, column, status[:40])
    return {"status": "recorded", "entry_id": int(entry_id), column: status[:40]}
