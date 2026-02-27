import logging
import urllib.parse
from datetime import datetime, timedelta, timezone

import requests
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import settings
from app.model.ip import ip
from app.model.otp_session import OTPSession
from app.utils.helpers import capitalize_first_name, generate_otp

logger = logging.getLogger(__name__)
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


class OTPService:
    LOGIN_PURPOSE = "ip_login"

    @staticmethod
    def _mask_phone(phone_number: str) -> str:
        if not phone_number:
            return "unknown"
        if len(phone_number) <= 4:
            return "*" * len(phone_number)
        return f"{phone_number[:2]}****{phone_number[-2:]}"

    @staticmethod
    def generate_and_store_otp(db: Session, phone_number: str) -> str:
        """Generate OTP and persist in otp_sessions."""
        otp = generate_otp(settings.OTP_LENGTH)
        expiry_time = datetime.now(timezone.utc) + timedelta(
            minutes=settings.OTP_EXPIRY_MINUTES
        )

        user = db.query(ip).filter(ip.phone_number == phone_number).first()
        if not user:
            raise Exception("User not found")

        db.query(OTPSession).filter(
            OTPSession.purpose == OTPService.LOGIN_PURPOSE,
            OTPSession.phone_number == phone_number,
            OTPSession.is_used == False,
        ).update({"is_used": True}, synchronize_session=False)

        db.add(
            OTPSession(
                purpose=OTPService.LOGIN_PURPOSE,
                phone_number=phone_number,
                otp_hash=pwd_context.hash(str(otp)),
                expires_at=expiry_time,
                ip_user_id=user.id,
                is_used=False,
                attempt_count=0,
            )
        )
        db.commit()

        if settings.OTP_DEBUG_LOG_ENABLED:
            logger.warning(
                "OTP_DEBUG purpose=%s phone=%s otp=%s expires_at=%s",
                OTPService.LOGIN_PURPOSE,
                OTPService._mask_phone(phone_number),
                otp,
                expiry_time.isoformat(),
            )

        return otp

    @staticmethod
    def verify_otp(db: Session, phone_number: str, otp: str) -> bool:
        """Verify OTP from otp_sessions."""
        session = (
            db.query(OTPSession)
            .filter(
                OTPSession.purpose == OTPService.LOGIN_PURPOSE,
                OTPSession.phone_number == phone_number,
                OTPSession.is_used == False,
            )
            .order_by(OTPSession.created_at.desc())
            .first()
        )

        if not session:
            return False

        expiry = session.expires_at
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)

        if expiry < datetime.now(timezone.utc):
            session.is_used = True
            db.commit()
            return False

        if not pwd_context.verify(str(otp).strip(), session.otp_hash):
            session.attempt_count = (session.attempt_count or 0) + 1
            db.commit()
            return False

        session.is_used = True
        db.commit()
        return True

    @staticmethod
    def send_sms(mobile_number: str, first_name: str, otp_code: str) -> bool:
        try:
            username = settings.RML_SMS_USERNAME
            password = settings.RML_SMS_PASSWORD
            sender_id = settings.RML_SMS_SENDER_ID
            entity_id = settings.RML_SMS_ENTITY_ID
            template_id = settings.RML_SMS_TEMPLATE_ID

            formatted_number = (
                mobile_number
                if mobile_number.startswith("91")
                else f"91{mobile_number}"
            )
            capitalized_first_name = capitalize_first_name(first_name)
            message = (
                f"Hi {capitalized_first_name}, Here's your Modula OTP: {otp_code}. "
                "Keep it safe and don't share it with anyone. - Team Modula"
            )

            encoded_password = urllib.parse.quote(password)
            encoded_message = urllib.parse.quote(message)
            url = (
                f"https://sms6.rmlconnect.net:8443/bulksms/bulksms?"
                f"username={username}&password={encoded_password}&type=0&dlr=1&"
                f"destination={formatted_number}&source={sender_id}&message={encoded_message}&"
                f"entityid={entity_id}&tempid={template_id}"
            )

            response = requests.get(url, timeout=10)
            response.raise_for_status()
            logger.info(f"OTP sent successfully to {formatted_number[:4]}****")
            return True
        except requests.exceptions.RequestException as e:
            logger.error(f"Error sending SMS: {str(e)}")
            return False

    @staticmethod
    def send_otp(db: Session, phone_number: str, user_name: str = "ip") -> dict:
        otp = OTPService.generate_and_store_otp(db, phone_number)
        sms_sent = OTPService.send_sms(phone_number, user_name, otp)
        return {
            "success": sms_sent,
            "message": "OTP sent successfully" if sms_sent else "Failed to send OTP",
        }
