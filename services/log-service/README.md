# Log Ingestion Service

FastAPI service for receiving IDS alerts from Suricata, Zeek, Snort, and Kismet.

## Setup

```bash
cd services/log-service
pip install -r requirements.txt
```

Make sure the root `.env` file contains `DATABASE_URL` and `JWT_SECRET_KEY`.

## Run

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

On Windows (if uvicorn isn't on PATH):
```bash
py -m uvicorn app.main:app --reload --port 8001
```

Tables are auto-created on startup.

## API Endpoints

### Health Check
```
GET /health
```

### Ingest Alerts
```
POST /api/logs/ingest
Authorization: Bearer <jwt>
```
Accepts pre-normalised alerts and/or raw IDS-specific formats in a single request:
```json
{
  "alerts": [...],
  "suricata_alerts": [...],
  "zeek_alerts": [...],
  "snort_alerts": [...],
  "kismet_alerts": [...]
}
```

### List Alerts
```
GET /api/alerts?severity=HIGH&category=MALWARE&page=1&page_size=20
Authorization: Bearer <jwt>
```
Filters: `severity`, `category`, `start_date`, `end_date`, `page`, `page_size`.

## Threat Scoring

Each alert receives an automatic threat score from **0.0 to 1.0** on ingestion.

**Formula:** `score = (0.6 × severity_weight) + (0.4 × category_weight)`

### Severity Weights

| Severity | Weight |
|----------|--------|
| LOW      | 0.10   |
| MEDIUM   | 0.30   |
| HIGH     | 0.60   |
| CRITICAL | 0.90   |

### Category Weights

| Category             | Weight |
|----------------------|--------|
| SQL_INJECTION        | 0.85   |
| COMMAND_INJECTION    | 0.85   |
| PRIVILEGE_ESCALATION | 0.80   |
| DATA_EXFILTRATION    | 0.80   |
| MALWARE              | 0.75   |
| XSS                  | 0.65   |
| BRUTE_FORCE          | 0.60   |
| DDOS                 | 0.55   |
| PORT_SCAN            | 0.35   |
| ANOMALY              | 0.30   |
| OTHER                | 0.20   |

### Example Scores

| Alert                        | Calculation                        | Score |
|------------------------------|------------------------------------|-------|
| CRITICAL + SQL_INJECTION     | (0.6 × 0.9) + (0.4 × 0.85)       | 0.88  |
| HIGH + BRUTE_FORCE           | (0.6 × 0.6) + (0.4 × 0.60)       | 0.60  |
| MEDIUM + PORT_SCAN           | (0.6 × 0.3) + (0.4 × 0.35)       | 0.32  |
| LOW + ANOMALY                | (0.6 × 0.1) + (0.4 × 0.30)       | 0.18  |

Severity contributes 60% because an IDS marking something as CRITICAL is a strong signal regardless of category. Category contributes 40% because injection/escalation attacks are inherently more dangerous than port scans even at the same severity level.

## Test

```bash
python test_ingestion.py              # dummy JWT (alerts go to user_id 1)
python test_ingestion.py <real_jwt>   # real JWT from auth-service
```

Sends 10 mock alerts (mix of all IDS formats) and queries them back.

**Note:** The dummy JWT assigns alerts to `user_id: 1` (the first registered user). To see alerts on a specific account, pass that account's real JWT token. You can grab it from the browser: **DevTools → Application → Local Storage → `accessToken`**.

## Interactive Docs

Visit **http://localhost:8001/docs** for the auto-generated Swagger UI.
