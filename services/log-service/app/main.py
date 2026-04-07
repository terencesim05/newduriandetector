from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routes.ingest import router as ingest_router
from app.routes.alerts import router as alerts_router
from app.routes.threat_intel import router as threat_intel_router
from app.routes.blacklist import router as blacklist_router
from app.routes.whitelist import router as whitelist_router
from app.routes.quarantine import router as quarantine_router
from app.routes.rules import router as rules_router
from app.routes.team import router as team_router
from app.routes.ml_config import router as ml_config_router
from app.routes.analytics import router as analytics_router
from app.routes.admin import router as admin_router
from app.routes.sse import router as sse_router
from app.routes.upload import router as upload_router
from app.routes.ingestion_logs import router as ingestion_logs_router
from app.routes.api_keys import router as api_keys_router
from app.routes.incidents import router as incidents_router
from app.routes.chatbot import router as chatbot_router
from app.routes.comparison import router as comparison_router
# Ensure ComparisonRun model is registered with Base.metadata before init_db()
from app.models import comparison as _comparison_model  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="Durian Detector — Log Ingestion Service",
    version="0.1.0",
    lifespan=lifespan,
)

import os

_cors_origins = [
    o.strip()
    for o in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest_router)
app.include_router(alerts_router)
app.include_router(threat_intel_router)
app.include_router(blacklist_router)
app.include_router(whitelist_router)
app.include_router(quarantine_router)
app.include_router(rules_router)
app.include_router(team_router)
app.include_router(ml_config_router)
app.include_router(analytics_router)
app.include_router(admin_router)
app.include_router(sse_router)
app.include_router(upload_router)
app.include_router(ingestion_logs_router)
app.include_router(api_keys_router)
app.include_router(incidents_router)
app.include_router(chatbot_router)
app.include_router(comparison_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "log-ingestion"}
