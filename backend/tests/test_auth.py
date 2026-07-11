"""
tests/test_auth.py
Unit tests for /api/auth/signup and /api/auth/login endpoints.

Covers:
  - Signup happy-path (201)
  - Duplicate email conflict (409)
  - Missing required fields (422 from Pydantic)
  - Login with correct credentials (200 + access_token)
  - Login with wrong password (401)
  - Login with unknown email (401)
  - Rate-limit: 6th login request within 60 s → 429
"""

import pytest
from httpx import AsyncClient


# ── Signup ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_signup_happy_path(client: AsyncClient):
    payload = {
        "name": "Test User",
        "email": "signup_happy@example.com",
        "password": "Password123!",
    }
    resp = await client.post("/api/auth/signup", json=payload)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body.get("user") is not None
    assert "access_token" in body or "accessToken" in body


@pytest.mark.asyncio
async def test_signup_duplicate_email(client: AsyncClient):
    payload = {
        "name": "Dup User",
        "email": "dup@example.com",
        "password": "Password123!",
    }
    # First signup should succeed
    r1 = await client.post("/api/auth/signup", json=payload)
    assert r1.status_code == 201, r1.text

    # Second with same email → 409
    r2 = await client.post("/api/auth/signup", json=payload)
    assert r2.status_code == 409, r2.text


@pytest.mark.asyncio
async def test_signup_missing_fields(client: AsyncClient):
    # Missing password
    resp = await client.post("/api/auth/signup", json={"email": "bad@x.com"})
    assert resp.status_code == 422


# ── Login ──────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_login_correct_credentials(client: AsyncClient):
    import uuid
    # Use a unique email per run to avoid session-table refresh_token conflicts
    email = f"login_ok_{uuid.uuid4().hex[:8]}@example.com"
    password = "SecurePass99!"
    r = await client.post(
        "/api/auth/signup",
        json={"name": "Login OK", "email": email, "password": password},
    )
    assert r.status_code == 201, r.text

    # Now login
    resp = await client.post("/api/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "access_token" in body or "accessToken" in body
    assert body.get("user") is not None


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    email = "wrong_pw@example.com"
    r = await client.post(
        "/api/auth/signup",
        json={"name": "Wrong PW", "email": email, "password": "RealPass1!"},
    )
    assert r.status_code == 201, r.text

    resp = await client.post("/api/auth/login", json={"email": email, "password": "BadPass99!"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_unknown_email(client: AsyncClient):
    resp = await client.post(
        "/api/auth/login",
        json={"email": "nobody@nowhere.com", "password": "Whatever1!"},
    )
    assert resp.status_code == 401


# ── Rate limiting ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_login_rate_limit(client: AsyncClient):
    """
    The login limiter allows 5 requests per 60-second window per IP.
    Attempts 1-5: 401 (wrong password reaches the handler).
    Attempt 6:  429 (blocked before the handler).

    The rate-limit windows are cleared before every test by the
    `reset_rate_limiters` autouse fixture in conftest.py.
    """
    email = "ratelimit_test@example.com"
    # Pre-register so login attempts produce 401 (wrong password), not 401 for unknown email.
    # The signup limiter bucket was cleared, so this call is within the 3/60s window.
    signup_resp = await client.post(
        "/api/auth/signup",
        json={"name": "RL User", "email": email, "password": "RLPass1!"},
    )
    assert signup_resp.status_code == 201, f"Signup failed: {signup_resp.text}"

    responses = []
    for _ in range(6):
        r = await client.post("/api/auth/login", json={"email": email, "password": "WrongPass!"})
        responses.append(r.status_code)

    # First 5 login attempts: 401 (wrong password, handler runs)
    # 6th attempt: 429 (rate limit fires before handler)
    assert responses[:5] == [401] * 5, f"Expected 5×401, got: {responses}"
    assert responses[5] == 429, f"Expected 429 on 6th attempt, got: {responses[5]}"
