import secrets
import string

from app.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
    generate_service_token,
)


def generate_otp(length: int = 6) -> str:
    """Generate a cryptographically secure numeric OTP of specified length"""
    return ''.join(secrets.choice(string.digits) for _ in range(length))

def verify_token(token: str) -> dict:
    """Verify JWT token and return payload (only for access tokens)"""
    return decode_access_token(token)


def verify_refresh_token(token: str) -> dict:
    """Verify JWT refresh token and return payload"""
    return decode_refresh_token(token)


def capitalize_first_name(full_name: str) -> str:
    """Extract and capitalize first name from full name"""
    if not full_name:
        return "User"

    names = full_name.strip().split()
    return names[0].capitalize() if names else "User"


def get_internal_headers(request):
    user_token = request.cookies.get(settings.ADMIN_AUTH_COOKIE_NAME)

    if user_token and user_token.startswith("Bearer "):
        user_token = user_token.replace("Bearer ", "")

    service_token = generate_service_token()

    return {
        "Authorization": f"Bearer {user_token}",      
        "X-Service-Auth": f"Bearer {service_token}",   
    }
