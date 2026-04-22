# DurianDetector

A threat detection aggregation and management platform that consolidates security alerts from multiple IDS (Intrusion Detection System) sources into a unified dashboard.

## Tech Stack

- **Frontend**: React 19 + Vite, Tailwind CSS, Lucide React icons, Axios, React Router v7
- **Auth Service**: Django 6 + Django REST Framework, SimpleJWT authentication
- **Log Service**: FastAPI, SQLAlchemy (async + asyncpg), Pydantic
- **Database**: PostgreSQL (Supabase)
- **Threat Intelligence**: ThreatFox API (abuse.ch)
- **3D Visualization**: Three.js / React Three Fiber (landing page globe)
- **Real-Time**: Server-Sent Events (SSE) for live alert streaming
- **Notifications**: react-hot-toast, Browser Notification API

## Project Structure

```
newduriandetector/
├── frontend/                   # React + Vite frontend
│   └── src/
│       ├── components/         # Sidebar, Navbar, AdminSidebar, ProtectedRoute
│       ├── config/             # API configuration
│       ├── context/            # AuthContext (JWT state management)
│       ├── layouts/            # DashboardLayout, AdminLayout wrappers
│       ├── pages/              # All page components
│       │   └── admin/          # Admin panel pages
│       ├── hooks/              # useSSE, useAlertNotifications
│       └── services/           # API service layer (authService, adminService)
└── services/
    ├── auth-service/           # Django backend (port 8000)
    │   ├── users/              # User model, AuditLog model, auth + admin endpoints
    │   ├── teams/              # Team model, PIN system
    │   └── subscriptions/      # Plans and subscriptions
    ├── log-service/            # FastAPI backend (port 8001)
    │   ├── models/             # Trained ML model (.pkl) + training data
    │   └── app/
    │       ├── models/         # Alert, IngestionLog models (SQLAlchemy)
    │       ├── schemas/        # Pydantic validation schemas
    │       ├── routes/         # Ingest, alerts, upload, ingestion-logs, SSE endpoints
    │       ├── services/       # Normalizer, threat scoring
    │       ├── ml/             # ML pipeline (training data gen, model training, predictor)
    │       └── utils/          # ThreatFox integration, GeoIP, scoping, rule engine
    └── ids-watcher/            # Real-time IDS log watcher (Python async)
        ├── watcher.py          # Main watcher — tails IDS log files, POSTs to log-service
        └── config.yaml         # Enable/disable each IDS, set file paths + API token
```

## Features

### Authentication

- JWT-based auth with access/refresh tokens
- Automatic token refresh (1 min before expiry)
- Token blacklisting on logout
- Protected routes redirect unauthenticated users to login

### Tier System

| Feature | FREE ($0) | PREMIUM ($49/mo) | EXCLUSIVE ($199/mo) |
|---------|-----------|-------------------|---------------------|
| Alert monitoring | Yes | Yes | Yes |
| Dashboard | Yes | Yes | Yes |
| Alerts/Incidents | Yes | Yes | Yes |
| ML configurations | - | Yes | Yes |
| Incident management | - | Yes | Yes |
| IDS blacklist export | - | Yes | Yes |
| Unlimited alerts | - | Yes | Yes |
| GeoIP attack map | Yes | Yes | Yes |
| Team workspace | - | - | Yes (1 leader + 4 members) |
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
- **Live stats** via SSE: Total Alerts, Critical Alerts, Alerts Today, Blocked — updated every 10 seconds
- **Live Alert Feed**: last 10 alerts streamed in real-time via SSE, fade-in animation, severity color-coded, time-ago display, "View all" link to Alerts page
- **Connection status indicator**: green pulsing "Live" badge when connected, red "Disconnected" with reconnect button
- **My Assignments** widget (EXCLUSIVE only) — shows alerts assigned to the current user

### Real-Time Alerts (SSE)

- **Server-Sent Events** streaming from `GET /api/sse/alerts`
- **Global SSE context**: connection persists across all pages, not just the dashboard
- **Initial load**: fetches last 10 alerts from the API on login, then SSE appends new ones — alerts survive page refresh
- **User-scoped**: SSE context resets on logout/login — switching accounts clears old data and loads the new user's alerts
- New alerts pushed to browser within 2 seconds of ingestion
- Stats (total, today, critical, blocked) updated every 10 seconds
- Heartbeat every 30 seconds to keep connection alive
- Multi-tenant scoped (users see only their alerts, teams share)
- **Auto-reconnect** with exponential backoff (1s → 2s → 4s → 8s → 16s max)
- JWT passed via query param (EventSource API cannot send headers)
- **Live feed actions**: Block IP / Trust IP buttons on each alert, dismiss individual or clear all
- **Persistent dismissals**: dismissed alerts stored in `dismissed_alerts` table — clearing the feed survives page refresh. SSE stream and initial load both exclude dismissed alerts

### Notifications

- **Toast notifications** (react-hot-toast): in-app toast in bottom-right for HIGH and CRITICAL alerts, auto-dismiss after 5 seconds
- **Browser desktop notifications**: for CRITICAL alerts only, shows category and source IP, click to focus window
- Permission requested on dashboard mount
- Notifications only fire for alerts arriving after connection (not historical)

### Alerts Page

- **Live data** from the FastAPI log service
- Filter by severity (Critical/High/Medium/Low) and category (11 categories)
- **Date range filter**: From/To datetime pickers with clear button
- **Assignment filter** (EXCLUSIVE only): All / Assigned to Me / Unassigned
- **Assign to** dropdown per alert row (EXCLUSIVE only) — select a team member to assign
- Assigned member badge shown on each alert
- Search by IP address or category
- Alert table with severity badges, threat score, and ThreatFox intel column
- **Quick actions**: Block IP / Trust IP buttons per alert — updates alert status in database, shows toast confirmation
- **Block All Critical**: one-click mass block of all critical severity IPs on the current page
- **Alert detail modal**: click "Details" on any alert to see full info:
  - Overview: source/dest IP, ports, protocol, IDS source, threat score, quarantine status
  - Status badges: trusted, blocked, quarantined, ThreatFox flagged, assigned to
  - ML prediction: confidence bar with interpretation (benign/uncertain/malicious)
  - GeoIP location: country, latitude, longitude
  - ThreatFox intelligence: malware family, threat type, confidence, tags, reference URL
  - Quarantine review notes
  - Timeline: detected, ingested, quarantined timestamps
  - Raw IDS data: collapsible formatted JSON
- Server-side pagination with working page controls
- Loading spinner and error handling

### Analytics Page

- **4 charts**: Alerts Over Time (line), Category Distribution (pie), Top Source IPs (bar), Severity Trends (stacked bar)
- **Chart subtitles**: plain-English description under each chart explaining what it shows
- **Inline controls**: each chart has visible "Show as" (line/bar/pie), "Time period" (24h/7d/30d/90d), and "Colors" (6 palettes) dropdowns — no hidden panels
- **Global filters**: "Risk level" and "Attack type" dropdowns with helper text, apply across all charts on Refresh
- **Export as PDF**: downloads all 4 charts as a single landscape A4 PDF report with title and timestamp (jsPDF + html2canvas)
- **Export as PNG**: per-chart "Save image" button
- **Recharts**: all charts built with Recharts, responsive and styled to dark theme

### Attack Map (All Tiers)

- **2D interactive world map** built with Leaflet + react-leaflet on CARTO dark basemap tiles
- **Country borders**: rendered from Natural Earth 50m TopoJSON data (via `world-atlas` + `topojson-client`) with filled landmasses
- **GeoIP ingestion**: source IP location (lat, lon, country) looked up via ip-api.com on every alert, cached 24h in-memory, private IPs skipped
- **Attack markers**: circle markers at real-world coordinates — size scaled by alert count, color by avg threat score (blue < 0.4, yellow 0.4–0.7, red > 0.7)
- **Click popup**: shows country, alert count, avg threat score
- **Stats bar**: total geolocated alerts, unique countries, high-threat location count
- **Date range filter**: 24h / 7d / 30d / 90d

### Incidents Page

Investigation reports that group related alerts together. Alerts are automated single events; incidents are human-created cases that wrap multiple alerts for tracking and resolution.

- **Create incident**: title, priority (Critical/High/Medium/Low), description
- **Filter** by status (Open, In Progress, Resolved, Closed) and priority
- **Search** incidents by title
- **Expandable cards**: click to see description, notes timeline, linked alerts count
- **Status management**: change status via dropdown (Open → In Progress → Resolved → Closed)
- **Notes timeline**: add investigation notes with author name and timestamp
- **Link alerts**: paste alert IDs to associate related alerts with an incident; unlink to remove
- **Delete**: remove incidents with confirmation dialog
- **Pagination**: server-side with page controls
- **Multi-tenant**: incidents scoped by user (FREE/PREMIUM) or team (EXCLUSIVE)

### DurianBot (AI Security Assistant)

AI-powered chatbot built on Groq (`llama-3.3-70b-versatile`) with function calling. DurianBot can answer questions about your security data and take actions directly from the chat.

**Tier access:**
- **Free**: 5 messages per session (DurianBot Basic)
- **Premium / Exclusive**: Unlimited messages

**Tools & Capabilities:**

| Tool | Type | What it does |
|------|------|-------------|
| `get_stats` | Read | Query alert statistics — total alerts, counts by severity, top 5 categories, top 5 source IPs, blocked/quarantined counts |
| `get_alerts` | Read | Query recent alerts with severity and category filters (returns up to 10) |
| `get_blacklist` | Read | Retrieve last 20 blocked IPs with reason and who added them |
| `get_whitelist` | Read | Retrieve last 20 trusted IPs with reason and who added them |
| `block_ip` | Write | Add IP to blacklist, remove from whitelist if present, mark all existing alerts from that IP as blocked |
| `trust_ip` | Write | Add IP to whitelist, remove from blacklist if present |
| `create_incident` | Write | Create a new incident with title, description, and priority (LOW/MEDIUM/HIGH/CRITICAL) |
| `block_all_quarantined` | Write | Mass block all quarantined alert IPs — adds each unique IP to blacklist, marks all quarantined alerts as BLOCKED |

- **Read tools** execute immediately and return data to the conversation
- **Write tools** require user confirmation — the bot asks "Should I proceed?" before executing
- **Conversation flow**: user message → Gemini with tool definitions → if function call returned, backend executes it → result sent back to Gemini → Gemini formats a natural language response
- **Action badges**: green tag on messages when a destructive action was taken (e.g. "Action: Blocked IP")
- Conversation history (last 8 messages) sent for multi-turn context
- Markdown rendering in chat (bold, code blocks, bullet points, headings)
- Suggestion chips on first load for common queries

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

- **Profile**: Edit first name, last name (email read-only), save button persists to backend via `PATCH /api/auth/me/`
- **Account**: Side-by-side plan comparison (Free/Premium/Exclusive) with feature lists, pricing, and upgrade/downgrade buttons — current plan highlighted
- **API Keys**: Generate keys for IDS watcher, full key shown once with copy button, table of existing keys with label/preview/last used/status, revoke button
- **IDS Watcher**: Setup guide with quick start commands, collapsible installation guides for Suricata/Snort/Zeek/Kismet with copy-to-clipboard CLI commands, configuration snippets, log paths, and troubleshooting tips
- **Security**: Change password with current password verification

### Admin Panel (Superuser Only)

Separate admin interface for platform management. Admins are identified by Django's built-in `is_superuser` flag. Superusers log in via the same `/login` page and are automatically redirected to the admin dashboard.

- **Admin Dashboard**: stat cards (total users, active subscriptions, monthly revenue, alerts today), user tier breakdown with progress bars, quick action buttons, recent audit log feed
- **User Management**: searchable, filterable, paginated user table (50/page). Per-user actions: View Details, Suspend/Unsuspend, Change Tier, Reset Password — all behind confirmation modals. Superuser accounts hidden from the list
- **Team Management**: list all teams with member count, PIN (copy button), creation date. Expandable rows showing members with roles (Leader/Member). Actions: delete team, remove member
- **Subscription Management**: revenue calculated from user tiers (Premium x $49, Exclusive counted per team x $199). Revenue breakdown cards, ongoing subscriptions table showing type (User/Team), plan, price, status
- **System Monitoring**: database and FastAPI health checks with status indicators. Alert metrics (total, today, this week, blocked, quarantined). Team activity log table
- **Audit Logs**: full audit trail with timestamp, action, user, details, IP address. Filterable by action type (login, suspend, tier change, password reset, etc.) and "My Actions Only" toggle
- **Admin Sidebar**: red-themed navigation separate from user sidebar

**Tier change side effects:**
- Upgrading to EXCLUSIVE: auto-creates team, user becomes team leader with generated PIN
- Downgrading leader from EXCLUSIVE: dissolves team, removes all members
- Downgrading member from EXCLUSIVE: kicked from team
- These apply to both admin-initiated and self-service tier changes

**Security:**
- All `/api/admin/*` endpoints require `is_superuser=True` (403 otherwise)
- Admin layout checks `is_superuser` on every page load — non-admins redirected to `/dashboard`
- All admin actions logged to `audit_logs` table with IP address
- Admin cannot suspend other admin accounts

### Ingestion Logs Page

Completely separate from real-time alerts. Users upload IDS log files for offline analysis — processed results are stored in a dedicated `ingestion_logs` table that never touches the `alerts` table.

- **File upload**: select IDS source (Suricata/Zeek/Snort/Kismet), drop file, click Process
- **Full pipeline**: every log entry goes through threat scoring, ML detection, ThreatFox lookup, GeoIP, blacklist/whitelist checks, and auto-quarantine
- **Batch tracking**: each upload gets a `batch_id` — filter by upload batch to see all entries from a specific file
- **Actions per log**: Block IP (adds to blacklist), Trust IP (adds to whitelist), Release from quarantine
- **Filters**: severity, category, quarantine status, upload batch, search by IP
- **Detail modal**: full overview with ML prediction, GeoIP, ThreatFox intel, timeline, raw IDS data
- **Pagination**: server-side with page controls

### Real-Time IDS Monitoring

The **IDS Watcher** service (`services/ids-watcher/`) tails live IDS log files and pushes new alerts to the log-service ingestion API in real time. This is how DurianDetector gets alerts without manual file uploads.

**Supported engines:**

| IDS | Method | Log Format |
|-----|--------|------------|
| **Suricata** | File tail | EVE JSON (`eve.json`) — filters for `event_type: "alert"` |
| **Zeek** | File tail | Tab-separated `notice.log` with `#fields` header |
| **Snort** | File tail | JSON alerts (one per line) |
| **Kismet** | REST API polling | Polls `/alerts/last-time/` endpoint for new wireless alerts |

**How it works:**
1. Generate an API key from Settings → API Keys
2. Run `python watcher.py setup` — interactive wizard that configures API connection, auto-detects IDS log paths, and generates `config.yaml`
3. Run `python watcher.py` — starts async file tailers for each enabled IDS (multiple engines run concurrently)
4. New log lines are parsed, batched (configurable size/interval), and POSTed to `POST /api/logs/ingest`
5. Alerts appear in the dashboard live feed within seconds via SSE

**Features:**
- **API key auth** — never expires, no need to stay logged in. The watcher runs 24/7 independently of user sessions
- Starts from end of file (only new data, no replay of history)
- Batched POSTs (default: 50 alerts or 5 seconds, whichever comes first) to reduce API overhead
- Auto-waits if a log file doesn't exist yet (e.g. IDS hasn't started)
- Multiple IDS engines can run simultaneously
- Kismet uses REST API polling since it doesn't write a flat log file

**Requirements:** the IDS engines must be running and actively writing logs. DurianDetector does not perform packet inspection — it is the analysis/dashboard layer that consumes IDS output.

### API Key Authentication

The log-service supports two authentication methods:

| Method | Use Case | Expiry |
|--------|----------|--------|
| **JWT Bearer token** | Frontend, browser sessions, SSE | Short-lived (~30 min), auto-refreshed |
| **API key (`X-API-Key` header)** | IDS watcher, scripts, automation | Never expires, revocable |

Both methods work on all endpoints. API keys are tied to a user account — alerts ingested via API key are scoped to that user/team just like JWT.

**Key management:**
- Generate: `POST /api/api-keys` with `{"label": "my-watcher"}` — returns the full key once
- List: `GET /api/api-keys` — shows masked keys with last-used timestamps
- Revoke: `DELETE /api/api-keys/{id}` — soft-deletes (marks inactive)

Keys are prefixed with `dd_` for easy identification. The full key is only shown at creation time.

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

**Feature Schema (7 features):**

| Feature | Encoding |
|---------|----------|
| `severity` | LOW=1, MEDIUM=2, HIGH=3, CRITICAL=4 |
| `category` | OTHER=1 … SQL_INJECTION/COMMAND_INJECTION=10 |
| `source_port` | raw integer, 0 if absent |
| `destination_port` | raw integer, 0 if absent |
| `protocol` | TCP=1, UDP=2, ICMP=3, OTHER/None=0 |
| `flagged_by_threatfox` | true=1, anything else=0 |
| `ids_source` | suricata=1, zeek=2, snort=3, kismet=4 |

**Pipeline:**
1. **Training data**: 1000 synthetic alerts (500 benign, 500 malicious) generated with the 7 features above — benign samples favour TCP/UDP, low threatfox flags, low-risk categories; malicious samples favour higher threatfox flags and high-risk categories
2. **Training**: supervised models (Random Forest, Neural Network) train on 80/20 split; Isolation Forest trains on benign samples only and learns to flag outliers
3. **Prediction**: on every ingested alert (unless whitelisted), the selected model returns a confidence score (0.0–1.0) representing the probability it's malicious
4. **Score enhancement**: if ML confidence exceeds the user's sensitivity threshold (default 0.8), threat_score is boosted (default +0.2) — this can push alerts over the quarantine (0.7) or auto-block (0.9) threshold

**Retraining:**
```bash
cd services/log-service
python -m app.ml.train_model
```

**Limitations:**
- **Synthetic training data** — all 1000 samples are procedurally generated with rule-based labels. The models have never seen real network traffic. Accuracy figures (Random Forest: 100%, Isolation Forest: 79%) reflect synthetic patterns, not real-world performance.
- **Neural network is unreliable** — MLP accuracy is ~49.5% (majority-class prediction). The feature set spans vastly different scales (severity 1–4 vs ports 0–65535). Without `StandardScaler` normalisation applied at both training and inference time, gradient descent ignores small-scale features and the model defaults to predicting the majority class. Use Random Forest or Isolation Forest instead.
- **Small dataset** — 1000 samples is insufficient for generalisation. A production system would require thousands of labelled real alerts.
- **Binary output only** — models predict threat / not-threat. Attack type classification is handled separately by the rule-based category normaliser.
- **No automated retraining** — models are static after training. New attack patterns introduced post-training are not detected unless models are manually retrained.

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

**Mutual exclusion**: adding an IP to the blacklist automatically removes it from the whitelist (and vice versa). An IP cannot be on both lists simultaneously.

**Retroactive updates**: blocking or trusting an IP updates all existing alerts from that IP in the database — `is_blocked`/`is_whitelisted` and `threat_score` are set immediately, persisting across page refreshes.

**IDS Blacklist Export** (Premium/Exclusive only):
- **Suricata**: `.rules` file with `drop ip` rules, auto-generated SIDs
- **Snort**: `.txt` reputation list, one IP per line
- **Zeek**: `.intel` file in Intel framework format (`Intel::ADDR` indicators)

### Threat Intelligence Feed

The Threat Intel page shows a live feed of the latest IOCs (Indicators of Compromise) published on ThreatFox. Users can:
- Browse recent IOCs (configurable: last 1–30 days)
- Search for specific IPs, domains, or hashes
- View malware family, threat type, confidence level, first seen date, tags, and reporter info
- **Server-side caching**: ThreatFox responses cached for 5 minutes — first load hits the API, subsequent loads are instant. Falls back to stale cache if ThreatFox is unreachable

## API Endpoints

### Auth (`/api/auth/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register/` | Register new user (handles tier + team logic) |
| POST | `/login/` | Login with email/password, returns JWT tokens |
| POST | `/logout/` | Blacklist refresh token |
| POST | `/password-reset/request/` | Request password reset email (body: `{email}`) |
| POST | `/password-reset/confirm/` | Confirm reset with token (body: `{uid, token, new_password}`) |
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

### Admin (`/api/admin/`) — requires `is_superuser=True`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stats/` | Dashboard stats (users, revenue, subscriptions) |
| GET | `/users/` | List all users (search, filter, paginate) |
| GET | `/{id}/user_detail/` | Get detailed user info + subscription |
| POST | `/{id}/suspend/` | Suspend a user account |
| POST | `/{id}/unsuspend/` | Unsuspend a user account |
| POST | `/{id}/change_tier/` | Change user tier (handles team logic) |
| POST | `/{id}/reset_password/` | Reset user password to temp password |
| GET | `/subscriptions/` | Subscription stats + ongoing list |
| GET | `/teams/` | List all teams with members |
| DELETE | `/{id}/delete_team/` | Delete a team and remove all members |
| POST | `/{id}/remove_member/` | Remove a member from a team |
| GET | `/audit_log/` | Audit log entries |

### Log Service (port 8001)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/logs/ingest` | Ingest alerts (supports all IDS formats) |
| GET | `/api/alerts` | List alerts (filterable, paginated, `dismissed` param) |
| POST | `/api/alerts/dismiss-feed` | Dismiss all alerts from live feed |
| POST | `/api/alerts/{id}/dismiss-feed` | Dismiss a single alert from live feed |
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
| GET | `/api/admin/system-health` | Database + FastAPI health check (admin only) |
| GET | `/api/admin/alert-stats` | Global alert stats — total, today, week, blocked, quarantined (admin only) |
| GET | `/api/admin/activity-log` | Global team activity log (admin only) |
| GET | `/api/sse/alerts?token=JWT` | SSE stream — pushes new alerts + stats updates (authenticated via query param) |
| POST | `/api/upload` | Upload IDS log file for processing (stores in ingestion_logs) |
| GET | `/api/ingestion-logs` | List processed ingestion logs (filterable, paginated) |
| GET | `/api/ingestion-logs/batches` | List all upload batches for user |
| POST | `/api/ingestion-logs/{id}/block` | Block IP from ingestion log (adds to blacklist) |
| POST | `/api/ingestion-logs/{id}/trust` | Trust IP from ingestion log (adds to whitelist) |
| POST | `/api/ingestion-logs/{id}/release` | Release ingestion log from quarantine |
| POST | `/api/api-keys` | Generate a new API key (returns full key once) |
| GET | `/api/api-keys` | List API keys for current user (masked) |
| DELETE | `/api/api-keys/{id}` | Revoke an API key |
| POST | `/api/incidents` | Create a new incident |
| GET | `/api/incidents` | List incidents (filterable by status/priority, paginated) |
| GET | `/api/incidents/{id}` | Get incident detail with notes and alert count |
| PATCH | `/api/incidents/{id}` | Update incident (status, priority, title, description) |
| DELETE | `/api/incidents/{id}` | Delete an incident |
| POST | `/api/incidents/{id}/notes` | Add a note to an incident |
| POST | `/api/incidents/{id}/link-alert` | Link an alert to an incident |
| DELETE | `/api/incidents/{id}/unlink-alert/{alert_id}` | Unlink an alert from an incident |
| GET | `/api/incidents/{id}/alerts` | List alerts linked to an incident |
| POST | `/api/chat` | DurianBot AI chat — accepts message + history, returns Gemini response with optional tool execution |
| GET | `/api/analytics/export-pdf` | Download analytics report as PDF (server-generated, all 4 datasets) |

## Data Models

### User
- Extends Django AbstractUser
- Fields: `tier`, `team` (FK), `is_team_leader`, `is_superuser` (admin flag), `subscription_status`, timestamps

### AuditLog
- Fields: `id`, `user_id`, `user_email`, `action`, `details`, `ip_address`, `timestamp`
- Tracks: logins, registrations, suspensions, tier changes, password resets, team deletions, member removals

### Team
- Fields: `id` (UUID), `name`, `pin` (unique, 6 chars), `created_by` (FK to User), `created_at`
- Reverse relation: `members` (users with team FK)

### SubscriptionPlan
- Fields: `id` (UUID), `name`, `price_monthly`, `price_yearly`, `features` (JSON)

### Subscription
- Fields: `id` (UUID), `user` (FK), `plan` (FK), `status`, `start_date`, `end_date`, `auto_renew`

### Alert (Log Service)
- Fields: `id` (UUID), `severity`, `category`, `source_ip`, `destination_ip`, `source_port`, `destination_port`, `protocol`, `threat_score` (0.0–1.0), `ids_source`, `raw_data` (JSONB), `user_id`, `team_id`, `threat_intel` (JSONB), `flagged_by_threatfox`, `is_whitelisted`, `is_blocked`, `quarantine_status`, `quarantined_at`, `reviewed_by`, `review_notes`, `assigned_to`, `assigned_name`, `ml_confidence` (Float, nullable), `geo_latitude` (Float, nullable), `geo_longitude` (Float, nullable), `geo_country` (String, nullable), `detected_at`, `created_at`

### DismissedAlert (Log Service)
- Tracks which alerts a user has dismissed from the live feed
- Composite PK: `user_id` (BigInteger) + `alert_id` (UUID), `dismissed_at`

### IngestionLog (Log Service)
- Separate table from alerts — stores processed entries from file uploads only
- Fields: `id` (UUID), `batch_id` (UUID — groups entries from same upload), `upload_filename`, `severity`, `category`, `source_ip`, `destination_ip`, `source_port`, `destination_port`, `protocol`, `threat_score` (0.0–1.0), `ids_source`, `raw_data` (JSONB), `user_id`, `team_id`, `threat_intel` (JSONB), `flagged_by_threatfox`, `is_whitelisted`, `is_blocked`, `quarantine_status`, `quarantined_at`, `reviewed_by`, `review_notes`, `ml_confidence` (Float, nullable), `geo_latitude`, `geo_longitude`, `geo_country`, `detected_at`, `created_at`

### BlacklistEntry / WhitelistEntry (Log Service)
- Fields: `id` (UUID), `entry_type` (IP/DOMAIN/CIDR), `value`, `reason`, `added_by` (manual/threatfox/bulk_import/rule), `user_id`, `team_id`, `block_count`/`trust_count`, `created_at`

### TeamActivity (Log Service)
- Fields: `id` (UUID), `user_id`, `user_name`, `team_id`, `action`, `details`, `created_at`

### Rule (Log Service)
- Fields: `id` (UUID), `name`, `description`, `rule_type` (RATE_LIMIT/CATEGORY_MATCH/FAILED_LOGIN), `conditions` (JSONB), `actions` (JSONB), `priority` (1–10), `enabled`, `trigger_count`, `user_id`, `team_id`, `created_at`

### MLConfig (Log Service)
- Fields: `id` (UUID), `user_id`, `team_id`, `model_type` (random_forest/isolation_forest/neural_network), `enabled`, `confidence_threshold` (0.0–1.0), `sensitivity` (0.0–1.0), `score_boost` (0.0–0.5), `created_at`, `updated_at`

### APIKey (Log Service)
- Fields: `id` (UUID), `key` (String, unique, prefixed `dd_`), `label`, `user_id`, `team_id`, `tier`, `is_active` (Boolean), `last_used_at` (DateTime, nullable), `created_at`

### Incident (Log Service)
- Fields: `id` (UUID), `title`, `description` (Text, nullable), `status` (OPEN/IN_PROGRESS/RESOLVED/CLOSED), `priority` (CRITICAL/HIGH/MEDIUM/LOW), `created_by_id`, `created_by_name`, `user_id`, `team_id`, `created_at`, `updated_at`

### IncidentAlert (Log Service)
- Join table linking incidents to alerts
- Fields: `incident_id` (UUID, PK), `alert_id` (UUID, PK), `added_at`

### IncidentNote (Log Service)
- Fields: `id` (UUID), `incident_id` (UUID, FK), `content` (Text), `author_id`, `author_name`, `created_at`

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

### 3. IDS Watcher (optional — for real-time monitoring)

```bash
cd services/ids-watcher
pip install -r requirements.txt
# Edit config.yaml — enable your IDS engines, set file paths, paste JWT token
python watcher.py
```

### 4. Frontend (port 5173)

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
- `EMAIL_BACKEND` — `django.core.mail.backends.smtp.EmailBackend` (prod) or `console.EmailBackend` (dev)
- `EMAIL_HOST` / `EMAIL_PORT` / `EMAIL_USE_TLS` — SMTP server config
- `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` — SMTP credentials
- `DEFAULT_FROM_EMAIL` — sender address
- `FRONTEND_URL` — base URL used to build password reset links (default `http://localhost:5173`)

Frontend `frontend/.env`:
- `VITE_AUTH_API_URL` — Auth service URL (default: `http://localhost:8000`)
- `VITE_LOG_API_URL` — Log service URL (default: `http://localhost:8001`)

## Deployment Architecture

DurianDetector is a cloud-hosted platform. The backend services and frontend are deployed online, while each client runs a lightweight IDS watcher on their own network.

```
YOUR CLOUD (deployed online)
┌─────────────────────────────────────┐
│  Vercel/Netlify    → Frontend       │
│  Railway/Render    → Auth Service   │
│  Railway/Render    → Log Service    │
│  Supabase          → Database       │
└─────────────────────────────────────┘
              ▲               ▲
              │ HTTPS         │ HTTPS
              │               │
┌─────────────┴───┐   ┌──────┴──────────┐
│ ABC Corp Office  │   │ DEF Corp Office  │
│                  │   │                  │
│ Suricata/Snort   │   │ Suricata/Zeek    │
│      ↓           │   │      ↓           │
│ IDS Watcher      │   │ IDS Watcher      │
│ (api_key: abc..) │   │ (api_key: def..) │
└──────────────────┘   └──────────────────┘
```

### How It Works

1. **Your platform** (auth-service, log-service, frontend) is deployed to the cloud and accessible via a public URL (e.g. `https://duriandetector.com`, `https://api.duriandetector.com`)
2. **Each client** (company/team) registers on your website, picks a subscription plan (1/3/6/12 months), and activates their subscription
3. The client generates an **API key** from their Settings page
4. The client installs the **IDS watcher** on their own network — this is the only component that runs on the client side
5. The watcher reads alerts from their local IDS (Suricata, Snort, Zeek, Kismet) and pushes them over HTTPS to your cloud log-service using the API key
6. Alerts are stored in the database, scoped to that client's user/team — no other client can see them
7. The client logs into the dashboard from any browser to view their alerts, analytics, incidents, etc.

### Client Setup Guide

After a client registers and activates their subscription:

**Step 1 — Generate an API key**

Go to Settings → API Keys → Generate. Copy the key (it's only shown once).

**Step 2 — Install the IDS watcher**

On the machine running the IDS engine:

```bash
git clone <watcher-repo-or-download>
cd ids-watcher
pip install -r requirements.txt
```

**Step 3 — Configure the watcher**

Edit `config.yaml`:

```yaml
api_url: https://api.duriandetector.com   # your deployed log-service URL
api_key: dd_xxxxxxxxxxxxxxxx               # API key from Step 1

suricata:
  enabled: true
  log_path: /var/log/suricata/eve.json     # path to your Suricata EVE log

zeek:
  enabled: false
snort:
  enabled: false
kismet:
  enabled: false
```

Enable only the IDS engines you use and set the correct log file paths.

**Step 4 — Run the watcher**

```bash
python watcher.py
```

The watcher will tail the IDS log files, batch alerts, and POST them to the log-service. Alerts appear on the client's dashboard in real time via SSE.

### Multiple Clients on One Machine

If two clients share the same machine (e.g. a shared MSSP server), run two watcher instances with separate configs:

```bash
python watcher.py --config config-client-abc.yaml
python watcher.py --config config-client-def.yaml
```

Each config uses a different API key, so alerts are routed to the correct client's dashboard. Both watchers can read from the same IDS log files — the API key determines data ownership.

### Subscription Lifecycle

- **Free tier** — always active, no subscription required
- **Premium / Exclusive** — requires an active subscription (1, 3, 6, or 12 months)
- Subscription starts immediately upon activation
- When a subscription expires, the client's dashboard is blocked and alert ingestion stops (API key returns 403)
- Data is preserved — renewing restores access to all existing alerts and features
- For Exclusive teams, the team leader's subscription covers all team members

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
- Created synthetic training data generator (`app/ml/generate_training_data.py`) — 1000 samples (500 benign, 500 malicious) with 7 features: severity, category, source_port, destination_port, protocol, flagged_by_threatfox, ids_source
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

### April 3 — Admin Panel
- Built full admin dashboard for platform management, separate from user security operations
- Admin identified by Django's built-in `is_superuser` flag — no extra model field needed
- Added `is_superuser` to JWT custom claims and UserSerializer so frontend can detect admin users
- Superusers log in via the same `/login` page — automatically redirected to `/admin/dashboard`
- Created `AuditLog` model (`audit_logs` table) to track admin and user actions with IP address
- Wired audit logging into login (admin_login / user_login), registration, suspend, unsuspend, tier change, password reset, team deletion, member removal
- Built admin API endpoints at `/api/admin/` — all protected by `IsAdminPermission` (requires `is_superuser=True`, returns 403 otherwise)
- Admin endpoints: stats, user list (search/filter/paginate), user detail, suspend/unsuspend, change tier, reset password, subscription stats, team list, delete team, remove member, audit log
- Built log-service admin endpoints: system-health (DB + FastAPI check), alert-stats (total/today/week/blocked/quarantined), activity-log (global team activity)
- Added `is_admin` to log-service `CurrentUser` dataclass with `require_admin` dependency for admin-only routes
- Built red-themed admin frontend: AdminSidebar, AdminLayout (with `is_superuser` guard), admin navbar with breadcrumbs
- Admin Dashboard page: 4 stat cards (users, subscriptions, revenue, alerts today), tier breakdown with progress bars, quick action buttons, recent audit feed
- User Management page: full user table with search by email, filter by tier (Free/Premium/Exclusive) and status (Active/Suspended), 50 users per page with pagination. Actions: View Details modal, Suspend, Unsuspend, Change Tier (modal with dropdown), Reset Password — all destructive actions behind confirmation modals. Superuser accounts excluded from list and stats
- Team Management page: all teams listed with name, PIN (copy button), member count, creation date. Expandable rows show members with Leader/Member role badges. Actions: delete team (dissolves and removes all members), remove individual member
- Subscription Management page: revenue calculated from user tiers — Premium users x $49/mo, Exclusive counted per team x $199/mo. Revenue breakdown cards, ongoing subscriptions table with type column (User vs Team with member count)
- System Monitoring page: database and FastAPI health checks with green/red status indicators, 5 alert metric cards, scrollable team activity log table
- Audit Logs page: full audit trail table with timestamp, action badge, user email, details, IP address. Filterable by action type dropdown and "My Actions Only" toggle
- Implemented tier change side effects (shared via `team_utils.py`, used by both admin and self-service):
  - Upgrade to EXCLUSIVE → auto-create team with generated PIN, user becomes team leader
  - Downgrade leader from EXCLUSIVE → dissolve team, remove all members, delete team
  - Downgrade member from EXCLUSIVE → kick from team
- Built Server-Sent Events (SSE) real-time alert streaming
- Created SSE endpoint `GET /api/sse/alerts` — polls for new alerts every 2 seconds, sends stats every 10 seconds, heartbeat every 30 seconds
- JWT auth via query param (EventSource API cannot send Authorization headers)
- Multi-tenant scoped — users see only their alerts, EXCLUSIVE teams share
- Created `useSSE` React hook — manages EventSource connection, auto-reconnect with exponential backoff (1s→16s max), returns live alerts/stats/connection state
- Created `LiveAlertFeed` component — last 10 alerts with fade-in animation, severity badges, time-ago display, "Live" pulsing badge
- Created `ConnectionStatus` component — green "Live" with pulse animation, red "Disconnected" with retry button
- Created `useAlertNotifications` hook — toast notifications (react-hot-toast) for HIGH/CRITICAL alerts, browser desktop notifications for CRITICAL alerts
- Rewrote Dashboard to use live SSE data — replaced all mock data with real-time stats and alerts
- Installed react-hot-toast, added `<Toaster />` to app root
- Added fadeIn CSS keyframe animation for live alert entries
- Moved SSE to global `SSEContext` provider — connection persists across all pages, resets on user change
- SSE context loads last 10 alerts from API on login, deduplicates with SSE stream
- Added Block IP / Trust IP action buttons to live alert feed with toast feedback — auto-dismisses alert on action
- Added alert detail modal to Alerts page — full overview, ML prediction, GeoIP, ThreatFox intel, timeline, raw data
- Added toast feedback to Block IP / Trust IP on Alerts page
- Added "Block All Critical" mass action button on Alerts page
- Added date range filter (From/To datetime pickers) on Alerts page
- Fixed blacklist/whitelist mutual exclusion — adding to one list removes from the other
- Fixed retroactive alert updates — blocking/trusting an IP now updates all existing alerts from that IP in the database
- Made GeoIP Map accessible to all tiers (was Exclusive only)
- Rewrote Settings Account tab — side-by-side plan comparison cards with feature lists, pricing, upgrade/downgrade buttons
- Removed Notifications and 2FA sections from Settings (not implemented)
- Added IDS blacklist export (Premium/Exclusive only) — download blacklist formatted for Suricata (.rules), Snort (.txt), or Zeek (.intel)

### April 4 — Landing Page, Self-Service Tier Changes, Change Password
- Rewrote landing page to showcase the 4 supported IDS sources (Suricata, Zeek, Snort, Kismet) with color-coded cards, format tags, and hover effects
- Added "4 IDS Sources, One Platform" section between Stats and Features
- Updated nav with "Integrations" link, fixed stats from "10+" to "4" IDS sources
- Built self-service tier upgrade/downgrade — users can switch between Free, Premium, and Exclusive directly from Settings Account tab
- Added `POST /api/subscriptions/upgrade/` support for `tier` parameter (no plan UUID needed)
- Tier change triggers team side effects (upgrade to Exclusive → auto-create team, downgrade from Exclusive → dissolve team)
- Confirmation dialog before tier change with warning for Exclusive downgrade
- Loading spinner, success/error messages on tier change buttons
- Added `refreshUser()` to AuthContext so UI updates immediately after tier change
- Built change password feature in Settings Security tab
- Added `POST /api/auth/change-password/` endpoint with current password verification, 8-char minimum, audit logging
- Change password form with show/hide toggles, confirm password validation, loading state, success/error feedback

### April 5 — Ingestion Logs, Real-Time IDS Monitoring
- Built Ingestion Logs page (`/ingestion-logs`) — completely separate from real-time alerts, uses dedicated `ingestion_logs` table
- Created `IngestionLog` model with `batch_id` and `upload_filename` to track which upload each entry came from
- File upload endpoint `POST /api/upload` — parses Suricata/Zeek/Snort/Kismet log files, runs full processing pipeline (scoring, ML, ThreatFox, GeoIP, blacklist/whitelist, auto-quarantine), stores results in `ingestion_logs` only
- Built `GET /api/ingestion-logs` (filterable, paginated) and `GET /api/ingestion-logs/batches` (upload history grouped by batch)
- Per-log actions: Block IP (adds to blacklist), Trust IP (adds to whitelist), Release from quarantine
- Frontend: upload section with IDS source picker, file drop zone, process button; processed logs table with severity/category/status/batch filters, search, pagination, detail modal
- Added sidebar entry "Ingestion Logs" (FileUp icon) between Whitelist and Analytics
- Built IDS Watcher service (`services/ids-watcher/`) for real-time monitoring of all 4 IDS engines
- Suricata watcher: tails `eve.json`, filters for `event_type: "alert"`, batches and POSTs to `/api/logs/ingest`
- Zeek watcher: tails `notice.log`, parses tab-separated format with `#fields` header
- Snort watcher: tails JSON alert file, parses one alert per line
- Kismet watcher: polls Kismet REST API (`/alerts/last-time/`) for new wireless alerts
- Watcher features: async file tailers (start from EOF), configurable batch size/interval, auto-wait for missing files, multi-IDS concurrent support
- YAML configuration (`config.yaml`) for API URL, JWT token, per-IDS enable/disable and file paths
- Created mock Suricata log file (`mock_suricata.json`) with 15 realistic alerts covering SSH brute force, SQL injection, XSS, EternalBlue, Cobalt Strike C2, DGA DNS, Nmap scan, TOR traffic, command injection, and data exfiltration
- Built API key authentication for machine-to-machine access (IDS watcher, scripts)
- `api_keys` table with `dd_` prefixed keys, user scoping, soft revocation, last-used tracking
- Auth layer (`auth.py`) accepts either JWT Bearer token or `X-API-Key` header — tries API key first, falls back to JWT
- API key management endpoints: `POST /api/api-keys` (generate), `GET /api/api-keys` (list masked), `DELETE /api/api-keys/{id}` (revoke)
- Updated IDS watcher to prefer API key auth over JWT, with warning when using expiring tokens
- Collapsible sidebar sections (Overview, Detection, Intelligence, Policies, Workspace) — auto-opens section containing current page
- Cleaner analytics page — chart subtitles, inline controls (Show as / Time period / Colors), friendlier filter labels
- Removed Quick Actions panel from dashboard, removed non-functional search bar from navbar
- Added "View all" link on live alert feed to navigate to alerts page
- Built full Incidents system — backend (Incident, IncidentAlert, IncidentNote models) + frontend page with create modal, status management, notes timeline, alert linking, pagination
- 9 incident API endpoints: CRUD + notes + link/unlink alerts + list linked alerts, all multi-tenant scoped
- Removed mock incident data, replaced with real persistent backend
- Built API Keys management UI in Settings — generate with label, show once with copy, table with preview/last used/status, revoke
- Fixed SSE dismiss persistence — `dismissed_alerts` join table, dismiss endpoints (`POST /dismiss-feed`), SSEContext calls API on dismiss, initial load and SSE stream both exclude dismissed alerts
- Fixed profile save button — calls `PATCH /api/auth/me/` with loading state and toast feedback
- Removed notification bell from navbar (was decorative stub)
- Removed Google OAuth placeholder buttons from Login and Signup pages
- ThreatFox first_seen field fix — was mapping `first_seen_utc` but API returns `first_seen`
- Added 5-minute server-side cache on ThreatFox recent IOCs endpoint with stale fallback
- Analytics PDF export — all 4 charts in a single landscape A4 PDF with title and timestamp (jsPDF)

### April 7 — Password Reset via Email
- Wired Django email via SMTP — config read from root `.env` (`EMAIL_BACKEND`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USE_TLS`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL`, `FRONTEND_URL`)
- Added `POST /api/auth/password-reset/request/` — accepts `{email}`, generates uid + token via Django's `default_token_generator`, sends reset link `${FRONTEND_URL}/reset-password?uid=...&token=...` via `send_mail`. Always returns 200 to prevent email enumeration. Logs `password_reset_requested` to AuditLog
- Added `POST /api/auth/password-reset/confirm/` — accepts `{uid, token, new_password}`, decodes uid, validates token (3-day expiry from `PASSWORD_RESET_TIMEOUT`), enforces 8+ char min, calls `set_password()`. Logs `password_reset_completed`
- Frontend: new `ForgotPassword.jsx` (email entry form) and `ResetPassword.jsx` (reads `?uid=&token=` from URL, new password + confirm fields, redirects to login on success). Routes `/forgot-password` and `/reset-password` registered in `main.jsx`
- Added "Forgot password?" link next to the password label on the Login page
- `authService.requestPasswordReset(email)` and `authService.confirmPasswordReset(uid, token, newPassword)` helpers

### April 6 — Subscription Lifecycle, Landing Page Fixes
- Built subscription lifecycle with duration-based plans — users select 1, 3, 6, or 12-month subscription durations when upgrading to Premium or Exclusive
- Subscriptions always start immediately upon activation — no deferred start dates
- Subscription status transitions: `active` (during subscription) → `expired` (past end date), auto-refreshed on every login and API call
- Updated `Subscription` model with `duration_months`, `start_date`, computed `end_date`, and `refresh_status()` method for time-based transitions
- Added `subscription_status` and `subscription_end_date` to JWT token claims — both auth-service and log-service now aware of subscription state
- Built subscription enforcement in `DashboardLayout` — different block screens for new signups vs expired users:
  - New signups (no subscription record): "Activate Your Subscription" screen with inline duration picker and activate button
  - Expired users (had a subscription that ended): "Subscription Expired" screen with expiry date and renewal option
  - Both screens include duration selector (1/3/6/12 months) and price summary
- Added `require_active_subscription` dependency in log-service — gates alert ingestion endpoint, returns 403 with subscription status message for expired users
- API key authentication also blocked when subscription is expired (through JWT claim propagation)
- For EXCLUSIVE teams, subscription is tied to the team leader — all team members inherit the leader's subscription status
- FREE tier users exempt from subscription checks (always active)
- Updated Settings Account tab with current subscription info panel showing status, duration, start/end dates
- Built upgrade modal — when upgrading to a paid plan, users pick duration (1/3/6/12 months) with price summary before confirming
- Built renewal modal — expired subscriptions can be renewed with new duration selection
- Added `POST /api/subscriptions/renew/` endpoint for subscription renewal
- Updated `GET /api/subscriptions/my-subscription/` to return full subscription details with auto-refreshed status
- Subscription plans table created in database (`subscription_plans`, `subscriptions` tables)
- Landing page fixes: "Get Started Free" CTA button now links to signup page, removed non-functional "View Documentation" button
- Removed non-functional notification bell button from admin layout header
- Built DurianBot AI chatbot powered by Google Gemini (free tier)
- Backend: `POST /api/chat` endpoint — gathers user's alert context (stats, severity breakdown, top IPs, top categories, recent critical alerts), sends to Gemini with system prompt, returns natural language response
- Gemini integration via direct REST API call (no SDK dependency) — uses `gemini-2.5-flash` model
- System prompt instructs Gemini to act as a security analyst, only reference provided data, keep responses actionable
- Context gathering: total alerts, 24h/7d counts, severity breakdown, top 5 categories, top 5 source IPs with avg threat scores, last 5 critical alerts with geo data, blocked/quarantined counts
- Conversation history support — sends last 10 messages for multi-turn context
- Chat UI: full-page chat interface with message bubbles, markdown rendering (bold, code blocks, bullet points, headings), typing indicator with bouncing dots, auto-scroll, auto-resize textarea
- Suggestion chips on first load: "How many critical alerts do I have?", "What are the top attack sources?", etc.
- Tier gating: Free users get DurianBot Basic (5 messages per session with countdown), Premium/Exclusive get unlimited
- Added `GEMINI_API_KEY` to env config and log-service settings
- Sidebar: "DurianBot" link (Bot icon) in Workspace section, visible to all tiers
- Error handling: rate limit (429), connection failure, missing API key — all shown inline in chat
- Added Gemini function calling (tool use) — DurianBot can now take actions, not just answer questions
- 7 tools: `get_stats`, `get_alerts`, `block_ip`, `trust_ip`, `create_incident`, `get_blacklist`, `get_whitelist`
- Read tools (get_stats, get_alerts, get_blacklist, get_whitelist) execute immediately
- Write tools (block_ip, trust_ip, create_incident) require user confirmation — bot asks "Should I proceed?" before executing
- Tool execution: bot calls Gemini → Gemini returns function call → backend executes it → sends result back to Gemini → Gemini formats natural language response
- block_ip: adds to blacklist, removes from whitelist if present, marks all existing alerts from that IP as blocked
- trust_ip: adds to whitelist, removes from blacklist if present
- create_incident: creates incident with title, description, priority
- Action badge on chat messages — green "Action: Blocked IP" tag when a destructive action was taken

### April 9 — Watcher Setup Wizard, IDS Setup Guide
- Built **interactive CLI setup wizard** for IDS watcher (`python watcher.py setup`)
  - Prompts for API URL and key with connection test
  - Multi-IDS selection (comma-separated) — all run concurrently
  - Auto-detects common log paths for Suricata, Snort, Zeek
  - Validates file paths exist, warns if not found
  - Kismet prompts for REST API URL separately
  - Configurable batch settings
  - Generates ready-to-use `config.yaml`
- Added **IDS Watcher Setup tab** to Settings page with:
  - Quick start commands (clone, install, setup wizard)
  - Collapsible installation guides for all 4 IDS engines (Suricata, Snort 3, Zeek, Kismet) with copy-to-clipboard CLI commands
  - Configuration snippets (EVE JSON, alert_json, node.cfg, REST API)
  - Log path reference per engine
  - Troubleshooting section
- Created comprehensive **IDS Setup Guide** (`services/ids-watcher/IDS_SETUP_GUIDE.md`) with full CLI commands for installing, configuring, and running all 4 IDS engines on Ubuntu/Debian and CentOS/Fedora
- Added **IDS watcher connection nudge** on Dashboard — amber banner shown to users with no active API keys
  - Visible to: Free users, Premium users, Exclusive team leaders
  - Hidden from: Exclusive team members (leader handles watcher setup)
  - Links directly to Settings → IDS Watcher tab
  - Dismissible with localStorage persistence
  - Auto-disappears once an API key is created
- Removed auth-service Dockerfile (was using dev server `manage.py runserver`, not needed for Railway/Render deployment)

### April 12 — Team Alert Assignment, Stats Cleanup
- Added **Assign button** to the live alert feed for team leaders — click to open an inline member dropdown, assigns alert via `PATCH /api/team/alerts/{alert_id}/assign`
- Once assigned, the button is replaced with a blue badge showing the assignee's name
- Only visible to users with `is_team_leader` and an active team
- Removed **Alerts per Member** card from the Team view (backend query and frontend card)
- Team stats now show only Total Alerts and Unassigned counts
- Removed **Engine Comparison** feature entirely — frontend page, backend routes/model, correlator, sidebar nav, and API endpoints

## Design

- Dark theme (`#0a0e1a` background)
- Blue primary (`#3B82F6`), green success, yellow warning, red danger
- Severity colors: Critical (red), High (orange), Medium (yellow), Low (gray)
- Tier badge colors: Free (gray), Premium (blue), Exclusive (purple)
- Admin theme: red accent (`#EF4444`), darker background (`#0d1117`), red-tinted borders
- Responsive: mobile sidebar collapse, adaptive grid layouts
- Glass-morphism cards with subtle borders and hover effects
- Live alert feed with fade-in animations and pulsing connection indicator
