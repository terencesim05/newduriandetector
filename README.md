# DurianDetector

A threat detection aggregation and management platform that consolidates security alerts from multiple IDS (Intrusion Detection System) sources into a unified dashboard.

## Tech Stack

- **Frontend**: React 19 + Vite, Tailwind CSS, Lucide React icons, Axios, React Router v7
- **Backend**: Django 6 + Django REST Framework, SimpleJWT authentication
- **Database**: PostgreSQL (Supabase)
- **3D Visualization**: Three.js / React Three Fiber (landing page globe)

## Project Structure

```
newduriandetector/
├── frontend/                   # React + Vite frontend
│   └── src/
│       ├── components/         # Sidebar, Navbar, ProtectedRoute
│       ├── config/             # API configuration
│       ├── context/            # AuthContext (JWT state management)
│       ├── layouts/            # DashboardLayout wrapper
│       ├── pages/              # All page components
│       └── services/           # API service layer (authService)
└── services/
    └── auth-service/           # Django backend
        ├── users/              # User model, auth endpoints
        ├── teams/              # Team model, PIN system
        └── subscriptions/      # Plans and subscriptions
```

## Features

### Authentication

- JWT-based auth with access/refresh tokens
- Automatic token refresh (1 min before expiry)
- Token blacklisting on logout
- Protected routes redirect unauthenticated users to login
- Google OAuth button (UI placeholder)

### Tier System

| Feature | FREE ($0) | PREMIUM ($49/mo) | EXCLUSIVE ($199/mo) |
|---------|-----------|-------------------|---------------------|
| Alert monitoring | Yes | Yes | Yes |
| Dashboard | Yes | Yes | Yes |
| Alerts/Incidents | Yes | Yes | Yes |
| ML configurations | - | Yes | Yes |
| Incident management | - | Yes | Yes |
| PDF reports | - | Yes | Yes |
| Unlimited alerts | - | Yes | Yes |
| Email notifications | - | Yes | Yes |
| Team workspace | - | - | Yes (1 leader + 4 members) |
| 3D attack globe | - | - | Yes |
| AI-driven analysis | - | - | Yes |
| Custom alert rules | - | - | Yes |
| Dedicated support | - | - | Yes |

### Team Collaboration (Exclusive Only)

- **Team Leader**: First Exclusive user creates a team automatically on signup
- **Team PIN**: Auto-generated 6-character alphanumeric code (e.g. `A7X42K`)
- **Team Members**: Up to 4 members can join using the leader's PIN during signup
- **PIN Management**: Leader can copy PIN to clipboard or regenerate it anytime
- **Access Control**: Only leader can regenerate PIN and remove members
- **Sidebar**: Teams nav link hidden for Free/Premium users

### Registration Flow

- Select tier (Free / Premium / Exclusive)
- For Exclusive users:
  - **Team Leader**: No PIN needed, team auto-created with generated PIN
  - **Team Member**: Enter team PIN to join existing team (validated, max 4 members enforced)
- Password minimum 8 characters with confirmation
- Full name parsed into first/last name

### Dashboard

- Welcome greeting with user's first name
- 4 stat cards: Total Alerts, Critical Alerts, Open Incidents, Threat Score (with progress bar)
- Recent Alerts table (Time, Severity, Category, Source IP)
- Quick Actions: Create Incident, Run Scan, View Reports
- Currently uses mock data (real data integration planned)

### Alerts Page

- Filter by severity (Critical/High/Medium/Low) and category (SQL Injection, DDoS, Malware, Brute Force, XSS)
- Search bar
- Alert table with severity badges (color-coded) and action buttons
- Mock pagination

### Incidents Page

- Filter by status (Open, In Progress, Resolved, Closed)
- Expandable incident cards showing title, status, priority, assignee, description
- Create New Incident button

### Teams Page

- **Free/Premium users**: Upgrade prompt
- **Exclusive leader without team**: Create team form
- **Exclusive with team**: Team dashboard showing:
  - Team name and member count (X/4)
  - PIN display with copy and regenerate buttons
  - Members list with leader (crown badge) and members
  - Empty slots shown as placeholders

### Settings Page

- **Profile**: Edit first name, last name (email read-only)
- **Account**: Current tier badge with upgrade buttons
- **Security**: Change password button, 2FA toggle (placeholder)
- **Notifications**: Email notifications toggle, alert severity threshold slider

## API Endpoints

### Auth (`/api/auth/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register/` | Register new user (handles tier + team logic) |
| POST | `/login/` | Login with email/password, returns JWT tokens |
| POST | `/logout/` | Blacklist refresh token |
| GET | `/me/` | Get current user profile |
| PATCH | `/me/` | Update user profile |

### Teams (`/api/teams/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List user's teams |
| POST | `/` | Create new team |
| POST | `/{id}/regenerate_pin/` | Regenerate team PIN (leader only) |

### Subscriptions (`/api/subscriptions/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/plans/` | List subscription plans (public) |
| GET | `/my-subscription/` | Get user's active subscription |
| POST | `/upgrade/` | Upgrade subscription plan |

## Data Models

### User
- Extends Django AbstractUser
- Fields: `tier`, `team` (FK), `is_team_leader`, `subscription_status`, timestamps

### Team
- Fields: `id` (UUID), `name`, `pin` (unique, 6 chars), `created_by` (FK to User), `created_at`
- Reverse relation: `members` (users with team FK)

### SubscriptionPlan
- Fields: `id` (UUID), `name`, `price_monthly`, `price_yearly`, `features` (JSON)

### Subscription
- Fields: `id` (UUID), `user` (FK), `plan` (FK), `status`, `start_date`, `end_date`, `auto_renew`

## Getting Started

### Backend

```bash
cd services/auth-service
pip install -r requirements.txt
py manage.py migrate
py manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Environment Variables

**Backend** (`.env`):
- `DATABASE_URL` - PostgreSQL connection string
- `SECRET_KEY` - Django secret key

**Frontend** (`frontend/.env`):
- `VITE_AUTH_API_URL` - Auth service URL (default: `http://localhost:8000`)
- `VITE_LOG_API_URL` - Log service URL (default: `http://localhost:8001`)

## Design

- Dark theme (`#0a0e1a` background)
- Blue primary (`#3B82F6`), green success, yellow warning, red danger
- Severity colors: Critical (red), High (orange), Medium (yellow), Low (gray)
- Tier badge colors: Free (gray), Premium (blue), Exclusive (purple)
- Responsive: mobile sidebar collapse, adaptive grid layouts
- Glass-morphism cards with subtle borders and hover effects
