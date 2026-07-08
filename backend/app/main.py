from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import repos, chat, auth
from app.db.init_db import init_db

app = FastAPI(title="GitHub Repo Intelligence Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
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


@app.get("/")
def root():
    return {"status": "Backend is running", "phase": "Phase 5"}