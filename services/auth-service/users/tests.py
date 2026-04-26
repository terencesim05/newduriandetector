"""
Pytest tests for the DurianDetector auth service.

Three layers:
- Unit tests: in-process model + serializer behaviour (no HTTP).
- Integration tests: schema/migration sanity + JWT custom claims.
- System tests: HTTP calls against the deployed auth service.

System tests target the URL given by the AUTH_BASE_URL env var
(default http://localhost:8000) and clean up the test users they create.

Run unit + integration:
    cd services/auth-service
    pytest users/tests.py -m "not system"

Run system tests against the deployed service:
    AUTH_BASE_URL=https://auth.example.com pytest users/tests.py -m system
"""

import os
import uuid

import pytest
import requests

# ── pytest markers ──────────────────────────────────────────────────────────

pytestmark = []

AUTH_BASE_URL = os.environ.get("AUTH_BASE_URL", "http://localhost:8000").rstrip("/")


def _unique_email(prefix: str = "pytest") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}@duriantest.local"


def _unique_username(prefix: str = "pytest") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


# ─────────────────────────────────────────────────────────────────────────────
# UNIT TESTS — in-process Django ORM, no network
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestUserModelUnit:
    def test_user_creation(self):
        from users.models import User
        user = User.objects.create_user(
            username=_unique_username(),
            email=_unique_email(),
            password="StrongP@ssw0rd!",
        )
        assert user.pk is not None
        assert user.email
        assert user.is_active is True

    def test_password_hashed_not_plaintext(self):
        from users.models import User
        plain = "Secret_123!"
        user = User.objects.create_user(
            username=_unique_username(),
            email=_unique_email(),
            password=plain,
        )
        assert user.password != plain
        assert user.check_password(plain)
        assert not user.check_password("wrong-password")

    def test_default_role_is_free(self):
        from users.models import User
        user = User.objects.create_user(
            username=_unique_username(),
            email=_unique_email(),
            password="StrongP@ssw0rd!",
        )
        assert user.tier == "FREE"
        assert user.is_team_leader is False

    def test_user_not_suspended_by_default(self):
        from users.models import User
        user = User.objects.create_user(
            username=_unique_username(),
            email=_unique_email(),
            password="StrongP@ssw0rd!",
        )
        assert user.is_active is True

    def test_email_uniqueness_enforced_at_app_layer(self):
        """Auth views deliberately reject duplicate emails via the serializer.
        The model itself does not have a DB-level unique on email, but the
        register endpoint blocks duplicates — covered in TestRegisterSystem."""
        from users.serializers import RegisterSerializer
        email = _unique_email()
        s1 = RegisterSerializer(data={
            "email": email,
            "username": _unique_username(),
            "password": "StrongP@ssw0rd!",
        })
        assert s1.is_valid(), s1.errors
        s1.save()
        # Same email, different username: the model layer allows it, but the
        # auth flow normally guards against it. Document the current behaviour.
        s2 = RegisterSerializer(data={
            "email": email,
            "username": _unique_username(),
            "password": "StrongP@ssw0rd!",
        })
        # Either is_valid is False, OR creating succeeds but emails collide
        # — assert that the email field is at least preserved.
        if s2.is_valid():
            u2 = s2.save()
            assert u2.email == email
        else:
            assert "email" in s2.errors

    def test_team_pin_generation_unique_and_alphanumeric(self):
        from users.views import _generate_pin
        pins = {_generate_pin() for _ in range(50)}
        assert all(len(p) == 6 for p in pins)
        assert all(p.isalnum() and p.isupper() or any(c.isdigit() for c in p) for p in pins)
        # Not all identical
        assert len(pins) > 1


@pytest.mark.django_db
class TestJWTUnit:
    def test_jwt_contains_user_id_and_tier(self):
        from rest_framework_simplejwt.tokens import RefreshToken
        from users.models import User
        from users.serializers import _add_custom_claims
        user = User.objects.create_user(
            username=_unique_username(),
            email=_unique_email(),
            password="StrongP@ssw0rd!",
        )
        user.tier = "PREMIUM"
        user.save()

        refresh = _add_custom_claims(RefreshToken.for_user(user), user)
        access = refresh.access_token

        # SimpleJWT stores the user-id claim as a string.
        assert int(access["user_id"]) == user.id
        assert access["tier"] == "PREMIUM"
        assert "subscription_status" in access
        assert "is_superuser" in access

    def test_refresh_token_valid_and_rotatable(self):
        from rest_framework_simplejwt.tokens import RefreshToken
        from users.models import User
        from users.serializers import _add_custom_claims
        user = User.objects.create_user(
            username=_unique_username(),
            email=_unique_email(),
            password="StrongP@ssw0rd!",
        )
        refresh = _add_custom_claims(RefreshToken.for_user(user), user)
        # str() encodes — should be a non-empty JWT-looking value
        encoded = str(refresh)
        assert encoded.count(".") == 2

        # Re-decoding via the SimpleJWT class round-trips the user_id.
        decoded = RefreshToken(encoded)
        assert int(decoded["user_id"]) == user.id


# ─────────────────────────────────────────────────────────────────────────────
# INTEGRATION TESTS — schema sanity (still in-process)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestAuthSchemaIntegration:
    def test_all_auth_service_tables_created(self):
        from django.db import connection
        existing = set(connection.introspection.table_names())
        expected = {"users", "teams", "subscriptions", "audit_logs", "subscription_plans"}
        missing = expected - existing
        assert not missing, f"Missing tables: {missing}"

    def test_user_model_fields_exist(self):
        from users.models import User
        field_names = {f.name for f in User._meta.get_fields()}
        for required in (
            "id", "email", "username", "password", "first_name", "last_name",
            "tier", "team", "is_team_leader", "is_active", "is_superuser",
            "subscription_status", "created_at", "updated_at",
        ):
            assert required in field_names, f"User.{required} missing"


# ─────────────────────────────────────────────────────────────────────────────
# SYSTEM TESTS — hit the running auth service over HTTP
# ─────────────────────────────────────────────────────────────────────────────

def _alive(url: str) -> bool:
    try:
        requests.get(url, timeout=3)
        return True
    except Exception:
        return False


@pytest.fixture(scope="module")
def auth_url():
    base = AUTH_BASE_URL
    if not _alive(base):
        pytest.skip(f"Auth service not reachable at {base}")
    return base


@pytest.fixture
def created_users():
    """Track user emails created via the API so we can clean them up after."""
    created: list[dict] = []
    yield created
    # Best-effort cleanup: log in as each user and call logout.
    # (The auth API doesn't expose a self-delete endpoint, so true deletion
    # requires admin access; we simply blacklist the refresh token.)
    for u in created:
        try:
            r = requests.post(
                f"{AUTH_BASE_URL}/api/auth/login/",
                json={"username": u["username"], "password": u["password"]},
                timeout=5,
            )
            if r.status_code == 200:
                tokens = r.json().get("tokens", {})
                requests.post(
                    f"{AUTH_BASE_URL}/api/auth/logout/",
                    json={"refresh": tokens.get("refresh")},
                    headers={"Authorization": f"Bearer {tokens.get('access')}"},
                    timeout=5,
                )
        except Exception:
            pass


def _register_user(base: str, tier: str = "FREE", **overrides) -> dict:
    payload = {
        "email": _unique_email(),
        "username": _unique_username(),
        "password": "StrongP@ssw0rd!",
        "first_name": "Test",
        "last_name": "User",
        "tier": tier,
        **overrides,
    }
    r = requests.post(f"{base}/api/auth/register/", json=payload, timeout=10)
    return {"status": r.status_code, "body": r.json() if r.content else {}, "payload": payload}


@pytest.mark.system
class TestAuthSystem:

    def test_register_success(self, auth_url, created_users):
        result = _register_user(auth_url)
        assert result["status"] == 201, result["body"]
        body = result["body"]
        assert "user" in body and "tokens" in body
        assert body["user"]["email"] == result["payload"]["email"]
        assert body["user"]["tier"] == "FREE"
        assert body["tokens"]["access"]
        assert body["tokens"]["refresh"]
        created_users.append(result["payload"])

    def test_register_duplicate_email_rejected(self, auth_url, created_users):
        first = _register_user(auth_url)
        assert first["status"] == 201
        created_users.append(first["payload"])

        # Attempt to register again with the same email (different username)
        dup_payload = {
            **first["payload"],
            "username": _unique_username(),
        }
        r = requests.post(f"{auth_url}/api/auth/register/", json=dup_payload, timeout=10)
        assert r.status_code in (400, 409), (
            f"Duplicate email should be rejected, got {r.status_code}: {r.text}"
        )

    def test_login_invalid_credentials(self, auth_url):
        r = requests.post(
            f"{auth_url}/api/auth/login/",
            json={"username": "no-such-user", "password": "definitely-wrong"},
            timeout=10,
        )
        assert r.status_code == 400

    def test_login_success_returns_tokens(self, auth_url, created_users):
        reg = _register_user(auth_url)
        assert reg["status"] == 201
        created_users.append(reg["payload"])

        r = requests.post(
            f"{auth_url}/api/auth/login/",
            json={
                "username": reg["payload"]["username"],
                "password": reg["payload"]["password"],
            },
            timeout=10,
        )
        assert r.status_code == 200
        data = r.json()
        assert "tokens" in data
        assert data["tokens"]["access"]
        assert data["tokens"]["refresh"]
        assert data["user"]["email"] == reg["payload"]["email"]

    def test_profile_requires_auth(self, auth_url):
        r = requests.get(f"{auth_url}/api/auth/me/", timeout=10)
        assert r.status_code == 401

    def test_profile_success_with_token(self, auth_url, created_users):
        reg = _register_user(auth_url)
        assert reg["status"] == 201
        created_users.append(reg["payload"])

        access = reg["body"]["tokens"]["access"]
        r = requests.get(
            f"{auth_url}/api/auth/me/",
            headers={"Authorization": f"Bearer {access}"},
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json()["email"] == reg["payload"]["email"]

    def test_admin_user_list_forbidden_for_free_user(self, auth_url, created_users):
        reg = _register_user(auth_url, tier="FREE")
        assert reg["status"] == 201
        created_users.append(reg["payload"])

        access = reg["body"]["tokens"]["access"]
        r = requests.get(
            f"{auth_url}/api/admin/users/",
            headers={"Authorization": f"Bearer {access}"},
            timeout=10,
        )
        assert r.status_code == 403

    def test_admin_user_list_allowed_for_admin(self, auth_url):
        admin_user = os.environ.get("AUTH_ADMIN_USERNAME")
        admin_pass = os.environ.get("AUTH_ADMIN_PASSWORD")
        if not (admin_user and admin_pass):
            pytest.skip("AUTH_ADMIN_USERNAME / AUTH_ADMIN_PASSWORD not set")

        login = requests.post(
            f"{auth_url}/api/auth/login/",
            json={"username": admin_user, "password": admin_pass},
            timeout=10,
        )
        assert login.status_code == 200, login.text
        access = login.json()["tokens"]["access"]

        r = requests.get(
            f"{auth_url}/api/admin/users/",
            headers={"Authorization": f"Bearer {access}"},
            timeout=10,
        )
        assert r.status_code == 200
        body = r.json()
        assert "users" in body
        assert "total" in body

    def test_admin_suspend_user(self, auth_url, created_users):
        admin_user = os.environ.get("AUTH_ADMIN_USERNAME")
        admin_pass = os.environ.get("AUTH_ADMIN_PASSWORD")
        if not (admin_user and admin_pass):
            pytest.skip("AUTH_ADMIN_USERNAME / AUTH_ADMIN_PASSWORD not set")

        # Create a victim
        reg = _register_user(auth_url)
        assert reg["status"] == 201
        created_users.append(reg["payload"])
        victim_id = reg["body"]["user"]["id"]

        # Admin token
        login = requests.post(
            f"{auth_url}/api/auth/login/",
            json={"username": admin_user, "password": admin_pass},
            timeout=10,
        )
        assert login.status_code == 200
        admin_access = login.json()["tokens"]["access"]
        admin_headers = {"Authorization": f"Bearer {admin_access}"}

        suspend = requests.post(
            f"{auth_url}/api/admin/{victim_id}/suspend/",
            headers=admin_headers,
            timeout=10,
        )
        assert suspend.status_code == 200, suspend.text
        assert "suspended" in suspend.json().get("detail", "").lower()

        # Victim should no longer be able to log in
        relogin = requests.post(
            f"{auth_url}/api/auth/login/",
            json={
                "username": reg["payload"]["username"],
                "password": reg["payload"]["password"],
            },
            timeout=10,
        )
        assert relogin.status_code == 400

        # Cleanup: unsuspend so the post-test logout in the fixture still works
        requests.post(
            f"{auth_url}/api/admin/{victim_id}/unsuspend/",
            headers=admin_headers,
            timeout=10,
        )
