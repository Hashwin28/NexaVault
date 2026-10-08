import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from alembic.config import Config
from alembic import command
from app.core.config import settings
from app.api.v1.router import api_router

logger = logging.getLogger("uvicorn")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Automatically apply Alembic migrations on startup
    try:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        alembic_ini_path = os.path.join(base_dir, "alembic.ini")
        if not os.path.exists(alembic_ini_path):
            alembic_ini_path = "alembic.ini"

        if os.path.exists(alembic_ini_path):
            logger.info("Applying database migrations via Alembic...")
            alembic_cfg = Config(alembic_ini_path)
            script_loc = os.path.join(base_dir, "alembic")
            if os.path.exists(script_loc):
                alembic_cfg.set_main_option("script_location", script_loc)
            command.upgrade(alembic_cfg, "head")
            logger.info("Database migrations applied successfully.")
        else:
            logger.warning("alembic.ini not found, skipping automatic migrations.")
    except Exception as e:
        logger.error(f"Error applying migrations on startup: {e}")
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    lifespan=lifespan
)

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

@app.get("/")
def root():
    return {
        "name": settings.PROJECT_NAME,
        "status": "online",
        "docs": f"{settings.API_V1_STR}/docs"
    }

