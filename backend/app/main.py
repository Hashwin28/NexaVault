import time
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.api.v1.router import api_router
from app.db.session import engine

# ---------------------------------------------------------------------------
# Application Initialization & Configuration
# ---------------------------------------------------------------------------
# Instantiate the core FastAPI application configured with project metadata,
# customized OpenAPI schema endpoints, and interactive API documentation paths.
app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs"
)

# Custom Middleware to enforce no-store on all authenticated and private API responses
# preventing CDN / Vercel Edge proxies from caching private user data, while allowing image caching
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

# Throttle timestamp to ensure Neon database is pinged at most once per 60 seconds
_last_wake_timestamp = 0.0

@app.get(f"{settings.API_V1_STR}/health")
@app.get("/health")
def health(wake_db: bool = False):
    """
    Intelligent health check endpoint.
    - Default (wake_db=False): Instantly returns 200 OK without touching DB (for Render platform health pings).
    - wake_db=True (from frontend Login mount): Throttled to ping Neon once/min and returns 'waking' rather than 500 if DB is resuming.
    """
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
        return {"server": "online", "database": "waking", "message": "Database compute is resuming"}

@app.on_event("startup")
def bootstrap_administrators():
    """
    Ensures baseline administrator accounts are provisioned and active on server boot.
    Idempotent: skips if accounts already exist and verifies active status.
    """
    try:
        from app.db.session import SessionLocal
        from app.models.user import User
        from app.core.security import hash_password

        db = SessionLocal()
        try:
            admin_email = "admin@nexavault.edu"
            existing_admin = db.query(User).filter(User.email == admin_email).first()
            if not existing_admin:
                new_admin = User(
                    email=admin_email,
                    full_name="System Administrator",
                    hashed_password=hash_password("AdminVault2026!"),
                    role="administrator",
                    department=None,
                    is_active=True,
                )
                db.add(new_admin)
                db.commit()
            elif not existing_admin.is_active or existing_admin.role.lower() != "administrator":
                existing_admin.is_active = True
                existing_admin.role = "administrator"
                db.commit()

            cs_admin_email = "admin.cs@nexavault.edu"
            existing_cs_admin = db.query(User).filter(User.email == cs_admin_email).first()
            if not existing_cs_admin:
                new_cs_admin = User(
                    email=cs_admin_email,
                    full_name="CS Department Admin",
                    hashed_password=hash_password("AdminVault2026!"),
                    role="administrator",
                    department="CS",
                    is_active=True,
                )
                db.add(new_cs_admin)
                db.commit()
            elif not existing_cs_admin.is_active or existing_cs_admin.role.lower() != "administrator":
                existing_cs_admin.is_active = True
                existing_cs_admin.role = "administrator"
                existing_cs_admin.department = "CS"
                db.commit()
        finally:
            db.close()
    except Exception as exc:
        print(f"[!] Notice: Failed to bootstrap administrator accounts on startup: {exc}")

from app.core.cache import cache

@app.get(f"{settings.API_V1_STR}/cache/stats")
def get_cache_stats():
    """
    Returns real-time in-memory cache telemetry: hits, misses, hit rate, entry count, etc.
    """
    return cache.stats()

@app.get("/")
def root():
    return {
        "name": settings.PROJECT_NAME,
        "status": "online",
        "docs": f"{settings.API_V1_STR}/docs"
    }
