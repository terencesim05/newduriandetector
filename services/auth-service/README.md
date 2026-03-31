# Auth Service

Django-based authentication service for the IDS system.

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Ensure `../../.env` contains `DATABASE_URL` pointing to your Supabase PostgreSQL instance.

3. Run migrations:
   ```bash
   python manage.py makemigrations
   python manage.py migrate
   ```

4. Create a superuser:
   ```bash
   python manage.py createsuperuser
   ```

5. Start the server:
   ```bash
   python manage.py runserver 8000
   ```

## API Endpoints

### Authentication (`/api/auth/`)

| Method | Endpoint              | Auth     | Description          |
|--------|-----------------------|----------|----------------------|
| POST   | `/api/auth/register/` | No       | Register a new user  |
| POST   | `/api/auth/login/`    | No       | Login, returns JWT   |
| POST   | `/api/auth/logout/`   | Required | Logout (blacklist refresh token) |
| GET    | `/api/auth/me/`       | Required | Get current user     |
| PATCH  | `/api/auth/me/`       | Required | Update current user  |

### Teams (`/api/teams/`)

| Method | Endpoint          | Auth     | Description       |
|--------|-------------------|----------|-------------------|
| GET    | `/api/teams/`     | Required | List user's teams |
| POST   | `/api/teams/`     | Required | Create a team     |
| GET    | `/api/teams/:id/` | Required | Get team details  |
| PUT    | `/api/teams/:id/` | Required | Update a team     |
| DELETE | `/api/teams/:id/` | Required | Delete a team     |

### Subscriptions (`/api/subscriptions/`)

| Method | Endpoint                            | Auth     | Description                |
|--------|-------------------------------------|----------|----------------------------|
| GET    | `/api/subscriptions/plans/`         | No       | List all subscription plans|
| GET    | `/api/subscriptions/my-subscription/` | Required | Get current subscription |
| POST   | `/api/subscriptions/upgrade/`       | Required | Upgrade subscription       |

## Docker

```bash
docker build -t auth-service .
docker run -p 8000:8000 auth-service
```
