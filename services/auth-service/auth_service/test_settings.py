"""Test-only settings: import everything from real settings, then force
sqlite + console email so unit/integration tests don't need Postgres or SMTP.

The Windows machine running these tests has Application Control blocking
psycopg2's DLL, so we must avoid the postgres backend entirely.
"""

from .settings import *  # noqa: F401, F403

INSTALLED_APPS = [a for a in INSTALLED_APPS if a != 'anymail']

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
