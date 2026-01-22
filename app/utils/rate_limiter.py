

from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request
from fastapi.responses import JSONResponse


def get_real_ip(request: Request) -> str:
    """Extract real client IP, considering proxy headers"""
    # Check X-Forwarded-For header first (for requests through proxy/load balancer)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # Get the first IP from the comma-separated list
        return forwarded.split(",")[0].strip()
    
    # Fall back to direct client IP
    return get_remote_address(request)


# Create limiter instance using client IP for rate limiting
limiter = Limiter(key_func=get_real_ip)


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    """Custom handler for rate limit exceeded errors"""
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Too many requests. Please wait before trying again.",
            "retry_after": str(exc.detail)
        }
    )
