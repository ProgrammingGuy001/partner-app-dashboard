

from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from fastapi import Request
from fastapi.responses import JSONResponse


def get_real_ip(request: Request) -> str:
    """Use the client address normalized by ProxyHeadersMiddleware."""
    return request.client.host if request.client else "unknown"


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
