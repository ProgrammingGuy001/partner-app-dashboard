from typing import Optional

from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer
from app.config import settings


class CookieBearer(HTTPBearer):
    async def __call__(
        self, request: Request
    ) -> Optional[str]:
        token = request.cookies.get(settings.IP_AUTH_COOKIE_NAME)
        if not token:
            # Legacy fallback for existing sessions before cookie split.
            token = request.cookies.get("access_token")
        if token:
            return token
        auth_header = request.headers.get("Authorization")
        if auth_header:
            return auth_header
        return None

cookie_bearer = CookieBearer()
