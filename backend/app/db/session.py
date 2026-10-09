from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

is_sqlite = "sqlite" in settings.DATABASE_URL
is_postgres = "postgresql" in settings.DATABASE_URL

# Engine configuration tuned for Neon pooled connections & PgBouncer
connect_args = {}
if is_sqlite:
    connect_args = {"check_same_thread": False}
elif is_postgres:
    # Disable server-side prepared statements for Neon pooler / PgBouncer compatibility
    # and configure connect_timeout (15s) to allow Neon resume from compute scale-to-zero
    connect_args = {
        "prepare_threshold": None,
        "connect_timeout": 15,
    }

pool_kwargs = {}
if is_postgres:
    pool_kwargs = {
        "pool_pre_ping": True,
        "pool_size": 5,
        "max_overflow": 5,
        "pool_timeout": 30,
        "pool_recycle": 300,
    }

engine = create_engine(
    settings.DATABASE_URL, 
    connect_args=connect_args,
    **pool_kwargs,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
