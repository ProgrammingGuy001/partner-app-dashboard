"""
Customer OTP Service for job start/finish verification.
Sends OTP to customer phone and verifies before allowing job status changes.
"""
import logging
import requests
import urllib.parse
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import settings
from app.utils.helpers import generate_otp, capitalize_first_name
from app.model.job import Job

logger = logging.getLogger(__name__)
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


class CustomerOTPService:

    @staticmethod
    def generate_and_store_start_otp(db: Session, job_id: int) -> str:
        """Generate OTP for job start and store hashed OTP in DB with expiry"""
        otp = generate_otp(settings.OTP_LENGTH)
        # DEBUG: Remove in production
        print(f"Start OTP for job {job_id}: {otp}")
        
        expiry_time = datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)
        
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            raise Exception(f"Job {job_id} not found")
        
        job.start_otp = pwd_context.hash(str(otp))
        job.start_otp_expiry = expiry_time
        job.start_otp_verified = False
        db.commit()
        
        return otp

    @staticmethod
    def verify_start_otp(db: Session, job_id: int, otp: str) -> bool:
        """Verify start OTP against hashed value in DB"""
        job = db.query(Job).filter(Job.id == job_id).first()
        
        if not job or not job.start_otp:
            return False
        
        # Handle timezone for expiry check
        expiry = job.start_otp_expiry
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        
        # Check expiry
        if expiry < datetime.now(timezone.utc):
            job.start_otp = None
            job.start_otp_expiry = None
            db.commit()
            return False
        
        # Verify hashed OTP
        if not pwd_context.verify(str(otp).strip(), job.start_otp):
            return False
        
        # OTP valid, mark as verified and clear OTP
        job.start_otp = None
        job.start_otp_expiry = None
        job.start_otp_verified = True
        db.commit()
        
        return True

    @staticmethod
    def generate_and_store_end_otp(db: Session, job_id: int) -> str:
        """Generate OTP for job completion and store hashed OTP in DB with expiry"""
        otp = generate_otp(settings.OTP_LENGTH)
        # DEBUG: Remove in production
        print(f"End OTP for job {job_id}: {otp}")
        
        expiry_time = datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)
        
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            raise Exception(f"Job {job_id} not found")
        
        job.end_otp = pwd_context.hash(str(otp))
        job.end_otp_expiry = expiry_time
        job.end_otp_verified = False
        db.commit()
        
        return otp

    @staticmethod
    def verify_end_otp(db: Session, job_id: int, otp: str) -> bool:
        """Verify end OTP against hashed value in DB"""
        job = db.query(Job).filter(Job.id == job_id).first()
        
        if not job or not job.end_otp:
            return False
        
        # Handle timezone for expiry check
        expiry = job.end_otp_expiry
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        
        # Check expiry
        if expiry < datetime.now(timezone.utc):
            job.end_otp = None
            job.end_otp_expiry = None
            db.commit()
            return False
        
        # Verify hashed OTP
        if not pwd_context.verify(str(otp).strip(), job.end_otp):
            return False
        
        # OTP valid, mark as verified and clear OTP
        job.end_otp = None
        job.end_otp_expiry = None
        job.end_otp_verified = True
        db.commit()
        
        return True

    @staticmethod
    def send_customer_sms(phone_number: str, customer_name: str, otp_code: str, action_type: str) -> bool:
        """Send OTP SMS to customer phone"""
        try:
            username = settings.RML_SMS_USERNAME
            password = settings.RML_SMS_PASSWORD
            sender_id = settings.RML_SMS_SENDER_ID
            entity_id = settings.RML_SMS_ENTITY_ID
            template_id = settings.RML_SMS_TEMPLATE_ID
            
            formatted_number = phone_number if phone_number.startswith("91") else f"91{phone_number}"
            capitalized_name = capitalize_first_name(customer_name)
            
            action_text = "start" if action_type == "start" else "complete"
            message = f"Hi {capitalized_name}, Here's your OTP to {action_text} the job: {otp_code}. Keep it safe and don't share it with anyone. - Team Modula"
            
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
            
            logger.info(f"Customer OTP sent successfully to {formatted_number[:4]}****")
            return True
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Error sending customer SMS: {str(e)}")
            return False

    @staticmethod
    def send_start_otp(db: Session, job_id: int, phone_number: str, customer_name: str) -> dict:
        """Generate and send start OTP to customer"""
        otp = CustomerOTPService.generate_and_store_start_otp(db, job_id)
        sms_sent = CustomerOTPService.send_customer_sms(phone_number, customer_name, otp, "start")
        
        return {
            "success": sms_sent,
            "message": "OTP sent successfully" if sms_sent else "Failed to send OTP"
        }

    @staticmethod
    def send_end_otp(db: Session, job_id: int, phone_number: str, customer_name: str) -> dict:
        """Generate and send end OTP to customer"""
        otp = CustomerOTPService.generate_and_store_end_otp(db, job_id)
        sms_sent = CustomerOTPService.send_customer_sms(phone_number, customer_name, otp, "complete")
        
        return {
            "success": sms_sent,
            "message": "OTP sent successfully" if sms_sent else "Failed to send OTP"
        }
