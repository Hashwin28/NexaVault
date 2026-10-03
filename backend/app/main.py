from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.models.user import User
from app.models.group import Group
from app.core.security import hash_password
from app.api.v1.router import api_router

# Initialize database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs"
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

@app.on_event("startup")
def seed_demo_users():
    """Seed initial demo accounts if not present."""
    db = SessionLocal()
    try:
        demo_accounts = [
            {
                "email": "student@nexavault.edu",
                "password": "password123",
                "full_name": "Demo Student",
                "role": "student"
            },
            {
                "email": "teacher@nexavault.edu",
                "password": "password123",
                "full_name": "Dr. Sarah Jenkins",
                "role": "teacher"
            }
        ]

        for acc in demo_accounts:
            existing = db.query(User).filter(User.email == acc["email"]).first()
            if not existing:
                db_user = User(
                    email=acc["email"],
                    hashed_password=hash_password(acc["password"]),
                    full_name=acc["full_name"],
                    role=acc["role"],
                    is_active=True
                )
                db.add(db_user)
        db.commit()
    finally:
        db.close()

@app.get("/")
def root():
    return {
        "name": settings.PROJECT_NAME,
        "status": "online",
        "docs": f"{settings.API_V1_STR}/docs"
    }
