import os
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

# ── Normalizza sys.path: consente import assoluti `from backend.*`
#    sia da Vercel (api/index.py) sia in esecuzione locale dalla root.
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from backend.db import init_db
from backend.routers import ingest, manual_records, forecast, budget, transactions, dashboard, etf

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
FRONTEND_DIST = os.path.join(os.path.dirname(BASE_DIR), "frontend", "dist")

try:
    os.makedirs(DATA_DIR, exist_ok=True)
except OSError:
    pass


@asynccontextmanager
async def lifespan(app):
    init_db()
    yield


app = FastAPI(title="DevFinance Engine", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest.router)
app.include_router(manual_records.router)
app.include_router(forecast.router)
app.include_router(budget.router)
app.include_router(transactions.router)
app.include_router(dashboard.router)
app.include_router(etf.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ── Serve built frontend ──

@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    if not os.path.isdir(FRONTEND_DIST):
        return {"error": "Frontend not built"}
    file_path = os.path.join(FRONTEND_DIST, full_path)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app:app", host="0.0.0.0", port=8000, reload=True)
