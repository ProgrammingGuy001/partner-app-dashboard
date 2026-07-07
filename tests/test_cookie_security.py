import os
import unittest

from starlette.requests import Request

os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-with-minimum-length-12345")
os.environ.setdefault("SERVICE_SECRET_KEY", "test-service-secret-key-with-minimum-length-12345")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "test")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "test")
os.environ.setdefault("AWS_REGION", "ap-south-1")
os.environ.setdefault("AWS_S3_BUCKET", "test-bucket")
os.environ.setdefault("RML_SMS_USERNAME", "test")
os.environ.setdefault("RML_SMS_PASSWORD", "test")
os.environ.setdefault("RML_SMS_SENDER_ID", "test")
os.environ.setdefault("RML_SMS_ENTITY_ID", "test")
os.environ.setdefault("RML_SMS_TEMPLATE_ID", "test")
os.environ.setdefault("ATTESTR_API_KEY", "test")
os.environ.setdefault("KYC_ENCRYPTION_KEY", "0" * 64)
os.environ.setdefault("ModulaCare_URL", "https://example.com")

from app.api.cookie_security import cookie_bearer
from app.config import settings


def make_request(path: str, cookies: dict[str, str], authorization: str | None = None) -> Request:
    headers = []
    if cookies:
        headers.append((b"cookie", "; ".join(f"{k}={v}" for k, v in cookies.items()).encode()))
    if authorization:
        headers.append((b"authorization", authorization.encode()))
    return Request({
        "type": "http",
        "method": "GET",
        "path": path,
        "scheme": "http",
        "server": ("testserver", 80),
        "client": ("testclient", 50000),
        "headers": headers,
        "query_string": b"",
    })


class CookieBearerTests(unittest.IsolatedAsyncioTestCase):
    async def test_admin_routes_prefer_admin_cookie(self):
        request = make_request("/admin/grn/", {
            settings.IP_AUTH_COOKIE_NAME: "ip-token",
            settings.ADMIN_AUTH_COOKIE_NAME: "admin-token",
        })

        self.assertEqual(await cookie_bearer(request), "admin-token")

    async def test_ip_routes_prefer_ip_cookie(self):
        request = make_request("/api/v1/dashboard/grn/assigned", {
            settings.IP_AUTH_COOKIE_NAME: "ip-token",
            settings.ADMIN_AUTH_COOKIE_NAME: "admin-token",
        })

        self.assertEqual(await cookie_bearer(request), "ip-token")

    async def test_authorization_header_wins(self):
        request = make_request(
            "/admin/grn/",
            {
                settings.IP_AUTH_COOKIE_NAME: "ip-token",
                settings.ADMIN_AUTH_COOKIE_NAME: "admin-token",
            },
            authorization="Bearer header-token",
        )

        self.assertEqual(await cookie_bearer(request), "Bearer header-token")


if __name__ == "__main__":
    unittest.main()
