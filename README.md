# DurianDetector

A threat detection aggregation and management platform that consolidates security alerts from multiple IDS (Intrusion Detection System) sources into a unified dashboard.

## Tech Stack

- **Frontend**: React 19 + Vite, Tailwind CSS v4, Lucide React icons, Axios, React Router v7
- **Auth Service**: Django 5.0 + Django REST Framework, SimpleJWT authentication
- **Log Service**: FastAPI, SQLAlchemy 2.0 (async + asyncpg), Pydantic v2
- **Database**: PostgreSQL (Supabase)
- **ML**: scikit-learn (Random Forest, Isolation Forest, Neural Network MLP)
- **Threat Intelligence**: ThreatFox API (abuse.ch), ip-api.com GeoIP
- **AI Chatbot**: Groq (llama-3.3-70b-versatile) with function calling
- **3D Visualization**: Three.js + React Three Fiber (landing page globe)
- **Maps**: Leaflet + react-leaflet (2D interactive attack map)
- **Charts**: Recharts (time series, pie, bar, stacked bar)
- **Real-Time**: Server-Sent Events (SSE) for live alert streaming
- **Notifications**: react-hot-toast, Browser Notification API
- **Export**: jsPDF + html2canvas (PDF/PNG analytics reports)
- **Email**: Brevo SMTP via django-anymail
- **Deployment**: Railway (services), Vercel (frontend), Supabase (database)

## Project Structure

```
newduriandetector/
├── frontend/                   # React 19 + Vite frontend
│   └── src/
│       ├── components/         # Sidebar, Navbar, AdminSidebar, LiveAlertFeed, ConnectionStatus
│       ├── config/             # API configuration
│       ├── context/            # AuthContext (JWT state), SSEContext (real-time alerts)
│       ├── layouts/            # DashboardLayout, AdminLayout (protected wrappers)
│       ├── pages/              # 21 page components
│       │   └── admin/          # Admin panel pages (5 pages)
│       ├── hooks/              # useAlertNotifications
│       └── services/           # API service layer (authService, adminService)
└── services/
    ├── auth-service/           # Django backend (port 8000)
    │   ├── users/              # User model, AuditLog model, auth + admin endpoints
    │   ├── teams/              # Team model, PIN invite system
    │   └── subscriptions/      # Plans and duration-based subscriptions
    ├── log-service/            # FastAPI backend (port 8001)
    │   ├── models/             # Trained ML model files (.pkl)
    │   └── app/
    │       ├── models/         # Alert, IngestionLog, Incident, BlacklistEntry, etc. (SQLAlchemy)
    │       ├── schemas/        # Pydantic validation schemas
    │       ├── routes/         # All API route handlers
    │       ├── services/       # Normalizer (IDS format converter), threat scoring
    │       ├── ml/             # ML pipeline (training data gen, model training, predictor)
    │       └── utils/          # ThreatFox, GeoIP, rule engine, multi-tenant scoping, IP matcher
    └── ids-watcher/            # Real-time IDS log watcher (Python async)
        ├── watcher.py          # Main watcher — tails IDS log files, POSTs to log-service
        ├── config.yaml         # Enable/disable each IDS, set file paths + API key
        └── IDS_SETUP_GUIDE.md  # Full install + config guides for all 4 IDS engines
```

## Features

### Authentication

- JWT-based auth with access (short-lived, ~30 min) and refresh (long-lived) tokens
- Automatic token refresh 1 minute before expiry via Axios interceptor
- Token blacklisting on logout
- Protected routes redirect unauthenticated users to login
- Password reset via email (Brevo SMTP) — reset link sent to registered email with 3-day token expiry
- Change password with current password verification

### Tier System

| Feature | FREE ($0) | PREMIUM ($49/mo) | EXCLUSIVE ($199/mo) |
|---------|-----------|-------------------|---------------------|
| Alert monitoring | Yes | Yes | Yes |
| Dashboard + live feed | Yes | Yes | Yes |
| GeoIP attack map | Yes | Yes | Yes |
| DurianBot (AI chatbot) | Read-only, 5 msgs/session | Full access | Full access |
| ML configurations | — | Yes | Yes |
| Incident management | — | Yes | Yes |
| IDS blacklist export | — | Yes | Yes |
| Unlimited alerts | — | Yes | Yes |
| Custom alert rules | — | — | Yes |
| Team workspace | — | — | Yes (1 leader + 4 members) |
| Dedicated support | — | — | Yes |

### Upgrade Drivers

**Free → Premium** unlocks:
- Full alert history with date range filtering
- Quarantine management — release false positives or confirm and block threats
- Blacklist and whitelist management
- Full analytics dashboard (time series, category distribution, top sources, severity trends, PDF export)
- ML configuration — choose model, tune sensitivity and score boost
- Incident management — create, track, and resolve security investigations
- Ingestion log uploads — upload and analyse IDS log files offline
- DurianBot full access — read and write tools (block IPs, trust IPs, create incidents, mass block quarantined)

**Premium → Exclusive** unlocks:
- Shared team workspace — up to 1 leader + 4 members on one account
- Alert assignment — assign alerts to specific team members for investigation
- Team activity feed — see who did what across the team
- Shared blacklist, whitelist, and quarantine — one member's action applies to the whole team
- Custom detection rules (Rate Limit, Category Match, Failed Login)

### Team Collaboration (Exclusive Only)

- **Team Leader**: First Exclusive user creates a team automatically on signup
- **Team PIN**: Auto-generated 6-character alphanumeric code (e.g. `A7X42K`)
- **Team Members**: Up to 4 members can join using the leader's PIN during signup
- **PIN Management**: Leader can copy PIN to clipboard or regenerate it anytime
- **Access Control**: Only leader can regenerate PIN, remove members, and assign alerts
- **Sidebar**: Teams nav link hidden for Free/Premium users
- **Shared workspace**: All team members see the same alerts, blacklist, whitelist, and quarantine queue. One member blocks an IP — all members see it immediately

### Data Scoping (Multi-Tenant)

How data is isolated depends on the user's tier:

| Tier | Scoped By | Meaning |
|------|-----------|---------|
| FREE / PREMIUM | `user_id` | Each user sees only their own data |
| EXCLUSIVE | `team_id` | All team members share the same data |

This applies to: alerts, blacklist, whitelist, quarantine, incidents, ingestion logs, ML config, rules, and threat intel flagging. The JWT token carries `tier` and `team_id` so the log service scopes every query automatically.

### Registration Flow

- Select tier (Free / Premium / Exclusive)
- For Exclusive users:
  - **Team Leader**: No PIN needed — team auto-created with generated PIN
  - **Team Member**: Enter team PIN to join existing team (validated, max 4 members enforced)
- Password minimum 8 characters with confirmation
- Full name parsed into first/last name

### Dashboard

- Welcome greeting with user's first name
- **Live stats** via SSE: Total Alerts, Critical Alerts, Alerts Today, Blocked — updated every 10 seconds
- **Live Alert Feed**: last 10 alerts streamed in real-time via SSE, fade-in animation, severity color-coded, time-ago display, "View all" link to Alerts page
- **Connection status indicator**: green pulsing "Live" badge when connected, red "Disconnected" with reconnect button
- **My Assignments** widget (Exclusive only) — shows alerts assigned to the current user
- **IDS Watcher nudge**: amber banner shown to users with no active API keys, links to Settings → IDS Watcher tab; dismissible with localStorage persistence; hidden from Exclusive team members

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
- JWT passed via query param (EventSource API cannot send Authorization headers)
- **Live feed actions**: Block IP / Trust IP buttons on each alert, assign to member (Exclusive leaders), dismiss individual or clear all
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
- **Assignment filter** (Exclusive only): All / Assigned to Me / Unassigned
- **Assign to** dropdown per alert row (Exclusive only) — select a team member to assign
- Assigned member badge shown on each alert
- Search by IP address or category
- Alert table with severity badges, threat score, ThreatFox intel column, and ML confidence badge
- **ML-flagged filter**: checkbox to show only alerts with ML confidence > 0.7
- **Quick actions**: Block IP / Trust IP buttons per alert — updates alert status in database, shows toast confirmation
- **Block All Critical**: one-click mass block of all critical severity IPs on the current page
- **Alert detail modal**: click "Details" on any alert to see full info:
  - Overview: source/dest IP, ports, protocol, IDS source, threat score, quarantine status
  - Status badges: trusted, blocked, quarantined, ThreatFox flagged, assigned to
  - ML prediction: confidence bar with interpretation (benign / uncertain / malicious)
  - GeoIP location: country, latitude, longitude
  - ThreatFox intelligence: malware family, threat type, confidence, tags, reference URL
  - Timeline: detected, ingested, quarantined timestamps
  - Raw IDS data: collapsible formatted JSON
- Server-side pagination with working page controls

### Analytics Page

- **4 charts**: Alerts Over Time (line), Category Distribution (pie), Top Source IPs (bar), Severity Trends (stacked bar)
- **Chart subtitles**: plain-English description under each chart
- **Inline controls**: each chart has visible "Show as" (line/bar/pie), "Time period" (24h/7d/30d/90d), and "Colors" (6 palettes) dropdowns
- **Global filters**: "Risk level" and "Attack type" dropdowns apply across all charts on Refresh
- **Export as PDF**: downloads all 4 charts as a single landscape A4 PDF with title and timestamp (jsPDF + html2canvas)
- **Export as PNG**: per-chart "Save image" button

### Attack Map (All Tiers)

- **2D interactive world map** built with Leaflet + react-leaflet on CARTO dark basemap tiles
- **Country borders**: rendered from Natural Earth 50m TopoJSON data (`world-atlas` + `topojson-client`) with filled landmasses
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
- **Multi-tenant**: incidents scoped by user (Free/Premium) or team (Exclusive)

### DurianBot (AI Security Assistant)

AI-powered chatbot built on Groq (`llama-3.3-70b-versatile`) with function calling. DurianBot can answer questions about your security data and take actions directly from the chat.

**Tier access:**
- **Free**: Read-only — can query alerts, stats, blacklist, whitelist. Limited to 5 messages per session with a visible countdown. Write tools are blocked server-side with an upgrade prompt from the bot.
- **Premium / Exclusive**: Full access — all read and write tools, unlimited messages

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
- **Conversation flow**: user message → Groq with tool definitions → if function call returned, backend executes it → result sent back to Groq → Groq formats a natural language response
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
  - **Team stats**: total alerts and unassigned alert count
  - **Activity feed**: shows who did what — alert assignments, IP blocks, quarantine reviews

### Settings Page

- **Profile**: Edit first name, last name (email read-only), save button persists to backend via `PATCH /api/auth/me/`
- **Account**: Side-by-side plan comparison (Free/Premium/Exclusive) with feature lists, pricing, upgrade/downgrade buttons — current plan highlighted. Current subscription info panel showing status, duration, start/end dates. Upgrade/renewal modal with duration selector (1/3/6/12 months) and price summary
- **Security**: Change password with current password verification, 8-character minimum, show/hide toggles
- **API Keys**: Generate keys for IDS watcher (full key shown once with copy button), table of existing keys with label/preview/last used/status, revoke button
- **IDS Watcher**: Quick start commands, collapsible installation guides for Suricata/Snort 3/Zeek/Kismet with copy-to-clipboard CLI commands, configuration snippets, log paths, and troubleshooting tips

### Admin Panel (Superuser Only)

Separate admin interface for platform management. Admins are identified by Django's built-in `is_superuser` flag. Superusers log in via the same `/login` page and are automatically redirected to the admin dashboard.

- **Admin Dashboard**: 4 stat cards (total users, active subscriptions, monthly revenue, alerts today), user tier breakdown with progress bars, quick action buttons, recent audit log feed
- **User Management**: searchable, filterable, paginated user table (50/page). Per-user actions: View Details, Suspend/Unsuspend, Change Tier, Reset Password — all behind confirmation modals. Superuser accounts hidden from list and stats
- **Team Management**: list all teams with name, PIN (copy button), member count, creation date. Expandable rows showing members with Leader/Member role badges. Actions: delete team, remove member
- **Subscription Management**: revenue calculated from user tiers (Premium x $49, Exclusive counted per team x $199). Revenue breakdown cards, ongoing subscriptions table showing type (User/Team), plan, price, status
- **Audit Logs**: full audit trail with timestamp, action badge, user email, details, IP address. Filterable by action type and "My Actions Only" toggle
- **Admin Sidebar**: red-themed navigation separate from user sidebar

**Tier change side effects** (apply to both admin-initiated and self-service changes):
- Upgrading to Exclusive → auto-creates team, user becomes team leader with generated PIN
- Downgrading leader from Exclusive → dissolves team, removes all members
- Downgrading member from Exclusive → kicked from team

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

The **IDS Watcher** service (`services/ids-watcher/`) tails live IDS log files and pushes new alerts to the log-service ingestion API in real time.

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

**Requirements:** IDS engines must be running and actively writing logs. DurianDetector does not perform packet inspection — it is the analysis/dashboard layer that consumes IDS output.

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

### Log Ingestion Pipeline

Every alert ingested via real-time watcher or file upload goes through this pipeline:

```
IDS (Suricata/Zeek/Snort/Kismet)
    ↓
Normalizer — converts raw IDS format to unified schema
    ↓
Threat Scoring — (0.6 × severity) + (0.4 × category)
    ↓
Whitelist check — if matched: score=0, skip further checks
    ↓
Blacklist check — if matched: score=1.0, mark blocked
    ↓
ThreatFox lookup — if flagged: score boosted to 0.9–1.0, IP auto-blacklisted
    ↓
GeoIP lookup — lat/lon/country via ip-api.com (24h cache, private IPs skipped)
    ↓
ML prediction — confidence score (0.0–1.0), score boost if above sensitivity threshold
    ↓
Rule evaluation — first matching rule by priority wins, actions applied
    ↓
Quarantine logic:
  score ≥ 0.9  → auto-block (IP blacklisted immediately)
  0.7–0.9      → quarantine for human review
  < 0.7        → logged normally
    ↓
Alert persisted to PostgreSQL
    ↓
SSE pushes new alert to all connected users within 2 seconds
```

- **Multi-IDS support**: Suricata (EVE JSON), Zeek (notice logs), Snort (JSON alerts), Kismet (REST API)
- **Async**: built on FastAPI + asyncpg for non-blocking database writes
- **Multi-tenant**: alerts tagged with authenticated user's ID/team_id

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
| **Isolation Forest** | Unsupervised | Trained on benign data only — detects anomalies by measuring how easily a sample is isolated; good for zero-day threats |
| **Neural Network** | Supervised | Multi-layer perceptron (64→32 neurons) — learns non-linear feature relationships |

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
1. **Training data**: 1000 synthetic alerts (500 benign, 500 malicious) generated with the 7 features above
2. **Training**: supervised models (Random Forest, Neural Network) train on 80/20 split; Isolation Forest trains on benign samples only
3. **Prediction**: on every ingested alert (unless whitelisted), the selected model returns a confidence score (0.0–1.0)
4. **Score enhancement**: if ML confidence exceeds the user's sensitivity threshold (default 0.8), threat_score is boosted (default +0.2) — this can push alerts over the quarantine (0.7) or auto-block (0.9) threshold

**Retraining:**
```bash
cd services/log-service
python -m app.ml.train_model
```

**Limitations:**
- **Synthetic training data** — all 1000 samples are procedurally generated with rule-based labels. The models have never seen real network traffic. Accuracy figures reflect synthetic patterns, not real-world performance.
- **Neural network is unreliable** — MLP accuracy is ~49.5% (majority-class prediction). Without `StandardScaler` normalisation applied at both training and inference time, gradient descent ignores small-scale features. Use Random Forest or Isolation Forest instead.
- **Small dataset** — 1000 samples is insufficient for generalisation. A production system would require thousands of labelled real alerts.
- **Binary output only** — models predict threat / not-threat. Attack type classification is handled by the rule-based category normaliser.
- **No automated retraining** — models are static after training.

| ML Confidence | Badge Color | Meaning |
|---------------|-------------|---------|
| < 0.3 | Green | Likely benign |
| 0.3 – 0.7 | Yellow | Uncertain |
| > 0.7 | Red | Likely malicious |

**Graceful degradation**: if the selected model's pickle file doesn't exist, the predictor falls back to `threat_model.pkl` (legacy Random Forest). If no model files exist, predictions are skipped and `ml_confidence` stays null.

### ML Configuration (Premium/Exclusive Only)

| Setting | Range | Default | What it does |
|---------|-------|---------|--------------|
| **Model Type** | Random Forest / Isolation Forest / Neural Network | Random Forest | Select which ML model to use |
| **Enabled** | On / Off | On | Master toggle — disables all ML predictions when off |
| **Sensitivity** | 0.50 – 0.95 | 0.80 | ML confidence above this value triggers a score boost |
| **Score Boost** | +0.05 – +0.50 | +0.20 | How much to add to threat_score when ML flags an alert |
| **Confidence Threshold** | 0.30 – 0.90 | 0.70 | Minimum ML confidence to display "ML-flagged" badge |

Settings are stored per-user (Free/Premium) or per-team (Exclusive) and applied during alert ingestion. Free users see an upgrade prompt instead of the configuration panel.

### Quarantine System

Alerts are automatically triaged based on threat score:

| Score | Action | What Happens |
|-------|--------|--------------|
| >= 0.9 | **Auto-block** | `is_blocked=True`, IP added to blacklist immediately |
| 0.7 – 0.9 | **Quarantine** | Held for human review before any action |
| < 0.7 | **Allow** | Logged normally, no intervention needed |

Quarantined alerts sit in a review queue. Users can:
- **Release** — mark as safe (false positive), alert stays logged
- **Block** — confirm the threat, sets score to 1.0, IP auto-added to blacklist

### Custom Detection Rules (Exclusive Only)

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

Rules run in **priority order** (highest first), first match wins. Each rule tracks how many times it has triggered. Rules can be tested against recent alerts before enabling.

### Blacklist & Whitelist

Every ingested alert's source IP is checked in this order:

1. **Whitelist** (highest priority) — if matched, `threat_score = 0`, all other checks skipped
2. **Blacklist** — if matched, `threat_score = 1.0`, alert marked as blocked
3. **ThreatFox** — if matched, IP auto-added to blacklist, alert marked as blocked
4. **Normal** — standard scoring applies

Each list supports three entry types:
- **IP** — exact match (e.g. `1.2.3.4`)
- **CIDR** — range match (e.g. `192.168.0.0/16`)
- **DOMAIN** — domain match

**Mutual exclusion**: adding an IP to the blacklist automatically removes it from the whitelist (and vice versa).

**Retroactive updates**: blocking or trusting an IP updates all existing alerts from that IP in the database immediately.

**Bulk CSV import** available for both lists.

**IDS Blacklist Export** (Premium/Exclusive only):
- **Suricata**: `.rules` file with `drop ip` rules, auto-generated SIDs
- **Snort**: `.txt` reputation list, one IP per line
- **Zeek**: `.intel` file in Intel framework format (`Intel::ADDR` indicators)

### Threat Intelligence Feed

Live feed of the latest IOCs (Indicators of Compromise) published on ThreatFox (abuse.ch).

- Browse recent IOCs (configurable: last 1–30 days)
- Search for specific IPs, domains, or hashes
- View malware family, threat type, confidence level, first seen date, tags, and reporter info
- **Server-side caching**: ThreatFox responses cached for 5 minutes — first load hits the API, subsequent loads are instant. Falls back to stale cache if ThreatFox is unreachable

### Subscription Lifecycle

- **Free tier** — always active, no subscription required
- **Premium / Exclusive** — requires an active subscription (1, 3, 6, or 12 months)
- Subscription starts immediately upon activation
- Subscription status is auto-refreshed on every login and API call
- When a subscription expires:
  - Dashboard is blocked (new signup screen or expiry screen depending on history)
  - Alert ingestion stops (API key returns 403)
  - Data is preserved — renewing restores access to all existing alerts and features
- For Exclusive teams, the team leader's subscription covers all members
- Users can renew via Settings → Account tab with a new duration selection

## API Endpoints

### Auth Service (`/api/auth/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register/` | Register new user (handles tier + team logic) |
| POST | `/login/` | Login with email/password, returns JWT tokens |
| POST | `/logout/` | Blacklist refresh token |
| POST | `/password-reset/request/` | Request password reset email |
| POST | `/password-reset/confirm/` | Confirm reset with token (body: `{uid, token, new_password}`) |
| GET | `/me/` | Get current user profile |
| PATCH | `/me/` | Update user profile |
| POST | `/change-password/` | Change password with current password verification |

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
| POST | `/upgrade/` | Upgrade subscription plan with duration |
| POST | `/renew/` | Renew an expired subscription |

### Admin (`/api/admin/`) — requires `is_superuser=True`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stats/` | Dashboard stats (users, revenue, subscriptions) |
| GET | `/users/` | List all users (search, filter, paginate) |
| GET | `/{id}/user_detail/` | Get detailed user info + subscription |
| POST | `/{id}/suspend/` | Suspend a user account |
| POST | `/{id}/unsuspend/` | Unsuspend a user account |
| POST | `/{id}/change_tier/` | Change user tier (handles team side effects) |
| POST | `/{id}/reset_password/` | Reset user password to temp password |
| GET | `/subscriptions/` | Subscription stats + ongoing list |
| GET | `/teams/` | List all teams with members |
| DELETE | `/{id}/delete_team/` | Delete a team and remove all members |
| POST | `/{id}/remove_member/` | Remove a member from a team |
| GET | `/audit_log/` | Audit log entries |

### Log Service — port 8001

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
| GET | `/api/team/stats` | Team alert stats (total, unassigned) |
| GET | `/api/ml-config` | Get ML configuration (Premium/Exclusive only) |
| PUT | `/api/ml-config` | Update ML configuration (Premium/Exclusive only) |
| GET | `/api/analytics/time-series` | Alert counts grouped by hour/day |
| GET | `/api/analytics/category-distribution` | Alert counts per category |
| GET | `/api/analytics/top-sources` | Top N source IPs by alert count |
| GET | `/api/analytics/severity-trends` | Severity breakdown over time |
| GET | `/api/analytics/geo-map` | Alert locations grouped by lat/lon/country |
| GET | `/api/sse/alerts?token=JWT` | SSE stream — pushes new alerts + stats (auth via query param) |
| POST | `/api/upload` | Upload IDS log file for offline analysis (stores in ingestion_logs) |
| GET | `/api/ingestion-logs` | List processed ingestion logs (filterable, paginated) |
| GET | `/api/ingestion-logs/batches` | List all upload batches for user |
| POST | `/api/ingestion-logs/{id}/block` | Block IP from ingestion log |
| POST | `/api/ingestion-logs/{id}/trust` | Trust IP from ingestion log |
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
| POST | `/api/chat` | DurianBot AI chat — accepts message + history, returns Groq response with tool execution |

## Data Models

### User (Auth Service)
- Extends Django AbstractUser
- Fields: `tier` (FREE/PREMIUM/EXCLUSIVE), `team` (FK to Team), `is_team_leader`, `is_superuser`, `subscription_status`, timestamps

### AuditLog (Auth Service)
- Fields: `id`, `user_id`, `user_email`, `action`, `details`, `ip_address`, `timestamp`
- Tracks: logins, registrations, suspensions, tier changes, password resets, team deletions, member removals

### Team (Auth Service)
- Fields: `id` (UUID), `name`, `pin` (unique, 6 chars), `created_by` (FK to User), `created_at`

### SubscriptionPlan (Auth Service)
- Fields: `id` (UUID), `name`, `price_monthly`, `price_yearly`, `features` (JSON)

### Subscription (Auth Service)
- Fields: `id` (UUID), `user` (FK), `plan` (FK), `status`, `start_date`, `duration_months`, `end_date` (computed), `auto_renew`

### Alert (Log Service)
- Fields: `id` (UUID), `severity`, `category`, `source_ip`, `destination_ip`, `source_port`, `destination_port`, `protocol`, `threat_score` (0.0–1.0), `ids_source`, `raw_data` (JSONB), `user_id`, `team_id`, `threat_intel` (JSONB), `flagged_by_threatfox`, `is_whitelisted`, `is_blocked`, `quarantine_status`, `quarantined_at`, `reviewed_by`, `review_notes`, `assigned_to`, `assigned_name`, `ml_confidence` (Float, nullable), `geo_latitude`, `geo_longitude`, `geo_country`, `detected_at`, `created_at`
- Indexes on `(source_ip, detected_at)` and `(ids_source, detected_at)`

### DismissedAlert (Log Service)
- Composite PK: `user_id` (BigInteger) + `alert_id` (UUID), `dismissed_at`

### IngestionLog (Log Service)
- Separate from alerts — stores processed entries from file uploads only
- Fields: same schema as Alert plus `batch_id` (UUID, groups entries from same upload) and `upload_filename`

### BlacklistEntry / WhitelistEntry (Log Service)
- Fields: `id` (UUID), `entry_type` (IP/DOMAIN/CIDR), `value`, `reason`, `added_by` (manual/threatfox/bulk_import/rule), `user_id`, `team_id`, `block_count`/`trust_count`, `created_at`

### Rule (Log Service)
- Fields: `id` (UUID), `name`, `description`, `rule_type` (RATE_LIMIT/CATEGORY_MATCH/FAILED_LOGIN), `conditions` (JSONB), `actions` (JSONB), `priority` (1–10), `enabled`, `trigger_count`, `user_id`, `team_id`, `created_at`

### MLConfig (Log Service)
- Fields: `id` (UUID), `user_id`, `team_id`, `model_type` (random_forest/isolation_forest/neural_network), `enabled`, `confidence_threshold`, `sensitivity`, `score_boost`, `created_at`, `updated_at`

### APIKey (Log Service)
- Fields: `id` (UUID), `key` (prefixed `dd_`), `label`, `user_id`, `team_id`, `tier`, `is_active`, `last_used_at`, `created_at`

### TeamActivity (Log Service)
- Fields: `id` (UUID), `user_id`, `user_name`, `team_id`, `action`, `details`, `created_at`

### Incident (Log Service)
- Fields: `id` (UUID), `title`, `description`, `status` (OPEN/IN_PROGRESS/RESOLVED/CLOSED), `priority` (CRITICAL/HIGH/MEDIUM/LOW), `created_by_id`, `created_by_name`, `user_id`, `team_id`, `created_at`, `updated_at`

### IncidentNote (Log Service)
- Fields: `id` (UUID), `incident_id` (FK), `content`, `author_id`, `author_name`, `created_at`

### IncidentAlert (Log Service)
- Join table: `incident_id` (UUID, PK) + `alert_id` (UUID, PK), `added_at`

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL (or a Supabase project)
- A root `.env` file (see Environment Variables below)

### 1. Auth Service (port 8000)

```bash
cd services/auth-service
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser   # optional — creates admin account
python manage.py runserver
```

### 2. Log Service (port 8001)

```bash
cd services/log-service
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8001
```

**Retrain ML models** (optional, required if model files are missing):
```bash
python -m app.ml.train_model
```

### 3. IDS Watcher (optional — for real-time monitoring)

```bash
cd services/ids-watcher
pip install -r requirements.txt
python watcher.py setup    # interactive config wizard
python watcher.py          # start watching (uses config.yaml)
```

### 4. Frontend (port 5173)

```bash
cd frontend
npm install
npm run dev
```

### Environment Variables

Root `.env` (shared by both services):

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (Supabase) |
| `JWT_SECRET_KEY` | Shared JWT signing key |
| `THREATFOX_AUTH_KEY` | Free API key from https://auth.abuse.ch/ |
| `GROQ_API_KEY` | Groq API key for DurianBot (llama-3.3-70b-versatile) |
| `BREVO_API_KEY` | Brevo API key for transactional email |
| `DEFAULT_FROM_EMAIL` | Sender address for password reset emails |
| `FRONTEND_URL` | Base URL used to build password reset links (default `http://localhost:5173`) |
| `CORS_ALLOWED_ORIGINS` | Frontend origin for CORS (default `http://localhost:5173`) |
| `AUTH_SERVICE_URL` | Auth service base URL (default `http://localhost:8000`) |
| `LOG_SERVICE_URL` | Log service base URL (default `http://localhost:8001`) |

Frontend `frontend/.env`:

| Variable | Description |
|----------|-------------|
| `VITE_AUTH_API_URL` | Auth service URL (default: `http://localhost:8000`) |
| `VITE_LOG_API_URL` | Log service URL (default: `http://localhost:8001`) |

## Deployment Architecture

DurianDetector is a cloud-hosted platform. The backend services and frontend are deployed online, while each client runs a lightweight IDS watcher on their own network.

```
YOUR CLOUD (deployed online)
┌─────────────────────────────────────┐
│  Vercel          → Frontend         │
│  Railway         → Auth Service     │
│  Railway         → Log Service      │
│  Supabase        → PostgreSQL       │
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

1. **Your platform** (auth-service, log-service, frontend) is deployed to the cloud and accessible via a public URL
2. **Each client** registers on your website, picks a subscription plan (1/3/6/12 months), and activates their subscription
3. The client generates an **API key** from Settings → API Keys
4. The client installs the **IDS watcher** on their own network — this is the only component that runs on the client side
5. The watcher reads alerts from their local IDS (Suricata, Snort, Zeek, Kismet) and pushes them over HTTPS to the cloud log-service using the API key
6. Alerts are stored in the database, scoped to that client's user/team — no other client can see them
7. The client logs into the dashboard from any browser to view their alerts, analytics, incidents, etc.

### Client Setup (After Registration)

**Step 1 — Generate an API key**

Settings → API Keys → Generate. Copy the key (shown only once).

**Step 2 — Install the IDS watcher**

```bash
git clone <watcher-repo>
cd ids-watcher
pip install -r requirements.txt
```

**Step 3 — Run the setup wizard**

```bash
python watcher.py setup
```

The wizard prompts for API URL and key, lets you select IDS engines (comma-separated), auto-detects common log paths, and generates `config.yaml`.

**Step 4 — Start the watcher**

```bash
python watcher.py
```

Alerts appear on the dashboard in real time via SSE.

### Multiple Clients on One Machine

```bash
python watcher.py --config config-client-abc.yaml
python watcher.py --config config-client-def.yaml
```

Each config uses a different API key — alerts are routed to the correct client's dashboard.

## Design

- Dark theme (`#0a0e1a` background)
- Blue primary (`#3B82F6`), green success, yellow warning, red danger
- Severity colors: Critical (red), High (orange), Medium (yellow), Low (gray)
- Tier badge colors: Free (gray), Premium (blue), Exclusive (purple)
- Admin theme: red accent (`#EF4444`), darker background (`#0d1117`), red-tinted borders
- Responsive: mobile sidebar collapse, adaptive grid layouts
- Glass-morphism cards with subtle borders and hover effects
- Collapsible sidebar sections (Overview, Detection, Intelligence, Policies, Workspace) — auto-opens section containing current page
- Live alert feed with fade-in animations and pulsing connection indicator

## Development Log

### March 29 — Project Init
- Created GitHub repository

### March 31 — Core App Build
- Scaffolded React + Vite frontend with landing page, login/signup pages, 3D globe component
- Built Django REST auth service with JWT auth, user model, subscription tiers (FREE/PREMIUM/EXCLUSIVE)
- Implemented full signup flow, protected routes, dashboard layout with sidebar/navbar
- Added placeholder pages for Alerts, Incidents, Settings, Teams
- Built team management for Exclusive tier — team creation, leader role, PIN-based invite system

### April 1 — Log Ingestion, Threat Intelligence, Blacklist/Whitelist, Quarantine, Rules, Team Assignment
- Created FastAPI log ingestion microservice at `services/log-service/` (port 8001)
- Implemented multi-IDS alert normalisation — Suricata, Zeek, Snort, Kismet to unified schema
- Added automatic threat scoring (0.0–1.0) based on severity + category weights
- Async PostgreSQL storage to Supabase via SQLAlchemy + asyncpg
- Integrated ThreatFox API for automatic IP reputation checking on every ingested alert
- Built Threat Intel page — live feed of latest IOCs from ThreatFox with search and time range filter
- Built blacklist/whitelist system with priority-based ingestion logic
- Auto-blacklist: IPs flagged by ThreatFox added to blacklist automatically
- CIDR range support and bulk CSV import for both lists
- Quick actions on Alerts page: Block IP / Trust IP buttons per alert
- Built quarantine system — alerts scoring 0.7–0.9 held for review, 0.9+ auto-blocked
- Implemented Exclusive team workspace — all team members share alerts, blacklists, whitelists, quarantine
- Added `tier` and `team_id` to JWT tokens for team-scoped queries
- Built custom rule engine with 3 rule types (Rate Limit, Category Match, Failed Login)
- Rule builder UI with condition/action config, priority, enable/disable toggle, test endpoint
- Built alert assignment system — Exclusive team members can assign alerts to each other
- Team activity feed — logs who assigned what and when
- Created test script sending 10 mock alerts across all IDS formats

### April 2 — ML Threat Detection, Analytics, Attack Map
- Built ML threat detection pipeline with 3 selectable models: Random Forest, Isolation Forest, Neural Network
- Synthetic training data generator — 1000 samples (500 benign, 500 malicious), 7 features
- Integrated ML prediction into ingestion pipeline — every non-whitelisted alert gets `ml_confidence` score
- ML-enhanced scoring: confidence > 0.8 boosts threat_score by +0.2
- Built ML Configuration page — tier-gated to Premium/Exclusive, model selection + sliders
- Built Analytics dashboard with 4 interactive Recharts (time series, pie, bar, stacked bar)
- Per-chart customisation: chart type, date range, color palette; global severity + category filters
- Export charts as PNG; export all 4 as landscape A4 PDF
- Built Attack Map using Leaflet + react-leaflet with CARTO dark tiles
- GeoIP lookup utility — ip-api.com with 24h in-memory cache, private IP skip
- Circle markers sized by alert count, color-coded by threat score; click popups; stats bar

### April 3 — Admin Panel, SSE Real-Time Alerts, Dashboard Overhaul
- Built full admin dashboard — Admin Dashboard, User Management, Team Management, Subscription Management, Audit Logs, System Monitoring
- Admin identified by Django's built-in `is_superuser` flag — no extra model field needed
- Created `AuditLog` model — tracks admin and user actions with IP address
- Built admin API endpoints at `/api/admin/` — all protected by `IsAdminPermission`
- Built red-themed admin frontend: AdminSidebar, AdminLayout with superuser guard
- Implemented tier change side effects (shared via `team_utils.py`)
- Built Server-Sent Events (SSE) real-time alert streaming
- Created SSE endpoint — polls new alerts every 2 seconds, stats every 10 seconds, heartbeat every 30 seconds
- Created `useAlertNotifications` hook — toast notifications for HIGH/CRITICAL, browser desktop notifications for CRITICAL
- Rewrote Dashboard with live SSE data, replaced all mock data
- Moved SSE to global `SSEContext` provider — connection persists across all pages, resets on user change
- Added Block IP / Trust IP action buttons to live alert feed
- Added alert detail modal to Alerts page with full overview, ML, GeoIP, ThreatFox data
- Added "Block All Critical" mass action, date range filter, and assignment filter on Alerts page
- Fixed blacklist/whitelist mutual exclusion and retroactive alert updates
- Made GeoIP Attack Map accessible to all tiers
- Added IDS blacklist export (Premium/Exclusive) — Suricata, Snort, Zeek formats

### April 4 — Landing Page, Self-Service Tier Changes, Change Password
- Rewrote landing page to showcase 4 IDS sources with color-coded cards and hover effects
- Built self-service tier upgrade/downgrade from Settings → Account tab
- Tier change triggers team side effects (Exclusive auto-creates/dissolves team)
- Confirmation dialog before tier change; `refreshUser()` updates UI immediately
- Built change password feature with current password verification and audit logging

### April 5 — Ingestion Logs, IDS Watcher, Incidents, API Keys, SSE Dismissals
- Built Ingestion Logs page — file upload for offline analysis, separate `ingestion_logs` table
- File upload endpoint runs full processing pipeline; batch tracking with `batch_id`
- Built IDS Watcher service (`services/ids-watcher/`) — async file tailers for all 4 IDS engines
- API key authentication for machine-to-machine access (`dd_` prefixed, never expires)
- Auth layer accepts JWT Bearer or `X-API-Key` header
- Collapsible sidebar sections (Overview, Detection, Intelligence, Policies, Workspace)
- Built full Incidents system — Incident, IncidentAlert, IncidentNote models + frontend page
- Built API Keys management UI in Settings
- Fixed SSE dismiss persistence — `dismissed_alerts` join table, initial load excludes dismissed
- Analytics PDF export — all 4 charts in landscape A4 with title and timestamp (jsPDF)
- ThreatFox 5-minute server-side cache with stale fallback

### April 6 — Subscription Lifecycle
- Built duration-based subscription system — 1, 3, 6, or 12-month durations
- Subscription status auto-refreshed on login and every API call
- Dashboard block screens for new signups (activate) vs expired users (renew) with inline duration picker
- `require_active_subscription` dependency in log-service — gates ingestion, returns 403 for expired users
- API key authentication also blocked when subscription is expired
- Built upgrade modal and renewal modal with duration selection and price summary
- Added `POST /api/subscriptions/renew/` endpoint
- Landing page fixes: "Get Started Free" CTA now links to signup

### April 7 — Password Reset via Email
- Wired Django email delivery via Brevo API (Railway blocks standard SMTP ports)
- `POST /api/auth/password-reset/request/` — generates uid + token, sends reset link, always returns 200 to prevent email enumeration
- `POST /api/auth/password-reset/confirm/` — validates token (3-day expiry), enforces 8+ char min, calls `set_password()`
- Frontend: `ForgotPassword.jsx` and `ResetPassword.jsx` pages; "Forgot password?" link on Login page

### April 6 — DurianBot AI Chatbot
- Built DurianBot powered by Google Gemini (free tier) with context gathering and function calling
- 7 tools: `get_stats`, `get_alerts`, `block_ip`, `trust_ip`, `create_incident`, `get_blacklist`, `get_whitelist`
- Read tools execute immediately; write tools require user confirmation
- Tier gating: Free users limited to 5 messages per session; Premium/Exclusive unlimited
- Markdown rendering, suggestion chips, action badges on destructive tool messages

### April 9 — Watcher Setup Wizard, IDS Setup Guide
- Built interactive CLI setup wizard (`python watcher.py setup`) — prompts for API URL/key, IDS selection, auto-detects log paths, generates `config.yaml`
- Added IDS Watcher Setup tab to Settings page with quick start commands, collapsible installation guides, configuration snippets, and troubleshooting tips
- Created comprehensive IDS Setup Guide (`services/ids-watcher/IDS_SETUP_GUIDE.md`) for all 4 engines on Ubuntu/Debian and CentOS/Fedora
- Added IDS watcher connection nudge banner on Dashboard — shown to users with no active API keys, links to Settings → IDS Watcher tab, dismissible

### April 12 — DurianBot Groq Migration, Team Assignment, Cleanup
- Migrated DurianBot from Google Gemini to Groq (`llama-3.3-70b-versatile`) for improved reliability and function calling support
- Added `block_all_quarantined` write tool to DurianBot — mass blocks all quarantined IPs
- Added Assign button to the live alert feed for team leaders — inline member dropdown, assigns via `PATCH /api/team/alerts/{id}/assign`
- Removed Alerts per Member card from Team view — team stats now show Total Alerts and Unassigned only
- Removed Engine Comparison feature entirely — frontend page, backend routes, sidebar nav
