"""
Customer OTP Service for job start/finish verification using otp_sessions.
"""
import logging
import requests
import urllib.parse
from datetime import datetime, timedelta, timezone

from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import settings
from app.model.job import Job
from app.model.otp_session import OTPSession
from app.utils.helpers import capitalize_first_name, generate_otp

logger = logging.getLogger(__name__)
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


class CustomerOTPService:
    START_PURPOSE = "job_start"
    END_PURPOSE = "job_end"

    @staticmethod
    def _mask_phone(phone_number: str) -> str:
        if not phone_number:
            return "unknown"
        if len(phone_number) <= 4:
            return "*" * len(phone_number)
        return f"{phone_number[:2]}****{phone_number[-2:]}"

    @staticmethod
    def _generate_and_store(db: Session, job_id: int, purpose: str) -> str:
        otp = generate_otp(settings.OTP_LENGTH)
        expiry_time = datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)

        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            raise Exception(f"Job {job_id} not found")
        if not job.customer_phone:
            raise Exception("Customer phone missing for this job")

        db.query(OTPSession).filter(
            OTPSession.purpose == purpose,
            OTPSession.job_id == job_id,
            OTPSession.is_used == False,
        ).update({"is_used": True}, synchronize_session=False)

        db.add(
            OTPSession(
                purpose=purpose,
                phone_number=job.customer_phone,
                otp_hash=pwd_context.hash(str(otp)),
                expires_at=expiry_time,
                job_id=job_id,
                is_used=False,
                attempt_count=0,
            )
        )
        db.commit()

        if settings.OTP_DEBUG_LOG_ENABLED:
            logger.warning(
                "OTP_DEBUG purpose=%s job_id=%s phone=%s otp=%s expires_at=%s",
                purpose,
                job_id,
                CustomerOTPService._mask_phone(job.customer_phone),
                otp,
                expiry_time.isoformat(),
            )

        return otp

    @staticmethod
    def _verify(db: Session, job_id: int, otp: str, purpose: str, verified_field: str) -> bool:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return False

        session = (
            db.query(OTPSession)
            .filter(
                OTPSession.purpose == purpose,
                OTPSession.job_id == job_id,
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
        setattr(job, verified_field, True)
        db.commit()
        return True

    @staticmethod
    def verify_start_otp(db: Session, job_id: int, otp: str) -> bool:
        return CustomerOTPService._verify(
            db, job_id, otp, CustomerOTPService.START_PURPOSE, "start_otp_verified"
        )

    @staticmethod
    def verify_end_otp(db: Session, job_id: int, otp: str) -> bool:
        return CustomerOTPService._verify(
            db, job_id, otp, CustomerOTPService.END_PURPOSE, "end_otp_verified"
        )

    @staticmethod
    def send_customer_sms(phone_number: str, customer_name: str, otp_code: str, action_type: str) -> bool:
        try:
            username = settings.RML_SMS_USERNAME
            password = settings.RML_SMS_PASSWORD
            sender_id = settings.RML_SMS_SENDER_ID
            entity_id = settings.RML_SMS_ENTITY_ID
            template_id = settings.RML_SMS_TEMPLATE_ID

            formatted_number = phone_number if phone_number.startswith("91") else f"91{phone_number}"
            capitalized_name = capitalize_first_name(customer_name)
            message = (
                f"Hi {capitalized_name}, Here's your Modula OTP: {otp_code}. "
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
            logger.info(f"Customer OTP sent successfully to {formatted_number[:4]}**** ({action_type})")
            return True
        except requests.exceptions.RequestException as e:
            logger.error(f"Error sending customer SMS: {str(e)}")
            return False

    @staticmethod
    def send_start_otp(db: Session, job_id: int, phone_number: str, customer_name: str) -> dict:
        otp = CustomerOTPService._generate_and_store(db, job_id, CustomerOTPService.START_PURPOSE)
        sms_sent = CustomerOTPService.send_customer_sms(phone_number, customer_name, otp, "start")
        return {"success": sms_sent, "message": "OTP sent successfully" if sms_sent else "Failed to send OTP"}

    @staticmethod
    def send_end_otp(db: Session, job_id: int, phone_number: str, customer_name: str) -> dict:
        otp = CustomerOTPService._generate_and_store(db, job_id, CustomerOTPService.END_PURPOSE)
        sms_sent = CustomerOTPService.send_customer_sms(phone_number, customer_name, otp, "complete")
        return {"success": sms_sent, "message": "OTP sent successfully" if sms_sent else "Failed to send OTP"}
