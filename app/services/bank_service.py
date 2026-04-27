import logging

import requests

from app.config import settings

logger = logging.getLogger(__name__)


class BankService:

    @staticmethod
    def fetch_ifsc_details(ifsc_code: str) -> dict:
        """Fetch bank and branch details for an IFSC using Attestr."""
        if not ifsc_code:
            return {"success": False, "message": "IFSC code is required"}

        try:
            url = 'https://api.attestr.com/api/v2/public/finanx/ifsc'

            headers = {
                'Content-Type': 'application/json',
                'Authorization': settings.ATTESTR_API_KEY
            }

            payload = {
                'ifsc': ifsc_code.upper(),
            }

            response = requests.post(url, json=payload, headers=headers, timeout=30)
            response.raise_for_status()

            data = response.json()
            logger.info("IFSC lookup completed: valid=%s", data.get("valid"))

            if data.get('valid') is True:
                return {
                    "success": True,
                    "verified": True,
                    "ifsc_code": data.get('ifsc') or ifsc_code.upper(),
                    "bank_name": data.get('bank'),
                    "branch_name": data.get('branch'),
                    "city": data.get('city'),
                    "state": data.get('state'),
                    "address": data.get('address'),
                    "raw_response": data,
                }

            return {
                "success": False,
                "verified": False,
                "ifsc_code": ifsc_code.upper(),
                "message": data.get('message', 'IFSC validation failed'),
                "raw_response": data,
            }

        except requests.exceptions.RequestException as e:
            logger.error("Error fetching IFSC details: %s", e)
            return {
                "success": False,
                "verified": False,
                "message": "IFSC lookup service unavailable",
            }
        except Exception as e:
            logger.error("Unexpected error fetching IFSC details: %s", e)
            return {
                "success": False,
                "verified": False,
                "message": "An unexpected error occurred",
            }

    @staticmethod
    def verify_bank_account(account_number: str, ifsc_code: str, fetch_ifsc: bool = False) -> dict:
        """Verify Bank Account using Attestr API"""
        try:
            url = 'https://api.attestr.com/api/v2/public/finanx/acc'

            headers = {
                'Content-Type': 'application/json',
                'Authorization': settings.ATTESTR_API_KEY
            }

            payload = {
                'acc': account_number,
                'ifsc': ifsc_code.upper(),
            }

            response = requests.post(url, json=payload, headers=headers, timeout=30)
            if not response.ok:
                logger.error("Attestr bank verification failed: status=%s body=%s", response.status_code, response.text)
            response.raise_for_status()

            data = response.json()
            logger.info("Bank verification completed: valid=%s", data.get("valid"))

            # Bank verification logic based on updated API response format
            if data.get('valid') is True:
                return {
                    "success": True,
                    "verified": True,
                    "account_number": account_number,
                    "ifsc_code": ifsc_code.upper(),
                    "account_holder_name": data.get('name'),
                    "account_status": data.get('status'),  # ACTIVE / INACTIVE etc.
                    "message": "Bank account verified successfully",
                    "raw_response": data
                }
            else:
                return {
                    "success": False,
                    "verified": False,
                    "account_number": account_number,
                    "ifsc_code": ifsc_code.upper(),
                    "message": data.get('message', 'Bank account verification failed'),
                    "raw_response": data
                }

        except requests.exceptions.RequestException as e:
            logger.error("Error verifying bank account: %s", e)
            return {
                "success": False,
                "verified": False,
                "message": "Bank verification service unavailable",
            }
        except Exception as e:
            logger.error("Unexpected error verifying bank account: %s", e)
            return {
                "success": False,
                "verified": False,
                "message": "An unexpected error occurred",
            }
