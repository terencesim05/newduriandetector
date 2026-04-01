# DurianDetector

A threat detection aggregation and management platform that consolidates security alerts from multiple IDS (Intrusion Detection System) sources into a unified dashboard.

## Tech Stack

- **Frontend**: React 19 + Vite, Tailwind CSS, Lucide React icons, Axios, React Router v7
- **Auth Service**: Django 6 + Django REST Framework, SimpleJWT authentication
- **Log Service**: FastAPI, SQLAlchemy (async + asyncpg), Pydantic
- **Database**: PostgreSQL (Supabase)
- **Threat Intelligence**: ThreatFox API (abuse.ch)
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
│       └── services/           # API service layer (authService, alertService)
└── services/
    ├── auth-service/           # Django backend (port 8000)
    │   ├── users/              # User model, auth endpoints
    │   ├── teams/              # Team model, PIN system
    │   └── subscriptions/      # Plans and subscriptions
    └── log-service/            # FastAPI backend (port 8001)
        └── app/
            ├── models/         # Alert model (SQLAlchemy)
            ├── schemas/        # Pydantic validation schemas
            ├── routes/         # Ingest + query endpoints
            ├── services/       # Normalizer, threat scoring
            └── utils/          # ThreatFox integration
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
- **Shared workspace**: All team members see the same alerts, blacklist, whitelist, and quarantine queue. One member blocks an IP → all members see it immediately

### Data Scoping (Multi-Tenant)

How data is isolated depends on the user's tier:

| Tier | Scoped By | Meaning |
|------|-----------|---------|
| FREE / PREMIUM | `user_id` | Each user sees only their own data |
| EXCLUSIVE | `team_id` | All team members share the same data |

This applies to: alerts, blacklist, whitelist, quarantine, and threat intel flagging. The JWT token carries `tier` and `team_id` so the log service knows how to scope every query.

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
- **My Assignments** widget (EXCLUSIVE only) — shows alerts assigned to the current user

### Alerts Page

- **Live data** from the FastAPI log service (no more mock data)
- Filter by severity (Critical/High/Medium/Low) and category (11 categories)
- **Assignment filter** (EXCLUSIVE only): All / Assigned to Me / Unassigned
- **Assign to** dropdown per alert row (EXCLUSIVE only) — select a team member to assign
- Assigned member badge shown on each alert
- Search by IP address or category
- Alert table with severity badges, threat score, and ThreatFox intel column
- **ThreatFox badge**: red "FLAGGED" badge on alerts where the source IP is a known threat
- **Threat detail modal**: click any flagged alert to see malware family, threat type, confidence level, tags, first/last seen dates, and reference URL
- Server-side pagination with working page controls
- Loading spinner and error handling

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
  - **Team stats**: total alerts, unassigned count, alerts per member breakdown
  - **Activity feed**: shows who did what — alert assignments, IP blocks, quarantine reviews

### Settings Page

- **Profile**: Edit first name, last name (email read-only)
- **Account**: Current tier badge with upgrade buttons
- **Security**: Change password button, 2FA toggle (placeholder)
- **Notifications**: Email notifications toggle, alert severity threshold slider

### Log Ingestion Service

- **Multi-IDS support**: accepts alerts from Suricata (EVE JSON), Zeek (notice logs), Snort, and Kismet
- **Alert normalisation**: converts each IDS format into a unified schema
- **Threat scoring**: automatic 0.0–1.0 score per alert using weighted formula (60% severity + 40% category)
- **ThreatFox integration**: every ingested alert's source IP is checked against the ThreatFox threat intelligence database
  - Known malicious IPs get flagged, score boosted to 0.9+, and enriched with malware family/threat type/confidence data
  - Results cached 24 hours in memory to avoid redundant API calls
  - Private/RFC1918 IPs are skipped
- **Multi-tenant**: alerts are tagged with the authenticated user's ID; users only see their own data
- **Async**: built on FastAPI + asyncpg for non-blocking database writes

### Threat Scoring

| Severity | Weight | | Category | Weight |
|----------|--------|-|----------|--------|
| LOW | 0.10 | | SQL_INJECTION | 0.85 |
| MEDIUM | 0.30 | | COMMAND_INJECTION | 0.85 |
| HIGH | 0.60 | | PRIVILEGE_ESCALATION | 0.80 |
| CRITICAL | 0.90 | | MALWARE | 0.75 |

Formula: `score = (0.6 × severity) + (0.4 × category)`
If ThreatFox flags the source IP, score is boosted to 0.9–1.0 based on confidence level.

### Quarantine System

Alerts are automatically triaged based on threat score:

| Score | Action | What Happens |
|-------|--------|--------------|
| >= 0.9 | **Auto-block** | `is_blocked=True`, IP added to blacklist immediately |
| 0.7 – 0.9 | **Quarantine** | Held for human review before any action |
| < 0.7 | **Allow** | Logged normally, no intervention needed |

Quarantined alerts sit in a review queue. An admin can:
- **Release** — mark as safe (false positive), alert stays logged
- **Block** — confirm the threat, sets score to 1.0, IP auto-added to blacklist

This prevents false positives from auto-blocking legitimate traffic while still catching real threats.

### Custom Detection Rules

Users create "if-then" rules to detect threats based on their network's patterns. Three rule types:

| Type | What it does | Example |
|------|-------------|---------|
| **Rate Limit** | Triggers when same IP exceeds alert count in a time window | >5 SQL_INJECTION from same IP in 5 min |
| **Category Match** | Triggers on specific category + severity combo | Any CRITICAL MALWARE alert |
| **Failed Login** | Triggers on brute force attempts from same IP | >10 BRUTE_FORCE in 10 min |

Each rule defines **actions** to take when triggered:
- Quarantine the alert
- Auto-block the IP (add to blacklist)
- Increase threat score by a configurable amount
- Notify admin (placeholder)

Rules run in **priority order** (highest first), and the first matching rule wins. Each rule tracks how many times it has triggered. Rules can be tested against recent alerts before enabling.

### Blacklist & Whitelist

Users can maintain their own blacklist and whitelist to control how alerts are processed. During ingestion, every alert's source IP is checked in this order:

1. **Whitelist** (highest priority) — if matched, `threat_score = 0`, all other checks skipped
2. **Blacklist** — if matched, `threat_score = 1.0`, alert marked as blocked
3. **ThreatFox** — if matched, IP auto-added to blacklist, alert marked as blocked
4. **Normal** — standard scoring applies

Each list supports three entry types:
- **IP** — exact match (e.g. `1.2.3.4`)
- **CIDR** — range match (e.g. `192.168.0.0/16`)
- **DOMAIN** — domain match

Entries track how many times they've been matched (`block_count` / `trust_count`). Lists are multi-tenant — each user manages their own.

### Threat Intelligence Feed

The Threat Intel page shows a live feed of the latest IOCs (Indicators of Compromise) published on ThreatFox. Users can:
- Browse recent IOCs (configurable: last 1–30 days)
- Search for specific IPs, domains, or hashes
- View malware family, threat type, confidence level, tags, and reporter info

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

### Log Service (port 8001)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/logs/ingest` | Ingest alerts (supports all IDS formats) |
| GET | `/api/alerts` | List alerts (filterable, paginated) |
| GET | `/api/threat-intel/recent` | Live ThreatFox IOC feed |
| GET | `/api/threat-intel/search` | Search ThreatFox by IP/hash/domain |
| GET/POST/DELETE | `/api/blacklist` | Manage blacklist entries |
| POST | `/api/blacklist/bulk` | Bulk import blacklist from CSV |
| GET/POST/DELETE | `/api/whitelist` | Manage whitelist entries |
| POST | `/api/whitelist/bulk` | Bulk import whitelist from CSV |
| GET | `/api/quarantine` | List quarantined alerts (filterable by status) |
| GET | `/api/quarantine/stats` | Pending/released/blocked counts |
| POST | `/api/quarantine/{id}/release` | Release alert from quarantine |
| POST | `/api/quarantine/{id}/block` | Confirm threat, block and blacklist IP |
| DELETE | `/api/quarantine/{id}` | Remove from quarantine |
| GET/POST | `/api/rules` | List/create detection rules |
| PUT | `/api/rules/{id}` | Update a rule |
| DELETE | `/api/rules/{id}` | Delete a rule |
| POST | `/api/rules/{id}/toggle` | Enable/disable a rule |
| POST | `/api/rules/{id}/test` | Test rule against recent alerts |
| PATCH | `/api/team/alerts/{id}/assign` | Assign alert to team member |
| GET | `/api/team/activity` | Team activity feed |
| GET | `/api/team/stats` | Team alert stats (total, unassigned, per-member) |

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

### Alert (Log Service)
- Fields: `id` (UUID), `severity`, `category`, `source_ip`, `destination_ip`, `source_port`, `destination_port`, `protocol`, `threat_score` (0.0–1.0), `ids_source`, `raw_data` (JSONB), `user_id`, `team_id`, `threat_intel` (JSONB), `flagged_by_threatfox`, `is_whitelisted`, `is_blocked`, `quarantine_status`, `quarantined_at`, `reviewed_by`, `review_notes`, `assigned_to`, `assigned_name`, `detected_at`, `created_at`

### BlacklistEntry / WhitelistEntry (Log Service)
- Fields: `id` (UUID), `entry_type` (IP/DOMAIN/CIDR), `value`, `reason`, `added_by` (manual/threatfox/bulk_import/rule), `user_id`, `team_id`, `block_count`/`trust_count`, `created_at`

### TeamActivity (Log Service)
- Fields: `id` (UUID), `user_id`, `user_name`, `team_id`, `action`, `details`, `created_at`

### Rule (Log Service)
- Fields: `id` (UUID), `name`, `description`, `rule_type` (RATE_LIMIT/CATEGORY_MATCH/FAILED_LOGIN), `conditions` (JSONB), `actions` (JSONB), `priority` (1–10), `enabled`, `trigger_count`, `user_id`, `team_id`, `created_at`

## Getting Started

### 1. Auth Service (port 8000)

```bash
cd services/auth-service
pip install -r requirements.txt
py manage.py migrate
py manage.py runserver
```

### 2. Log Service (port 8001)

```bash
cd services/log-service
pip install -r requirements.txt
py -m uvicorn app.main:app --reload --port 8001
```

### 3. Frontend (port 5173)

```bash
cd frontend
npm install
npm run dev
```

### Environment Variables

Root `.env` (shared by both services):
- `DATABASE_URL` — PostgreSQL connection string (Supabase)
- `JWT_SECRET_KEY` — shared JWT signing key
- `THREATFOX_AUTH_KEY` — free API key from https://auth.abuse.ch/

Frontend `frontend/.env`:
- `VITE_AUTH_API_URL` — Auth service URL (default: `http://localhost:8000`)
- `VITE_LOG_API_URL` — Log service URL (default: `http://localhost:8001`)

## Development Log

### March 29 — Project Init
- Created GitHub repository

### March 31 — Core App Build
- Scaffolded React + Vite frontend with landing page, login/signup pages, 3D globe component
- Built Django REST auth service with JWT auth, user model, subscription tiers (FREE/PRO/EXCLUSIVE)
- Implemented full signup flow, protected routes, dashboard layout with sidebar/navbar
- Added placeholder pages for Alerts, Incidents, Settings, Teams
- Built team management for EXCLUSIVE tier — team creation, leader role, PIN-based invite system

### April 1 — Log Ingestion, Threat Intelligence, Blacklist/Whitelist, Quarantine
- Created FastAPI log ingestion microservice at `services/log-service/` (port 8001)
- Implemented multi-IDS alert normalisation — accepts raw alerts from Suricata, Zeek, Snort, and Kismet and converts to unified schema
- Added automatic threat scoring (0.0–1.0) based on severity + category weights
- Async PostgreSQL storage to Supabase via SQLAlchemy + asyncpg
- Built paginated, filtered alert query API with multi-tenant isolation (users only see own alerts)
- Integrated ThreatFox API for automatic IP reputation checking on every ingested alert
- Built Threat Intel page — live feed of latest IOCs from ThreatFox with search, time range filter, and tag summary
- Built blacklist/whitelist system with priority-based ingestion logic (whitelist > blacklist > ThreatFox > normal)
- Auto-blacklist: IPs flagged by ThreatFox are automatically added to the user's blacklist
- CIDR range support (e.g. blocking `10.0.0.0/8` blocks all 10.x.x.x IPs)
- Bulk CSV import for both lists
- Quick actions on Alerts page: "Block IP" and "Trust IP" buttons per alert row
- Built quarantine system — alerts scoring 0.7–0.9 held for review, 0.9+ auto-blocked
- Quarantine page with stats, filter by status, release/block actions per alert
- Status badges on alerts: TRUSTED (green), BLOCKED (red), QUARANTINED (yellow), FLAGGED (orange), Clean
- Connected Alerts page to live backend data (replaced mock data)
- Added `.env` to `.gitignore` to protect credentials
- Implemented EXCLUSIVE team workspace — all team members share alerts, blacklists, whitelists, and quarantine
- Added `tier` and `team_id` to JWT tokens for team-scoped queries
- FREE/PREMIUM users scoped by `user_id`, EXCLUSIVE users scoped by `team_id`
- Built custom rule engine with 3 rule types (Rate Limit, Category Match, Failed Login)
- Rule builder UI with condition/action config, priority, enable/disable toggle
- Rules evaluated during ingestion — first matching rule (by priority) wins
- Rule test endpoint to dry-run against recent alerts
- Built alert assignment system — EXCLUSIVE team members can assign alerts to each other
- Assignment filter on Alerts page (All / Assigned to Me / Unassigned)
- Team activity feed — logs who assigned what, when
- Team stats — total alerts, unassigned count, per-member breakdown
- "My Assignments" widget on Dashboard for EXCLUSIVE users
- Added `user_name` to JWT for display in activity logs
- Created test script sending 10 mock alerts across all IDS formats — verified end-to-end ingestion

## Design

- Dark theme (`#0a0e1a` background)
- Blue primary (`#3B82F6`), green success, yellow warning, red danger
- Severity colors: Critical (red), High (orange), Medium (yellow), Low (gray)
- Tier badge colors: Free (gray), Premium (blue), Exclusive (purple)
- Responsive: mobile sidebar collapse, adaptive grid layouts
- Glass-morphism cards with subtle borders and hover effects
