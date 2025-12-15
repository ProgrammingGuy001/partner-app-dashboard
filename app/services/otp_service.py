

import os
import requests
import urllib.parse
from datetime import datetime, timedelta
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import settings
from app.utils.helpers import generate_otp, capitalize_first_name
from app.model.ip import ip  # adjust path

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class OTPService:

    @staticmethod
    def generate_and_store_otp(db: Session, phone_number: str) -> str:
        """Generate OTP and store plain OTP in DB with expiry"""
        otp = generate_otp(settings.OTP_LENGTH)

        expiry_time = datetime.utcnow() + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)

        user = db.query(ip).filter(ip.phone_number == phone_number).first()

        if not user:
            raise Exception("User not found")

        user.otp = str(otp)            # store raw OTP
        user.otp_expiry = expiry_time
        db.commit()

        return otp


    @staticmethod
    def verify_otp(db: Session, phone_number: str, otp: str) -> bool:
        """Check OTP stored in DB"""
        user = db.query(ip).filter(ip.phone_number == phone_number).first()

        if not user or not user.otp:
            return False
        
        # Check expiry
        if user.otp_expiry < datetime.utcnow():
            return False

        # Compare OTP directly
        if str(user.otp) != str(otp).strip():
            return False

        # OTP valid, wipe fields
        user.otp = None
        user.otp_expiry = None
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

            formatted_number = mobile_number if mobile_number.startswith("91") else f"91{mobile_number}"

            capitalized_first_name = capitalize_first_name(first_name)

            message = f"Hi {capitalized_first_name}, Here's your Modula OTP: {otp_code}. Keep it safe and don't share it with anyone. - Team Modula"

            encoded_password = urllib.parse.quote(password)
            encoded_message = urllib.parse.quote(message)

            url = (
                f"https://sms6.rmlconnect.net:8443/bulksms/bulksms?"
                f"username={username}&password={encoded_password}&type=0&dlr=1&"
                f"destination={formatted_number}&source={sender_id}&message={encoded_message}&"
                f"entityid={entity_id}&tempid={template_id}"
            )

            print("Sending SMS to:", formatted_number)
            print("otp isss ", otp_code)
            response = requests.get(url, timeout=10)
            response.raise_for_status()

            print(f"✅ OTP sent successfully to {formatted_number}: {response.text}")
            return True

        except requests.exceptions.RequestException as e:
            print("❌ Error sending SMS:", str(e))
            return False

    @staticmethod
    def send_otp(db: Session, phone_number: str, user_name: str = "ip") -> dict:
        otp = OTPService.generate_and_store_otp(db, phone_number)
        sms_sent = OTPService.send_sms(phone_number, user_name, otp)

        return {
            "success": sms_sent,
            "message": "OTP sent successfully" if sms_sent else "Failed to send OTP",
            "otp": otp if not sms_sent else None
        }
