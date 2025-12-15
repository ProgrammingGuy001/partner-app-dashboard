import requests
from app.config import settings


class BankService:
    
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
                'fetchIfsc': fetch_ifsc
            }
            
            response = requests.post(url, json=payload, headers=headers, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            
            print("data for bank details is:", data)

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
            print("❌ Error verifying bank account:", str(e))
            return {
                "success": False,
                "verified": False,
                "message": f"API Error: {str(e)}"
            }
        except Exception as e:
            print("❌ Unexpected error:", str(e))
            return {
                "success": False,
                "verified": False,
                "message": f"Error: {str(e)}"
            }