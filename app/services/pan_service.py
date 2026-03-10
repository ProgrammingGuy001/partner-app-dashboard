import logging

import requests

from app.config import settings

logger = logging.getLogger(__name__)


class PANService:

    @staticmethod
    def verify_pan(pan_number: str) -> dict:
        """Verify PAN using Attestr API"""
        try:
            url = 'https://api.attestr.com/api/v2/public/checkx/pan'

            headers = {
                'Content-Type': 'application/json',
                'Authorization': settings.ATTESTR_API_KEY
            }

            payload = {
                'pan': pan_number.upper()
            }

            response = requests.post(url, json=payload, headers=headers, timeout=30)
            response.raise_for_status()

            data = response.json()
            logger.info("PAN verification completed: valid=%s", data.get("valid"))

            # Check if verification was successful
            # Attestr API typically returns status and data
            if data.get('valid') is True:
                return {
                    "success": True,
                    "verified": True,
                    "pan_number": pan_number.upper(),
                    "name": data.get('name'),
                    "message": "PAN verified successfully",
                    "raw_response": data
                }
            else:
                return {
                    "success": False,
                    "verified": False,
                    "pan_number": pan_number.upper(),
                    "message": data.get('message', 'PAN verification failed'),
                    "raw_response": data
                }

        except requests.exceptions.RequestException as e:
            logger.error("Error verifying PAN: %s", e)
            return {
                "success": False,
                "verified": False,
                "message": "PAN verification service unavailable",
            }
        except Exception as e:
            logger.error("Unexpected error verifying PAN: %s", e)
            return {
                "success": False,
                "verified": False,
                "message": "An unexpected error occurred",
            }
