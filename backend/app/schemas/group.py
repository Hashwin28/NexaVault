from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

class UserSummary(BaseModel):
    id: int
    full_name: str
    email: str
    role: str

    class Config:
        from_attributes = True

class GroupCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Name of the academic group")
    code: Optional[str] = Field(None, min_length=3, max_length=50, description="Unique Group Code (auto-generated if omitted)")
    workspace_code: Optional[str] = Field(None, max_length=100, description="Associated course workspace code")
    project_title: Optional[str] = Field(None, max_length=255, description="Associated project title")

class GroupJoin(BaseModel):
    code: str = Field(..., min_length=1, description="Unique Group Code to join")

class GroupResponse(BaseModel):
    id: int
    name: str
    code: str
    leader_id: int
    workspace_code: Optional[str] = None
    project_title: Optional[str] = None
    created_at: datetime
    leader: UserSummary
    members: List[UserSummary] = []
    is_leader: bool = False
    is_member: bool = True

    class Config:
        from_attributes = True

class GroupMessageResponse(BaseModel):
    message: str
    group: Optional[GroupResponse] = None
