from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Engine configuration for PostgreSQL / SQLite fallback if tested in-memory
connect_args = {"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
pool_kwargs = {"pool_pre_ping": True, "pool_size": 10, "max_overflow": 20} if "postgresql" in settings.DATABASE_URL else {}

engine = create_engine(
    settings.DATABASE_URL, 
    connect_args=connect_args,
    **pool_kwargs,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
