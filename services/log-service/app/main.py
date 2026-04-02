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


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="Durian Detector — Log Ingestion Service",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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


@app.get("/health")
async def health():
    return {"status": "ok", "service": "log-ingestion"}
