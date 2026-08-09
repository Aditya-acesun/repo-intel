import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import repos, chat, auth
from app.db.init_db import init_db
from app.core.config import settings

app = FastAPI(title="GitHub Repo Intelligence Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://repo-intel-two.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(repos.router)
app.include_router(chat.router)
app.include_router(auth.router)


@app.on_event("startup")
def on_startup():
    init_db()
    # TEMP DEBUG — remove after confirming GITHUB_TOKEN is set correctly on Render
    token = settings.GITHUB_TOKEN
    logging.warning(f"GITHUB_TOKEN starts with: {token[:8]}... length: {len(token)}")


@app.get("/")
def root():
    return {"status": "Backend is running", "phase": "Phase 5"}