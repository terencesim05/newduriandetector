# DurianDetector

A multi-tenant threat detection and aggregation platform. DurianDetector sits **above** existing intrusion detection systems — Suricata, Zeek, Snort, and Kismet — and unifies their output into a single dashboard with real-time streaming, ML-assisted scoring, threat intelligence enrichment, GeoIP mapping, team collaboration, and an AI assistant.

It is the *analysis and response layer*, not a packet inspector. Customers point their existing IDS at a lightweight watcher; the watcher ships alerts to the cloud over HTTPS; the dashboard does the rest.

---

## Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Tiers & Multi-Tenancy](#tiers--multi-tenancy)
- [Features](#features)
- [Ingestion Pipeline](#ingestion-pipeline)
- [ML Threat Detection](#ml-threat-detection)
- [Real-Time Streaming](#real-time-streaming-sse)
- [IDS Watcher](#ids-watcher)
- [Admin Panel](#admin-panel)
- [API Reference](#api-reference)
- [Data Models](#data-models)
- [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)

---

## Overview

**Problem.** Open-source IDS engines each speak their own format — Suricata writes EVE JSON, Zeek writes tab-separated `notice.log`, Snort writes JSON, Kismet exposes a REST API. Each one only sees what its sensors see, with no normalisation, no GeoIP, no threat-intel enrichment, no collaboration, and no historical analytics out of the box.

**Solution.** DurianDetector ingests from all four engines into one schema, scores every alert against a rule-based formula plus a trained ML model, enriches with ThreatFox (abuse.ch) intel and ip-api.com GeoIP, persists to Postgres, and streams new alerts to the browser in under two seconds via Server-Sent Events.

**Who it is for.** Small security teams who already run at least one IDS engine and want a unified dashboard, automated triage, and team workflows without standing up an enterprise SIEM.

---

## Architecture

Three deployed services plus a client-side watcher:

```
                ┌──────────────────────────────────────────────┐
                │                    CLOUD                     │
                │                                              │
                │   Frontend (Vercel)                          │
                │      React 19 + Vite                         │
                │           │                                  │
                │           ▼                                  │
                │   ┌─────────────────┐   ┌─────────────────┐  │
                │   │  Auth Service   │   │   Log Service   │  │
                │   │  (Django REST)  │   │    (FastAPI)    │  │
                │   │   port 8000     │   │   port 8001     │  │
                │   │ JWT · users ·   │   │ ingestion · ML  │  │
                │   │ teams · subs    │   │ analytics · SSE │  │
                │   └────────┬────────┘   └────────┬────────┘  │
                │            │                     │           │
                │            └──────────┬──────────┘           │
                │                       ▼                      │
                │            ┌──────────────────────┐          │
                │            │  PostgreSQL (Supabase)│         │
                │            └──────────────────────┘          │
                └──────────────────────────────────────────────┘
                                  ▲           ▲
                                  │ HTTPS     │ HTTPS
                                  │ (api key) │ (api key)
                  ┌───────────────┴──┐   ┌────┴──────────────┐
                  │  Client A site   │   │  Client B site    │
                  │  Suricata/Snort  │   │  Zeek/Kismet      │
                  │       ↓          │   │       ↓           │
                  │   ids-watcher    │   │   ids-watcher     │
                  └──────────────────┘   └───────────────────┘
```

| Component | Where it runs | Role |
|-----------|---------------|------|
| `frontend/` | Vercel | React SPA — dashboard, analytics, admin |
| `services/auth-service/` | Railway | Django + DRF — users, JWT, teams, subscriptions, audit logs, password reset email |
| `services/log-service/` | Railway | FastAPI — ingestion, alerts, analytics, ML, SSE, ThreatFox, GeoIP, DurianBot |
| `services/ids-watcher/` | Customer network | Python async tailer — pushes IDS output to the cloud over HTTPS using an API key |
| Database | Supabase | PostgreSQL — shared by both backend services |

### Project Structure

```
newduriandetector/
├── frontend/                       # React 19 + Vite + Tailwind v4
│   └── src/
│       ├── components/             # Sidebar, Navbar, LiveAlertFeed, ConnectionStatus, AdminSidebar
│       ├── config/                 # API base URLs
│       ├── context/                # AuthContext, SSEContext
│       ├── layouts/                # DashboardLayout, AdminLayout (auth guards)
│       ├── hooks/                  # useAlertNotifications
│       ├── services/               # authService, adminService, alertService
│       └── pages/                  # 20 user pages + 6 admin pages
└── services/
    ├── auth-service/               # Django 5 + DRF + SimpleJWT
    │   ├── users/                  # User, AuditLog, auth + admin endpoints
    │   ├── teams/                  # Team model + PIN invite system
    │   └── subscriptions/          # Plans + duration-based subscriptions
    ├── log-service/                # FastAPI + SQLAlchemy 2 (async)
    │   ├── models/                 # Trained ML pickles
    │   └── app/
    │       ├── models/             # Alert, IngestionLog, Incident, BlacklistEntry, …
    │       ├── schemas/            # Pydantic v2 validators
    │       ├── routes/             # 18 route modules
    │       ├── services/           # IDS normaliser, threat scorer
    │       ├── ml/                 # UNSW-NB15 loader, trainer, predictor
    │       └── utils/              # ThreatFox, GeoIP, rule engine, tenant scoping
    └── ids-watcher/                # Async file tailers + Kismet REST poller
        ├── watcher.py              # Main entrypoint with `setup` wizard
        ├── config.yaml             # Per-engine enable, log paths, API key
        └── IDS_SETUP_GUIDE.md      # Install + configure each IDS on Linux
```

---

## Tech Stack

**Frontend.** React 19, Vite, Tailwind CSS v4, React Router v7, Axios, Lucide React. Recharts for analytics, Leaflet + react-leaflet for the attack map, Three.js + React Three Fiber for the landing-page globe, jsPDF + html2canvas for PDF export, react-hot-toast for in-app notifications.

**Backend.** Django 5 + Django REST Framework with SimpleJWT for the auth service; FastAPI + SQLAlchemy 2 (async + asyncpg) + Pydantic v2 for the log service.

**Data.** PostgreSQL on Supabase, shared by both services.

**ML.** scikit-learn — Random Forest, Isolation Forest, MLP Neural Network. Trained on UNSW-NB15.

**Integrations.** ThreatFox (abuse.ch) for IOC enrichment, ip-api.com for GeoIP, Groq (`llama-3.3-70b-versatile`) for the AI assistant, Brevo for transactional email.

**Real-time.** Server-Sent Events over plain HTTP with JWT in the query string (EventSource cannot send custom headers).

---

## Tiers & Multi-Tenancy

| Feature | Free ($0) | Premium ($49/mo) | Exclusive ($199/mo) |
|---------|:---------:|:----------------:|:-------------------:|
| Real-time alert monitoring | ✓ | ✓ | ✓ |
| Dashboard + live SSE feed | ✓ | ✓ | ✓ |
| GeoIP attack map | ✓ | ✓ | ✓ |
| Threat intelligence feed | ✓ | ✓ | ✓ |
| DurianBot (AI assistant) | 5 msgs/session, read-only | unlimited, all tools | unlimited, all tools |
| Full alert history + filters | — | ✓ | ✓ |
| Analytics dashboard + PDF export | — | ✓ | ✓ |
| Quarantine review | — | ✓ | ✓ |
| Blacklist / whitelist + IDS export | — | ✓ | ✓ |
| Incident management | — | ✓ | ✓ |
| Ingestion log upload | — | ✓ | ✓ |
| ML configuration | — | ✓ | ✓ |
| Engine comparison view | — | ✓ | ✓ |
| Custom detection rules | — | — | ✓ |
| Team workspace (1 leader + 4 members) | — | — | ✓ |
| Alert assignment + team activity feed | — | — | ✓ |

### Data scoping

| Tier | Scoped by | Effect |
|------|-----------|--------|
| Free / Premium | `user_id` | each user sees only their own alerts, lists, incidents, rules |
| Exclusive | `team_id` | all team members see and act on the same data |

The JWT issued at login carries `tier` and `team_id`. Every query in the log service uses these claims to filter — there is no path by which one tenant can see another's data.

### Exclusive teams

- The first Exclusive user creates a team automatically on signup and becomes the leader.
- The team gets a 6-character alphanumeric **PIN** (e.g. `A7X42K`).
- Up to four members join by entering the PIN at signup (the cap is enforced server-side).
- Leaders can copy or regenerate the PIN, remove members, and assign alerts.
- The leader's subscription covers the whole team.

### Tier change side effects

These apply equally to admin-initiated changes and to self-service tier changes from Settings:

- **Upgrade to Exclusive** → team auto-created, user becomes leader with a fresh PIN.
- **Downgrade leader from Exclusive** → team dissolved, all members kicked back to their previous tier.
- **Downgrade member from Exclusive** → removed from team.

---

## Features

### Authentication

JWT auth with short-lived access tokens (~30 min) and long-lived refresh tokens. Axios interceptor refreshes the access token one minute before expiry. Refresh tokens are blacklisted on logout. Password reset is via Brevo SMTP (Railway blocks raw SMTP, so we use the Brevo HTTP API) with a 3-day token expiry. Change-password requires the current password and is audit-logged.

### Dashboard

A first-name greeting, four live stats (Total, Critical, Today, Blocked) refreshed every 10 seconds via SSE, the last 10 alerts streaming in with fade-in animation, and a green/red connection indicator. Exclusive users also see a *My Assignments* widget. Users with no active API key see a dismissible amber banner pointing to **Settings → IDS Watcher**.

### Alerts

Full alert history with severity / category / date-range / ML-flagged filters, IP and category search, and a detail modal showing GeoIP, ThreatFox intel, ML confidence with interpretation, raw IDS payload, and timeline. Per-row **Block IP** and **Trust IP** actions update the database and propagate to all existing alerts from that IP. **Block All Critical** mass-blocks every critical IP on the current page. Exclusive users get an **Assigned to me** filter and a per-alert assignment dropdown; assigned members appear as a badge.

### Analytics

Four interactive Recharts — alerts over time (line), category distribution (pie), top source IPs (bar), severity trends (stacked bar). Each chart has inline controls for chart type, time period (24h / 7d / 30d / 90d), and colour palette. Global risk-level and attack-type filters apply across all four. Per-chart **Save image** (PNG) and a global **Export as PDF** that lays out all four charts on a landscape A4 page with title and timestamp (jsPDF + html2canvas).

### Attack Map

2D Leaflet map on CARTO dark tiles with country borders from Natural Earth 50m TopoJSON. Source IPs are geolocated via ip-api.com (24h in-memory cache, private ranges skipped). Markers are sized by alert count and coloured by average threat score (blue < 0.4, yellow 0.4–0.7, red > 0.7). Click for country / count / score. Date range filter, stats bar (total geolocated, unique countries, high-threat sites). Available on all tiers.

### Quarantine

Alerts scoring 0.7–0.9 sit in a review queue. Operators can **release** (false positive — keep the alert, do nothing) or **block** (confirm threat — score becomes 1.0, IP goes to blacklist, all historic alerts from that IP are marked blocked).

### Blacklist & Whitelist

Each list supports IP, CIDR, and domain entries. Lookups happen in order: whitelist (score = 0, stop), blacklist (score = 1.0, blocked), then ThreatFox check (auto-blacklisted if flagged). Mutual exclusion is enforced — adding to one list removes from the other. Bulk CSV import is available on both. Premium and Exclusive users can export the blacklist to native IDS formats:

| Format | Output |
|--------|--------|
| Suricata | `.rules` with `drop ip` rules and auto-generated SIDs |
| Snort | `.txt` reputation list (one IP per line) |
| Zeek | `.intel` file with `Intel::ADDR` indicators |

### Custom Detection Rules (Exclusive)

| Rule type | Triggers when… | Example |
|-----------|---------------|---------|
| Rate Limit | same IP exceeds N alerts in a window | >5 SQL_INJECTION from the same IP in 5 min |
| Category Match | a category + severity combo lands | any CRITICAL MALWARE alert |
| Failed Login | brute-force pattern from one IP | >10 BRUTE_FORCE in 10 min |

Each rule defines an action set — quarantine, auto-block, boost threat score, notify admin. Rules run in priority order (highest first), first match wins. Each rule tracks its trigger count. **Test against recent alerts** before enabling.

### Incidents

Human-created cases that group related alerts. Each incident has a title, priority (Critical / High / Medium / Low), description, status (Open → In Progress → Resolved → Closed), and a notes timeline with author and timestamp. Alerts are linked by ID and can be unlinked. Filterable by status and priority, searchable by title, server-side paginated, deletable with confirmation. Tenant-scoped like everything else.

### Ingestion Logs

Separate page and separate database table from real-time alerts. Users upload IDS log files for offline analysis. Each upload gets a `batch_id` so all entries from one file can be filtered together. The same pipeline runs (threat scoring → whitelist → blacklist → ThreatFox → GeoIP → ML → rules → quarantine). Per-row block / trust / release actions. Detail modal mirrors the Alerts page. Server-side paginated.

### Engine Comparison (Premium / Exclusive)

Cross-engine correlation view. For a chosen time window (5 min / 1 hour / 24 hours / 7 days), it finds source IPs flagged by ≥ N engines (2, 3, or all 4) — high-confidence threats because multiple independent detectors agreed. Useful for tuning rules and validating coverage.

### DurianBot (AI Security Assistant)

Conversational interface backed by Groq's `llama-3.3-70b-versatile` with function calling. Eight tools:

| Tool | Type | Purpose |
|------|:----:|---------|
| `get_stats` | read | totals, severity breakdown, top categories, top source IPs |
| `get_alerts` | read | recent alerts (severity / category filters, up to 10) |
| `get_blacklist` | read | last 20 blocked IPs |
| `get_whitelist` | read | last 20 trusted IPs |
| `block_ip` | write | blacklist an IP, remove from whitelist, mark historic alerts blocked |
| `trust_ip` | write | whitelist an IP, remove from blacklist |
| `create_incident` | write | open an incident with title / description / priority |
| `block_all_quarantined` | write | bulk-block every quarantined IP |

Read tools run immediately. Write tools are confirmation-gated — the bot asks before acting and a green **Action: …** badge appears once the action commits. The last 8 messages are kept for multi-turn context. Markdown rendering (bold, code blocks, headings, bullet points) and suggestion chips on first load.

**Tier gating.** Free users get read-only tools and a 5-message per-session cap with a visible countdown; write tools 403 server-side with an upgrade prompt. Premium and Exclusive users get unlimited messages and all tools.

### Settings

| Tab | Contents |
|-----|----------|
| Profile | Edit first / last name; email is read-only |
| Account | Side-by-side plan comparison with upgrade / downgrade buttons; current subscription panel; duration picker (1 / 3 / 6 / 12 months) with price summary |
| Security | Change password with current-password check, 8-char minimum, show / hide toggles |
| API Keys | Generate a new key (full key shown **once**, copy button); table of existing keys with label / preview / last used / status; revoke action |
| IDS Watcher | Quick start commands and collapsible install guides for Suricata, Snort 3, Zeek, and Kismet, each with copy-to-clipboard CLI commands, config snippets, default log paths, and troubleshooting |

### Subscription Lifecycle

- Free is always active; no subscription record needed.
- Premium and Exclusive require an active subscription with a duration of 1, 3, 6, or 12 months.
- Subscriptions activate immediately on purchase and the end date is computed from the duration.
- Status is re-evaluated on every login and every API call.
- On expiry: the dashboard shows a renewal / activation screen (depending on history), ingestion returns 403 for both JWT and API-key auth, and the database is preserved. Renewing restores access to all historical data.

---

## Ingestion Pipeline

Every alert — whether it arrives in real time from the watcher or from a batch file upload — goes through this pipeline:

```
IDS source (Suricata / Zeek / Snort / Kismet)
        │
        ▼
Normaliser            unified schema (severity, category, ports, protocol, …)
        │
        ▼
Base threat score     score = 0.6 × severity_weight + 0.4 × category_weight
        │
        ▼
Whitelist check       match? → score = 0, skip the rest
        │
        ▼
Blacklist check       match? → score = 1.0, is_blocked = true
        │
        ▼
ThreatFox lookup      match? → score boosted to 0.9–1.0 (by confidence),
                                 IP auto-added to blacklist
        │
        ▼
GeoIP lookup          lat / lon / country via ip-api.com (24h cache, private IPs skipped)
        │
        ▼
ML prediction         confidence ∈ [0, 1]; if ≥ sensitivity, add score_boost
        │
        ▼
Rule engine           rules evaluated in priority order, first match wins
        │
        ▼
Quarantine triage     score ≥ 0.9  → auto-block (IP blacklisted)
                      0.7 – 0.9    → quarantine for human review
                      < 0.7        → log only
        │
        ▼
Persist to PostgreSQL (alerts or ingestion_logs)
        │
        ▼
SSE pushes new alert to connected clients within ~2 seconds
```

### Threat Scoring

| Severity | Weight |   | Category | Weight |
|----------|:------:|---|----------|:------:|
| LOW | 0.10 |  | SQL_INJECTION | 0.85 |
| MEDIUM | 0.30 |  | COMMAND_INJECTION | 0.85 |
| HIGH | 0.60 |  | PRIVILEGE_ESCALATION | 0.80 |
| CRITICAL | 0.90 |  | MALWARE | 0.75 |

Formula: `score = 0.6 × severity_weight + 0.4 × category_weight`. The whitelist, blacklist, ThreatFox, and ML layers then adjust this base score. If ThreatFox flags an IP, the score is overridden to 0.9–1.0 depending on the IOC confidence.

---

## ML Threat Detection

A second, learned opinion on top of the rule-based score. The chosen model returns a confidence in `[0, 1]`; if it exceeds the user's **sensitivity** threshold, the rule-based score gets a **score boost** — which can promote an alert past the 0.7 quarantine or 0.9 auto-block line.

### Models

| Model | Type | Notes |
|-------|------|-------|
| Random Forest | supervised, ensemble of 100 trees | fast, interpretable, default |
| Isolation Forest | unsupervised, anomaly | trained on benign only — meant for novel patterns |
| Neural Network | supervised MLP 64→32 | learns non-linear feature combinations |

### Features (7)

| Feature | Encoding |
|---------|----------|
| `severity` | LOW=1, MEDIUM=2, HIGH=3, CRITICAL=4 |
| `category` | OTHER=1 … SQL_INJECTION / COMMAND_INJECTION=10 |
| `source_port` | raw integer |
| `destination_port` | raw integer |
| `protocol` | TCP=1, UDP=2, ICMP=3, OTHER=0 |
| `flagged_by_threatfox` | 0 / 1 |
| `ids_source` | suricata=1, zeek=2, snort=3, kismet=4 |

### Training data — UNSW-NB15

Models train on the **UNSW-NB15** dataset (UNSW Canberra; Moustafa & Slay, 2015) — 175,341 labelled flows across nine attack families (Generic, Exploits, Fuzzers, DoS, Reconnaissance, Analysis, Backdoor, Shellcode, Worms) and benign Normal traffic. `app/ml/load_real_data.py` downloads the dataset on first training run (~30 MB from the public GitHub mirror) and caches it locally.

UNSW-NB15 columns map onto the 7-feature schema:

| UNSW-NB15 | DurianDetector feature | Mapping |
|-----------|------------------------|---------|
| `proto` | `protocol` | tcp→1, udp→2, icmp→3, other→0 |
| `service` | `destination_port` | http→80, ssh→22, dns→53, smtp→25, ftp→21, ssl→443, … |
| `attack_cat` | `category` + `severity` | see table below |
| `label` | `is_threat` | 0=benign, 1=malicious |

| UNSW-NB15 attack_cat | category | severity |
|----------------------|----------|----------|
| Normal | OTHER | LOW |
| Fuzzers, Analysis | ANOMALY | MEDIUM |
| Reconnaissance | PORT_SCAN | MEDIUM |
| DoS | DDOS | CRITICAL |
| Exploits | PRIVILEGE_ESCALATION | CRITICAL |
| Generic, Backdoor, Worms | MALWARE | HIGH / CRITICAL |
| Shellcode | COMMAND_INJECTION | CRITICAL |

`source_port` is synthesised as an ephemeral port (1024–65535). `flagged_by_threatfox` is set to 0 for training (UNSW-NB15 predates the feed). `ids_source` is distributed uniformly across the four engines.

Training balances the dataset to 112,000 rows (56k benign / 56k malicious). The supervised models train on an 80/20 stratified split; Isolation Forest trains on benign samples only.

### Test-set accuracy (22,400 held out, 80/20 stratified)

| Model | Accuracy |
|-------|:--------:|
| Random Forest | 1.00 |
| Neural Network | 0.98 |
| Isolation Forest | 0.58 |

**Why Random Forest looks near-perfect.** The rule-based `category` normaliser already encodes most of the attack-type signal, so on this feature schema a supervised model is largely learning to read the category label. The ML layer's contribution is to combine all seven features into one calibrated confidence number, not to discover new threat types.

**Why Isolation Forest underperforms.** Anomaly detection on mostly-categorical features is a hard fit — Isolation Forest is included as a *zero-day-style* option rather than for headline accuracy.

### Retraining

```bash
cd services/log-service
python -m app.ml.train_model
```

First run downloads `unsw_nb15_raw.csv` (~30 MB) into `services/log-service/models/` (gitignored). Subsequent runs reuse the cache.

### ML Configuration (Premium / Exclusive)

| Setting | Range | Default | Effect |
|---------|-------|:-------:|--------|
| Model Type | RF / IF / NN | RF | which pickle the predictor loads |
| Enabled | on / off | on | master toggle |
| Sensitivity | 0.50 – 0.95 | 0.80 | minimum ML confidence to trigger a score boost |
| Score Boost | +0.05 – +0.50 | +0.20 | how much to add when triggered |
| Confidence Threshold | 0.30 – 0.90 | 0.70 | minimum confidence to display the *ML-flagged* badge |

Free users see an upgrade prompt; defaults still apply behind the scenes.

### Graceful degradation

If the selected model's pickle is missing, the predictor falls back to `threat_model.pkl` (legacy Random Forest). If no pickles exist, ML predictions are skipped silently and `ml_confidence` stays null — ingestion still works.

### Limitations

- **Schema is alert-level, not flow-level.** UNSW-NB15 has 40+ flow features (packet counts, byte rates, TCP flag ratios) that the dashboard schema does not carry. A flow-aware schema would likely improve Isolation Forest, but would also require Suricata flow logs at inference time.
- **Binary output only.** Models predict threat / not-threat; attack type classification remains rule-based.
- **No automated retraining** — models are static after training.

---

## Real-Time Streaming (SSE)

The dashboard subscribes to `GET /api/sse/alerts?token=JWT`. We use SSE rather than WebSockets because alerts are one-way server-to-client; SSE survives proxies that strip WebSocket upgrades, auto-reconnects in the browser, and is trivially scoped per user.

- **JWT goes in the query string** because `EventSource` cannot send custom headers.
- **Polling cadence:** new alerts every 2 seconds, stats every 10 seconds, heartbeat every 30 seconds (to keep the connection through any idle-timeout proxies).
- **Initial load.** On mount, the frontend fetches the last 10 alerts via REST so the feed is populated immediately; SSE then appends new ones.
- **Global context.** `SSEContext` owns the connection at the layout level — switching pages does *not* reconnect. Logout / login fully resets the context so account switches don't show stale data.
- **Auto-reconnect** with exponential backoff (1s → 2s → 4s → 8s → 16s).
- **Dismissals persist.** Dismissed alerts are stored in a `dismissed_alerts` join table so refreshing the page does not reintroduce them; the SSE stream and the REST initial load both exclude dismissed alerts.
- **Per-alert actions in the feed.** Block IP, Trust IP, assign (Exclusive leaders), dismiss one, dismiss all.

### Notifications

- **In-app toast** (react-hot-toast) for HIGH and CRITICAL alerts, bottom-right, auto-dismiss after 5 s.
- **Browser desktop notification** for CRITICAL alerts (after the user grants permission on dashboard mount), clicking the notification focuses the window.
- Only fires for alerts arriving *after* connection — no notification spam on first page load.

---

## IDS Watcher

`services/ids-watcher/` — a small async Python service that runs on the customer's network and ships alerts to the cloud log service.

| Engine | How we read it | Format |
|--------|----------------|--------|
| Suricata | file tail | EVE JSON, filtered to `event_type: "alert"` |
| Zeek | file tail | tab-separated `notice.log` with `#fields` header |
| Snort | file tail | JSON alerts, one per line |
| Kismet | REST poll | `/alerts/last-time/` endpoint |

### Setup

```bash
git clone <repo>
cd services/ids-watcher
pip install -r requirements.txt
python watcher.py setup       # interactive: API URL + key, IDS picks, auto-detect log paths
python watcher.py             # start
```

The wizard auto-detects standard install paths for each engine and writes `config.yaml`. To run a second watcher for a second tenant on the same machine:

```bash
python watcher.py --config config-client-abc.yaml
python watcher.py --config config-client-def.yaml
```

### Properties

- **Tail from end** — only new lines are shipped; no replay of historical log files.
- **Batched POSTs** — default 50 alerts or 5 seconds, whichever first; reduces request overhead at high rates.
- **Auto-wait** — if a log file does not exist yet (engine not started), the watcher waits rather than crashing.
- **API-key auth** — keys are `dd_`-prefixed, never expire, revocable. The watcher does not need an interactive login; it runs 24/7.
- **All four engines can run concurrently** out of one process.

DurianDetector itself does **not** perform packet inspection — the watcher's job is to forward what the IDS already detected.

---

## Admin Panel

Separate red-themed admin interface for platform operators. Admins are identified by Django's `is_superuser` flag — no extra model field. Superusers log in via the same `/login` page and are redirected to `/admin`.

| Page | Contents |
|------|----------|
| Admin Dashboard | 4 stat cards (users, active subs, monthly revenue, alerts today), tier breakdown bars, recent audit log |
| User Management | Searchable / filterable / paginated table (50 per page). Per user: View, Suspend / Unsuspend, Change Tier, Reset Password — all confirmation-gated. Superuser accounts are hidden from the list and from stats |
| Team Management | All teams with name, PIN (copy), member count, created date; expandable to show members with role badges; delete team, remove member |
| Subscription Management | Revenue calculated as (Premium count × $49) + (Exclusive *team* count × $199); breakdown cards; ongoing subscriptions table |
| Audit Logs | Timestamp, action badge, user, details, IP; filter by action type or *My actions only* |
| System Monitoring | Service health (auth-service, log-service, database), recent alert stats, recent activity log |

**Security.** Every `/api/admin/*` endpoint requires `is_superuser=True` and returns 403 otherwise. `AdminLayout` re-checks `is_superuser` on every page load. Every admin action writes to `audit_logs` with the operator's IP. Admins cannot suspend other admins.

---

## API Reference

### Auth Service — `/api/auth/`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/register/` | Register (handles tier + team creation / join) |
| POST | `/login/` | Login → returns access + refresh JWT |
| POST | `/logout/` | Blacklist refresh token |
| POST | `/password-reset/request/` | Email a reset link (always returns 200 — no email enumeration) |
| POST | `/password-reset/confirm/` | Submit new password with uid + token |
| GET / PATCH | `/me/` | Get / update current user profile |
| POST | `/change-password/` | Change password with current-password check |

### Teams — `/api/teams/`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET / POST | `/` | List / create teams |
| POST | `/{id}/regenerate_pin/` | Regenerate PIN (leader only) |

### Subscriptions — `/api/subscriptions/`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/plans/` | List plans (public) |
| GET | `/my-subscription/` | Current user's subscription |
| POST | `/upgrade/` | Upgrade with duration |
| POST | `/renew/` | Renew an expired subscription |

### Admin — `/api/admin/` (superuser only)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/stats/` | Dashboard stats |
| GET | `/users/` | List users (search / filter / paginate) |
| GET | `/{id}/user_detail/` | User detail + subscription |
| POST | `/{id}/suspend/` / `/unsuspend/` | Suspend / unsuspend |
| POST | `/{id}/change_tier/` | Change tier (triggers team side effects) |
| POST | `/{id}/reset_password/` | Reset to a temp password |
| GET | `/subscriptions/` | Subscription stats + ongoing list |
| GET | `/teams/` | All teams with members |
| DELETE | `/{id}/delete_team/` | Delete team |
| POST | `/{id}/remove_member/` | Remove a member |
| GET | `/audit_log/` | Audit log entries |

### Log Service — port 8001

**Real-time**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/health` | Service health |
| GET | `/api/sse/alerts?token=JWT` | SSE stream (alerts + stats + heartbeat) |
| POST | `/api/logs/ingest` | Ingest alerts (all IDS formats) |

**Alerts**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/alerts` | List (filter / paginate / `dismissed`) |
| POST | `/api/alerts/dismiss-feed` | Dismiss all alerts from the live feed |
| POST | `/api/alerts/{id}/dismiss-feed` | Dismiss one alert |

**Threat intel**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/threat-intel/recent` | ThreatFox feed (cached 5 min) |
| GET | `/api/threat-intel/search` | Search ThreatFox by IP / hash / domain |

**Lists**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET / POST / DELETE | `/api/blacklist` | Manage blacklist |
| POST | `/api/blacklist/bulk` | Bulk CSV import |
| GET / POST / DELETE | `/api/whitelist` | Manage whitelist |
| POST | `/api/whitelist/bulk` | Bulk CSV import |

**Quarantine**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/quarantine` | List quarantined alerts |
| GET | `/api/quarantine/stats` | Pending / released / blocked counts |
| POST | `/api/quarantine/{id}/release` | Mark safe |
| POST | `/api/quarantine/{id}/block` | Confirm threat → blacklist IP |
| DELETE | `/api/quarantine/{id}` | Remove from quarantine |

**Rules** (Exclusive)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET / POST | `/api/rules` | List / create |
| PUT / DELETE | `/api/rules/{id}` | Update / delete |
| POST | `/api/rules/{id}/toggle` | Enable / disable |
| POST | `/api/rules/{id}/test` | Dry-run against recent alerts |

**Team** (Exclusive)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| PATCH | `/api/team/alerts/{id}/assign` | Assign alert to member |
| GET | `/api/team/activity` | Activity feed |
| GET | `/api/team/stats` | Total / unassigned counts |

**ML**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET / PUT | `/api/ml-config` | Get / update ML configuration (Premium+) |

**Analytics**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/analytics/time-series` | Counts by hour / day |
| GET | `/api/analytics/category-distribution` | Counts per category |
| GET | `/api/analytics/top-sources` | Top N source IPs |
| GET | `/api/analytics/severity-trends` | Severity over time |
| GET | `/api/analytics/geo-map` | Locations grouped by lat / lon / country |
| GET | `/api/engine-comparison` | IPs flagged by ≥ N engines (Premium+) |

**Ingestion logs** (Premium+)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/upload` | Upload an IDS log file |
| GET | `/api/ingestion-logs` | List processed entries |
| GET | `/api/ingestion-logs/batches` | List upload batches |
| POST | `/api/ingestion-logs/{id}/block` / `/trust` / `/release` | Per-entry actions |

**API keys**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/api-keys` | Generate key (returns full key once) |
| GET | `/api/api-keys` | List (masked) |
| DELETE | `/api/api-keys/{id}` | Revoke |

**Incidents** (Premium+)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET / POST | `/api/incidents` | List / create |
| GET / PATCH / DELETE | `/api/incidents/{id}` | Detail / update / delete |
| POST | `/api/incidents/{id}/notes` | Add note |
| POST | `/api/incidents/{id}/link-alert` | Link an alert |
| DELETE | `/api/incidents/{id}/unlink-alert/{alert_id}` | Unlink |
| GET | `/api/incidents/{id}/alerts` | List linked alerts |

**DurianBot**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/chat` | Send message + history → Groq response with tool execution |

### Authentication

Both methods work on every log-service endpoint:

| Method | Header | Use case | Expiry |
|--------|--------|----------|--------|
| JWT Bearer | `Authorization: Bearer <token>` | Frontend, SSE (in query string) | ~30 min, auto-refreshed |
| API key | `X-API-Key: dd_…` | IDS watcher, scripts, automation | Never expires, revocable |

API-key alerts are scoped to the key's owning user / team, identical to JWT.

---

## Data Models

### Auth Service (Django)

- **User** — extends `AbstractUser`; adds `tier` (FREE / PREMIUM / EXCLUSIVE), `team` (FK), `is_team_leader`, `subscription_status`. `is_superuser` distinguishes admins.
- **AuditLog** — `user_id`, `user_email`, `action`, `details`, `ip_address`, `timestamp`. Logs registrations, logins, suspensions, tier changes, password resets, team operations.
- **Team** — `id` (UUID), `name`, `pin` (unique, 6 chars), `created_by` (FK), `created_at`.
- **SubscriptionPlan** — `id` (UUID), `name`, `price_monthly`, `price_yearly`, `features` (JSON).
- **Subscription** — `id` (UUID), `user` (FK), `plan` (FK), `status`, `start_date`, `duration_months`, computed `end_date`, `auto_renew`.

### Log Service (SQLAlchemy)

- **Alert** — `id` (UUID), `severity`, `category`, `source_ip`, `destination_ip`, `source_port`, `destination_port`, `protocol`, `threat_score`, `ids_source`, `raw_data` (JSONB), `user_id`, `team_id`, `threat_intel` (JSONB), `flagged_by_threatfox`, `is_whitelisted`, `is_blocked`, `quarantine_status`, `quarantined_at`, `reviewed_by`, `review_notes`, `assigned_to`, `assigned_name`, `ml_confidence` (nullable), `geo_latitude`, `geo_longitude`, `geo_country`, `detected_at`, `created_at`. Indexed on `(source_ip, detected_at)` and `(ids_source, detected_at)`.
- **DismissedAlert** — composite PK `(user_id, alert_id)` + `dismissed_at`.
- **IngestionLog** — same shape as Alert plus `batch_id` (UUID) and `upload_filename`. Stored in a separate table so file uploads never pollute the real-time feed.
- **BlacklistEntry / WhitelistEntry** — `id` (UUID), `entry_type` (IP / DOMAIN / CIDR), `value`, `reason`, `added_by`, `user_id`, `team_id`, hit count, `created_at`.
- **Rule** — `id` (UUID), `name`, `rule_type`, `conditions` (JSONB), `actions` (JSONB), `priority`, `enabled`, `trigger_count`, tenant fields, timestamps.
- **MLConfig** — per-user or per-team row with model choice, sensitivity, score boost, confidence threshold, enabled flag.
- **APIKey** — `id` (UUID), `key` (`dd_`-prefixed), `label`, tenant fields, `tier`, `is_active`, `last_used_at`, `created_at`.
- **TeamActivity** — `id` (UUID), `user_id`, `user_name`, `team_id`, `action`, `details`, `created_at`.
- **Incident** — `id` (UUID), `title`, `description`, `status`, `priority`, `created_by_id`, `created_by_name`, tenant fields, timestamps.
- **IncidentNote** — `id` (UUID), `incident_id` (FK), `content`, `author_id`, `author_name`, `created_at`.
- **IncidentAlert** — join table: `(incident_id, alert_id)` PK, `added_at`.

---

## Local Setup

### Prerequisites

- Python 3.10+
- Node 18+
- PostgreSQL (or a Supabase project)
- A root `.env` file (see below)

### 1. Auth Service — port 8000

```bash
cd services/auth-service
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser     # optional, for admin panel
python manage.py runserver
```

### 2. Log Service — port 8001

```bash
cd services/log-service
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8001
```

If `services/log-service/models/` has no `.pkl` files, train them first:

```bash
python -m app.ml.train_model
```

### 3. IDS Watcher (optional, for real-time ingestion)

```bash
cd services/ids-watcher
pip install -r requirements.txt
python watcher.py setup
python watcher.py
```

### 4. Frontend — port 5173

```bash
cd frontend
npm install
npm run dev
```

---

## Environment Variables

Root `.env` — shared by both backend services:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (Supabase) |
| `JWT_SECRET_KEY` | JWT signing key — must match between services |
| `THREATFOX_AUTH_KEY` | Free key from https://auth.abuse.ch/ |
| `GROQ_API_KEY` | Groq key for DurianBot |
| `BREVO_API_KEY` | Brevo transactional email key |
| `DEFAULT_FROM_EMAIL` | From-address for password reset emails |
| `FRONTEND_URL` | Used to build reset links (default `http://localhost:5173`) |
| `CORS_ALLOWED_ORIGINS` | Comma-separated origins (default `http://localhost:5173`) |
| `AUTH_SERVICE_URL` | Auth service base URL (default `http://localhost:8000`) |
| `LOG_SERVICE_URL` | Log service base URL (default `http://localhost:8001`) |

`frontend/.env`:

| Variable | Purpose |
|----------|---------|
| `VITE_AUTH_API_URL` | Auth service URL (default `http://localhost:8000`) |
| `VITE_LOG_API_URL` | Log service URL (default `http://localhost:8001`) |

---

## Deployment

DurianDetector is deployed as four cloud components plus a watcher per customer:

| Component | Host | Auto-deploy |
|-----------|------|-------------|
| Frontend | Vercel | on push to `main` |
| Auth service | Railway | on push to `main` |
| Log service | Railway | on push to `main` |
| Database | Supabase | — |
| IDS watcher | Customer's network | manual install |

Customer onboarding:

1. Customer registers on the public site, picks a plan, activates a subscription.
2. Customer generates an API key from **Settings → API Keys** (the full key is shown once).
3. Customer downloads the watcher, runs `python watcher.py setup`, and pastes in the API URL + key.
4. The watcher tails the customer's IDS logs and ships alerts over HTTPS to the log service.
5. The log service tags every alert with the API key's owning `user_id` / `team_id` — no other tenant can see them.
6. Customer logs into the dashboard from any browser and sees their alerts streaming in real time.

### Design notes

- Dark theme (`#0a0e1a`); blue primary (`#3B82F6`); severity colours red / orange / yellow / grey; tier badges grey / blue / purple.
- Admin theme uses a red accent (`#EF4444`) on a darker background (`#0d1117`) to make admin context unmistakable.
- Glass-morphism cards with subtle borders and hover effects.
- Sidebar groups (Overview, Detection, Intelligence, Policies, Workspace) auto-open to the section containing the current page.
- Live alert feed uses fade-in animations and a pulsing connection indicator.
- Mobile sidebar collapses; layouts adapt to small screens.
