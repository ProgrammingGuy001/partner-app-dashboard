from typing import Optional

from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer


class CookieBearer(HTTPBearer):
    async def __call__(
        self, request: Request
    ) -> Optional[str]:
        token = request.cookies.get("access_token")
        if token:
            return token
        return None

cookie_bearer = CookieBearer()
