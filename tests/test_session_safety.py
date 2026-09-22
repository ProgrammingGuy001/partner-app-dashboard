"""Session and retry regressions; no live database or external API calls."""
import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, patch

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from threading import Barrier
from fastapi.testclient import TestClient
from starlette.requests import Request
from starlette.responses import Response

from app.config import settings
from app.core.security import (
    consume_refresh_token, create_refresh_token, store_refresh_token,
)
from app.main import app, protect_cookie_authenticated_mutations
from app.model.refresh_token import RefreshToken
from app.services.odoo_service import OdooService


def test_refresh_tokens_are_unique_even_in_the_same_second():
    with patch("app.core.security.datetime") as clock:
        clock.now.return_value = datetime(2026, 9, 18, tzinfo=timezone.utc)
        first = create_refresh_token({"sub": "42"})
        second = create_refresh_token({"sub": "42"})
    assert first != second


def test_refresh_token_is_single_use_and_expired_tokens_are_rejected():
    engine = create_engine("sqlite://")
    RefreshToken.__table__.create(engine)
    with Session(engine) as db:
        token = create_refresh_token({"sub": "42"})
        store_refresh_token(db, "42", token)
        assert consume_refresh_token(db, token)
        assert not consume_refresh_token(db, token)
        store_refresh_token(db, "42", token)
        db.query(RefreshToken).update({
            RefreshToken.expires_at: datetime.now(timezone.utc) - timedelta(days=1),
        })
        db.commit()
        assert not consume_refresh_token(db, token)
    engine.dispose()


def test_two_workers_cannot_consume_the_same_refresh_token(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'tokens.db'}")
    RefreshToken.__table__.create(engine)
    token = create_refresh_token({"sub": "42"})
    with Session(engine) as db:
        store_refresh_token(db, "42", token)
    ready = Barrier(2)

    def consume():
        with Session(engine) as db:
            ready.wait()
            return consume_refresh_token(db, token)

    with ThreadPoolExecutor(max_workers=2) as workers:
        assert sorted(workers.map(lambda _: consume(), range(2))) == [False, True]
    engine.dispose()


def test_sensitive_routes_reject_anonymous_requests_without_running_startup():
    # No context manager: do not run migrations, schedulers or notifications.
    client = TestClient(app)
    for path in ["/auth/me", "/api/v1/auth/me", "/jobs", "/admin/ips"]:
        assert client.get(path).status_code == 401, path
    for path in ["/jobs/1/documents/project-ncr", "/api/v1/dashboard/attendance", "/admin/purchase-orders/1/approve"]:
        assert client.post(path, json={}).status_code == 401, path


@pytest.mark.parametrize("cookie", [settings.ADMIN_AUTH_COOKIE_NAME, settings.IP_REFRESH_COOKIE_NAME])
@pytest.mark.parametrize("authorization", ["", "Bearer untrusted-header"])
def test_header_cannot_bypass_cookie_origin_check(cookie, authorization):
    request = Request({
        "type": "http", "method": "POST", "path": "/auth/refresh-token",
        "headers": [(b"cookie", f"{cookie}=token".encode()),
                    (b"origin", b"https://untrusted.invalid"),
                    (b"authorization", authorization.encode())],
    })

    async def next_handler(_request):
        return Response(status_code=200)

    response = asyncio.run(protect_cookie_authenticated_mutations(request, next_handler))
    assert response.status_code == 403


def test_header_only_mobile_requests_do_not_require_browser_origin():
    request = Request({
        "type": "http", "method": "POST", "path": "/api/v1/dashboard/jobs/1/start",
        "headers": [(b"authorization", b"Bearer mobile-token")],
    })

    async def next_handler(_request):
        return Response(status_code=200)

    assert asyncio.run(protect_cookie_authenticated_mutations(request, next_handler)).status_code == 200


@pytest.mark.parametrize("method", ["create", "write", "action_create_invoice", "button_confirm"])
def test_odoo_writes_are_never_replayed_after_a_lost_response(method):
    models = Mock()
    models.execute_kw.side_effect = [OSError("response lost"), True]
    with patch.object(OdooService, "_initialize_connection"), patch.object(OdooService, "_local") as local:
        local.models = models
        local.uid = 1
        with pytest.raises(HTTPException) as error:
            OdooService._execute_kw("purchase.order", method, [[1]])
        assert error.value.status_code == 502
        assert models.execute_kw.call_count == 1


def test_odoo_reads_can_reconnect_once():
    models = Mock()
    models.execute_kw.side_effect = [OSError("connection dropped"), [{"id": 1}]]
    with patch.object(OdooService, "_initialize_connection"), patch.object(OdooService, "_local") as local:
        local.models = models
        local.uid = 1
        assert OdooService._execute_kw("purchase.order", "search_read", [[]]) == [{"id": 1}]
        assert models.execute_kw.call_count == 2
