import os
from typing import List, Union
from pydantic import field_validator
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
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://nexa-vault-chi.vercel.app",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        import json
        if isinstance(v, str):
            v_str = v.strip()
            if v_str.startswith("[") and v_str.endswith("]"):
                try:
                    parsed = json.loads(v_str)
                    if isinstance(parsed, list):
                        return [str(item).strip().rstrip("/") for item in parsed if str(item).strip()]
                except Exception:
                    pass
            return [i.strip().rstrip("/") for i in v_str.split(",") if i.strip()]
        elif isinstance(v, list):
            return [str(item).strip().rstrip("/") for item in v if str(item).strip()]
        return [v]

    def model_post_init(self, __context):
        if self.DATABASE_URL.startswith("postgres://"):
            self.DATABASE_URL = self.DATABASE_URL.replace("postgres://", "postgresql://", 1)
        if "localhost" not in self.DATABASE_URL and "127.0.0.1" not in self.DATABASE_URL and "db" not in self.DATABASE_URL and "sqlite" not in self.DATABASE_URL:
            if "sslmode" not in self.DATABASE_URL:
                delimiter = "&" if "?" in self.DATABASE_URL else "?"
                self.DATABASE_URL += f"{delimiter}sslmode=require"

    model_config = SettingsConfigDict(case_sensitive=True)

settings = Settings()

