import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "NexaVault Platform"
    
    # Environment-based JWT settings
    JWT_SECRET: str = os.getenv("JWT_SECRET", "nexavault_secret_key_production_grade_32_chars_min")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # PostgreSQL Database URL
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/nexavault_db")
    
    # CORS Origins for Vite Frontend
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    model_config = SettingsConfigDict(case_sensitive=True)

settings = Settings()
