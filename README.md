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
        ├── models/             # Trained ML model (.pkl) + training data
        └── app/
            ├── models/         # Alert model (SQLAlchemy)
            ├── schemas/        # Pydantic validation schemas
            ├── routes/         # Ingest + query endpoints
            ├── services/       # Normalizer, threat scoring
            ├── ml/             # ML pipeline (training data gen, model training, predictor)
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

### Analytics Page

- **4 charts**: Alerts Over Time (line), Category Distribution (pie), Top Source IPs (bar), Severity Trends (stacked bar)
- **Chart customization**: each chart has a collapsible "Customize" panel to switch chart type (line/bar/pie), date range (24h/7d/30d/90d), and color scheme (6 palettes)
- **Global filters**: severity and category dropdowns apply across all charts on Refresh
- **Export as PNG**: per-chart export button using html2canvas
- **Export as CSV**: downloads alert time-series data as CSV
- **Recharts**: all charts built with Recharts, responsive and styled to dark theme

### Attack Map (Exclusive Only)

- **2D interactive world map** built with Leaflet + react-leaflet on CARTO dark basemap tiles
- **Country borders**: rendered from Natural Earth 50m TopoJSON data (via `world-atlas` + `topojson-client`) with filled landmasses
- **GeoIP ingestion**: source IP location (lat, lon, country) looked up via ip-api.com on every alert, cached 24h in-memory, private IPs skipped
- **Attack markers**: circle markers at real-world coordinates — size scaled by alert count, color by avg threat score (blue < 0.4, yellow 0.4–0.7, red > 0.7)
- **Click popup**: shows country, alert count, avg threat score
- **Stats bar**: total geolocated alerts, unique countries, high-threat location count
- **Date range filter**: 24h / 7d / 30d / 90d

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

### ML Threat Detection

Three ML models predict whether each alert is malicious, adding an ML confidence score alongside the rule-based threat score. Users can switch between models via the ML Config page.

**Available Models:**

| Model | Type | How it works |
|-------|------|-------------|
| **Random Forest** | Supervised | Ensemble of 100 decision trees — fast, interpretable, good baseline for structured alert data |
| **Isolation Forest** | Unsupervised | Trained on benign data only — detects anomalies by measuring how easily a sample is isolated, good for zero-day threats |
| **Neural Network** | Supervised | Multi-layer perceptron (64→32 neurons) — learns non-linear feature relationships for advanced detection |

**Pipeline:**
1. **Training data**: 1000 synthetic alerts (500 benign, 500 malicious) with 5 features — severity (encoded 1–4), category (encoded 1–10), alert_count_last_hour, source_port, destination_port
2. **Training**: supervised models (Random Forest, Neural Network) train on 80/20 split; Isolation Forest trains on benign samples only and learns to flag outliers
3. **Prediction**: on every ingested alert (unless whitelisted), the selected model returns a confidence score (0.0–1.0) representing the probability it's malicious
4. **Score enhancement**: if ML confidence exceeds the user's sensitivity threshold (default 0.8), threat_score is boosted (default +0.2) — this can push alerts over the quarantine (0.7) or auto-block (0.9) threshold

| ML Confidence | Badge Color | Meaning |
|---------------|-------------|---------|
| < 0.3 | Green | Likely benign |
| 0.3 – 0.7 | Yellow | Uncertain |
| > 0.7 | Red | Likely malicious |

**Graceful degradation**: if the selected model's pickle file doesn't exist, the predictor falls back to `threat_model.pkl` (legacy Random Forest). If no model files exist at all, predictions are skipped and `ml_confidence` stays null.

### ML Configuration (Premium/Exclusive Only)

Premium and Exclusive users can tune how the ML model affects threat scoring via the ML Config page:

| Setting | Range | Default | What it does |
|---------|-------|---------|--------------|
| **Model Type** | Random Forest / Isolation Forest / Neural Network | Random Forest | Select which ML model to use for predictions |
| **Enabled** | On / Off | On | Master toggle — disables all ML predictions when off |
| **Sensitivity** | 0.50 – 0.95 | 0.80 | ML confidence above this value triggers a score boost |
| **Score Boost** | +0.05 – +0.50 | +0.20 | How much to add to threat_score when ML flags an alert |
| **Confidence Threshold** | 0.30 – 0.90 | 0.70 | Minimum ML confidence to display "ML-flagged" badge |

Settings are stored per-user (FREE/PREMIUM) or per-team (EXCLUSIVE) and are applied during alert ingestion. Free users see an upgrade prompt instead of the configuration panel.

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
| GET | `/api/ml-config` | Get ML configuration (Premium/Exclusive only) |
| PUT | `/api/ml-config` | Update ML configuration (Premium/Exclusive only) |
| GET | `/api/analytics/time-series` | Alert counts grouped by hour/day |
| GET | `/api/analytics/category-distribution` | Alert counts per category |
| GET | `/api/analytics/top-sources` | Top N source IPs by alert count |
| GET | `/api/analytics/severity-trends` | Severity breakdown over time |
| GET | `/api/analytics/geo-map` | Alert locations grouped by lat/lon/country |

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
- Fields: `id` (UUID), `severity`, `category`, `source_ip`, `destination_ip`, `source_port`, `destination_port`, `protocol`, `threat_score` (0.0–1.0), `ids_source`, `raw_data` (JSONB), `user_id`, `team_id`, `threat_intel` (JSONB), `flagged_by_threatfox`, `is_whitelisted`, `is_blocked`, `quarantine_status`, `quarantined_at`, `reviewed_by`, `review_notes`, `assigned_to`, `assigned_name`, `ml_confidence` (Float, nullable), `geo_latitude` (Float, nullable), `geo_longitude` (Float, nullable), `geo_country` (String, nullable), `detected_at`, `created_at`

### BlacklistEntry / WhitelistEntry (Log Service)
- Fields: `id` (UUID), `entry_type` (IP/DOMAIN/CIDR), `value`, `reason`, `added_by` (manual/threatfox/bulk_import/rule), `user_id`, `team_id`, `block_count`/`trust_count`, `created_at`

### TeamActivity (Log Service)
- Fields: `id` (UUID), `user_id`, `user_name`, `team_id`, `action`, `details`, `created_at`

### Rule (Log Service)
- Fields: `id` (UUID), `name`, `description`, `rule_type` (RATE_LIMIT/CATEGORY_MATCH/FAILED_LOGIN), `conditions` (JSONB), `actions` (JSONB), `priority` (1–10), `enabled`, `trigger_count`, `user_id`, `team_id`, `created_at`

### MLConfig (Log Service)
- Fields: `id` (UUID), `user_id`, `team_id`, `model_type` (random_forest/isolation_forest/neural_network), `enabled`, `confidence_threshold` (0.0–1.0), `sensitivity` (0.0–1.0), `score_boost` (0.0–0.5), `created_at`, `updated_at`

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

### April 2 — ML Threat Detection
- Built machine learning threat detection pipeline with 3 selectable models: Random Forest (supervised), Isolation Forest (unsupervised anomaly detection), Neural Network (MLP)
- Created synthetic training data generator (`app/ml/generate_training_data.py`) — 1000 samples (500 benign, 500 malicious) with encoded severity, category, alert count, and port features
- Training script (`app/ml/train_model.py`) — trains all 3 models in one run; supervised models use 80/20 split, Isolation Forest trains on benign data only to learn normal patterns
- Prediction module (`app/ml/predictor.py`) — loads models by name with caching, handles both `predict_proba` (supervised) and `score_samples` (Isolation Forest) APIs
- Integrated ML prediction into alert ingestion pipeline — every non-whitelisted alert gets an `ml_confidence` score (0.0–1.0)
- ML-enhanced scoring: if ML confidence > 0.8, threat_score is boosted by +0.2 (can trigger auto-block or quarantine)
- Added `ml_confidence` nullable float column to Alert model
- Added "ML" column to Alerts page — color-coded badge showing ML confidence percentage (green < 30%, yellow 30–70%, red > 70%)
- Added "ML-flagged only" checkbox filter on Alerts page — server-side filter for alerts with `ml_confidence > 0.7`
- Added `ml_flagged` query parameter to alerts API endpoint
- Model gracefully degrades — if `threat_model.pkl` is missing, predictions are skipped and `ml_confidence` stays null
- Built ML Configuration page (`/ml-config`) — tier-gated to Premium/Exclusive users only
- ML Config UI: model selection (Random Forest, Isolation Forest, Neural Network), enable/disable toggle, sensitivity slider, score boost slider, confidence threshold slider, reset to default button
- Backend: `ml_configs` table stores per-user/team ML settings (model_type, enabled, sensitivity, score_boost, confidence_threshold)
- API: `GET /api/ml-config` and `PUT /api/ml-config` — returns 403 for Free tier users
- Ingestion pipeline reads user's ML config and applies their sensitivity/boost settings instead of hardcoded defaults
- Sidebar: "ML Config" link (BrainCircuit icon) visible only to Premium/Exclusive users via `premiumOnly` flag
- Free users visiting `/ml-config` see an upgrade prompt with link to Settings
- Built Analytics dashboard (`/analytics`) with 4 interactive charts (Recharts)
- Backend: 4 analytics endpoints — time-series, category-distribution, top-sources, severity-trends — all multi-tenant scoped with date/severity/category filters
- Charts: Alerts Over Time (line), Category Distribution (pie), Top Source IPs (bar), Severity Trends (stacked bar)
- Per-chart customization: chart type (line/bar/pie), date range (24h/7d/30d/90d), color palette (6 schemes)
- Global severity + category filters applied on Refresh
- Export charts as PNG via html2canvas, export data as CSV
- Sidebar: "Analytics" link with BarChart3 icon visible to all users
- Built Attack Map page (`/attack-globe`) using Leaflet + react-leaflet with CARTO dark tiles, Exclusive tier only
- GeoIP lookup utility (`app/utils/geoip.py`) — ip-api.com with 24h in-memory cache, private IP skip
- Added `geo_latitude`, `geo_longitude`, `geo_country` fields to Alert model — populated during ingestion
- Map features: country borders from Natural Earth 50m TopoJSON (`world-atlas` + `topojson-client`), filled landmasses, circle markers sized by alert count, color-coded by threat score, click popups, stats bar
- Backend endpoint `GET /api/analytics/geo-map` — groups alerts by location with count and avg score
- Sidebar: "Attack Map" link (Globe icon) visible only to Exclusive users

## Design

- Dark theme (`#0a0e1a` background)
- Blue primary (`#3B82F6`), green success, yellow warning, red danger
- Severity colors: Critical (red), High (orange), Medium (yellow), Low (gray)
- Tier badge colors: Free (gray), Premium (blue), Exclusive (purple)
- Responsive: mobile sidebar collapse, adaptive grid layouts
- Glass-morphism cards with subtle borders and hover effects
