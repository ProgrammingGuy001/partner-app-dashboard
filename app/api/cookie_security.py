from typing import Optional

from fastapi import Request
from fastapi.security import HTTPBearer
from app.config import settings


class CookieBearer(HTTPBearer):
    async def __call__(
        self, request: Request
    ) -> Optional[str]:
        auth_header = request.headers.get("Authorization")
        if auth_header:
            return auth_header

        cookie_names = (
            (settings.ADMIN_AUTH_COOKIE_NAME, settings.IP_AUTH_COOKIE_NAME, "access_token")
            if request.url.path.startswith("/admin/")
            else (settings.IP_AUTH_COOKIE_NAME, settings.ADMIN_AUTH_COOKIE_NAME, "access_token")
        )
        for name in cookie_names:
            token = request.cookies.get(name)
            if token:
                return token
        return None

cookie_bearer = CookieBearer()
