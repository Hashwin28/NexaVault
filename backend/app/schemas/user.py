"""
User Pydantic Schemas Module.

Defines validation and serialization models for user registration,
login credentials, JWT payload tokens, and sanitized profile responses.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict

class UserBase(BaseModel):
    """Base user properties shared across creation and response schemas."""
    email: EmailStr
    full_name: str

class UserCreate(UserBase):
    password: str = Field(..., min_length=6, description="Password must be at least 6 characters")

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(UserBase):
    id: int
    role: str
    is_active: bool
    department: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class TokenData(BaseModel):
    sub: Optional[str] = None
