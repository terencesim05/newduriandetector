"""Pytest bootstrap for the auth service.

Configures pytest-django so tests can use the @pytest.mark.django_db
decorator and adds the `system` marker for HTTP-level tests.
"""

import os

import django


def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "system: tests that hit a running auth service over HTTP",
    )

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "auth_service.test_settings")
    django.setup()
