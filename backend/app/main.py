import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routes import auth, logs, analysis

Base.metadata.create_all(bind=engine)

app = FastAPI(title="SOC Log Analyzer", version="1.0.0")

allowed_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
]
# Allow any Vercel deployment URL set via env
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    allowed_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(logs.router, prefix="/api/logs", tags=["logs"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["analysis"])

@app.get("/health")
def health():
    return {"status": "ok"}
