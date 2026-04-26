"""Shared pytest fixtures for the log-service tests.

The unit tests exercise pure-Python helpers and don't need a running service.
The system tests hit the deployed log + auth services and require:

    AUTH_BASE_URL  — base URL of the auth service (default http://localhost:8000)
    LOG_BASE_URL   — base URL of the log  service (default http://localhost:8001)

Optionally:
    AUTH_PREMIUM_USERNAME / AUTH_PREMIUM_PASSWORD — a pre-existing PREMIUM
        account used for tests that need premium features (rules, ML config,
        incidents, chatbot). If unset, those tests are skipped.

A FREE user is registered fresh for every test run and torn down at the end.
"""

import os
import sys
import uuid
from pathlib import Path

import httpx
import pytest

# Make the log-service `app` package importable for unit tests.
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


AUTH_BASE_URL = os.environ.get("AUTH_BASE_URL", "http://localhost:8000").rstrip("/")
LOG_BASE_URL = os.environ.get("LOG_BASE_URL", "http://localhost:8001").rstrip("/")


def pytest_configure(config):
    config.addinivalue_line("markers", "system: tests that hit running services")
    config.addinivalue_line("markers", "premium: tests that need a PREMIUM account")


# ── Helpers ────────────────────────────────────────────────────────────────

def _unique_email(prefix: str = "logtest") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}@duriantest.local"


def _unique_username(prefix: str = "logtest") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def _alive(url: str) -> bool:
    try:
        httpx.get(url, timeout=3)
        return True
    except Exception:
        return False


def _register(base_auth: str, tier: str = "FREE") -> dict:
    payload = {
        "email": _unique_email(),
        "username": _unique_username(),
        "password": "StrongP@ssw0rd!",
        "first_name": "Pytest",
        "last_name": "User",
        "tier": tier,
    }
    r = httpx.post(f"{base_auth}/api/auth/register/", json=payload, timeout=10)
    r.raise_for_status()
    body = r.json()
    return {
        "username": payload["username"],
        "email": payload["email"],
        "password": payload["password"],
        "user_id": body["user"]["id"],
        "tier": body["user"]["tier"],
        "access": body["tokens"]["access"],
        "refresh": body["tokens"]["refresh"],
    }


def _login(base_auth: str, username: str, password: str) -> dict:
    r = httpx.post(
        f"{base_auth}/api/auth/login/",
        json={"username": username, "password": password},
        timeout=10,
    )
    r.raise_for_status()
    body = r.json()
    return {
        "user_id": body["user"]["id"],
        "tier": body["user"]["tier"],
        "access": body["tokens"]["access"],
        "refresh": body["tokens"]["refresh"],
    }


def _logout(base_auth: str, access: str, refresh: str) -> None:
    try:
        httpx.post(
            f"{base_auth}/api/auth/logout/",
            json={"refresh": refresh},
            headers={"Authorization": f"Bearer {access}"},
            timeout=5,
        )
    except Exception:
        pass


# ── URL fixtures ───────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def auth_base_url() -> str:
    if not _alive(AUTH_BASE_URL):
        pytest.skip(f"Auth service not reachable at {AUTH_BASE_URL}")
    return AUTH_BASE_URL


@pytest.fixture(scope="session")
def log_base_url() -> str:
    if not _alive(LOG_BASE_URL):
        pytest.skip(f"Log service not reachable at {LOG_BASE_URL}")
    return LOG_BASE_URL


# ── User / token fixtures ──────────────────────────────────────────────────

@pytest.fixture
def free_user(auth_base_url):
    """Register a fresh FREE user, yield credentials, then sign out."""
    user = _register(auth_base_url, tier="FREE")
    yield user
    _logout(auth_base_url, user["access"], user["refresh"])


@pytest.fixture
def free_headers(free_user) -> dict:
    return {"Authorization": f"Bearer {free_user['access']}"}


@pytest.fixture
def premium_user(auth_base_url):
    """Log in as the PREMIUM account configured via env vars; skip if missing."""
    username = os.environ.get("AUTH_PREMIUM_USERNAME")
    password = os.environ.get("AUTH_PREMIUM_PASSWORD")
    if not (username and password):
        pytest.skip("AUTH_PREMIUM_USERNAME / AUTH_PREMIUM_PASSWORD not set")
    user = _login(auth_base_url, username, password)
    yield user
    _logout(auth_base_url, user["access"], user["refresh"])


@pytest.fixture
def premium_headers(premium_user) -> dict:
    return {"Authorization": f"Bearer {premium_user['access']}"}


# ── HTTP client fixtures ───────────────────────────────────────────────────

@pytest.fixture
def log_client(log_base_url):
    """Plain httpx client pointed at the log service. Caller adds auth."""
    with httpx.Client(base_url=log_base_url, timeout=15) as client:
        yield client
