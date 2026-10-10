import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import text
from datetime import datetime, timezone, timedelta

from app.core.config import settings
from app.api.v1.router import api_router
from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.models import (
    User, Workspace, WorkspaceStaff, ReviewRound
)
from app.core.security import hash_password

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure tables exist
    try:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        try:
            # Seed staff user
            staff = db.query(User).filter(User.email == "prof.jenkins@nexavault.edu").first()
            if not staff:
                staff = User(
                    email="prof.jenkins@nexavault.edu",
                    hashed_password=hash_password("password123"),
                    full_name="Dr. Sarah Jenkins",
                    role="staff",
                    is_active=True
                )
                db.add(staff)
                db.flush()

            # Seed student user
            student = db.query(User).filter(User.email == "student1@nexavault.edu").first()
            if not student:
                student = User(
                    email="student1@nexavault.edu",
                    hashed_password=hash_password("password123"),
                    full_name="Alex Chen",
                    role="student",
                    is_active=True
                )
                db.add(student)
                db.flush()

            # Seed demo workspace if not present
            ws = db.query(Workspace).filter(Workspace.id == "CS204-DSA").first()
            if not ws:
                ws = Workspace(
                    id="CS204-DSA",
                    name="Data Structures & Algorithms Vault",
                    description="Departmental course workspace for project milestones, peer reviews, and grading.",
                    term="Spring 2026",
                    is_archived=False,
                    owner_id=staff.id
                )
                db.add(ws)
                db.flush()

                ws_staff = WorkspaceStaff(
                    workspace_id=ws.id,
                    user_id=staff.id,
                    role="owner"
                )
                db.add(ws_staff)

                # Review round
                r_round = ReviewRound(
                    workspace_id=ws.id,
                    title="Milestone 1 — Core Architecture",
                    description="Initial architectural design and unit test verification.",
                    max_score=100.0,
                    due_date=datetime.now(timezone.utc) + timedelta(days=14),
                    is_open=True
                )
                db.add(r_round)

            db.commit()
        except Exception as e:
            db.rollback()
            print("DB Seed Notice:", e)
        finally:
            db.close()
    except Exception as e:
        print("Schema init notice:", e)
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    lifespan=lifespan
)

# Custom Middleware to enforce no-store on all authenticated and private API responses
class NoCacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        if request.url.path.startswith(settings.API_V1_STR) or request.url.path.startswith("/api/"):
            if "/notices/images/" in request.url.path:
                response.headers["Cache-Control"] = "public, max-age=86400, immutable"
            else:
                response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0, private"
                response.headers["Pragma"] = "no-cache"
                response.headers["Expires"] = "0"
        return response

app.add_middleware(NoCacheMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS middleware for Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API v1 routes
app.include_router(api_router, prefix=settings.API_V1_STR)

# Mount local uploads static file directory
from fastapi.staticfiles import StaticFiles
import os
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Throttle timestamp to ensure database is pinged at most once per 60 seconds
_last_wake_timestamp = 0.0

@app.get(f"{settings.API_V1_STR}/health")
@app.get("/health")
def health(wake_db: bool = False):
    global _last_wake_timestamp
    if not wake_db:
        return {"server": "online", "database": "skipped"}

    now = time.monotonic()
    if now - _last_wake_timestamp < 60:
        return {"server": "online", "database": "recently_checked"}

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        _last_wake_timestamp = time.monotonic()
        return {"server": "online", "database": "active"}
    except Exception as exc:
        return {"server": "online", "database": "waking", "message": str(exc)}

from app.core.cache import cache

@app.get(f"{settings.API_V1_STR}/cache/stats")
def get_cache_stats():
    return cache.stats()

@app.get("/")
def root():
    return {
        "name": settings.PROJECT_NAME,
        "status": "online",
        "docs": f"{settings.API_V1_STR}/docs"
    }
