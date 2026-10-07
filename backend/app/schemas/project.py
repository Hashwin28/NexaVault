from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict

class UpdateCommentCreate(BaseModel):
    content: str = Field(..., min_length=1, description="Comment content")

class UpdateCommentResponse(BaseModel):
    id: int
    update_id: int
    author_id: int
    author_name: str
    author_role: str
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ProjectUpdateCreate(BaseModel):
    content: str = Field(..., min_length=1, description="Update note content")
    link: Optional[str] = Field(None, description="Optional external link or reference")

class ProjectUpdateResponse(BaseModel):
    id: int
    project_id: int
    author_id: int
    author_name: str
    content: str
    link: Optional[str] = None
    created_at: datetime
    comments: List[UpdateCommentResponse] = []

    model_config = ConfigDict(from_attributes=True)

class ProjectCreate(BaseModel):
    workspace_id: str = Field(..., min_length=1, max_length=100, description="Workspace ID")
    name: str = Field(..., min_length=1, max_length=255, description="Project title")
    description: Optional[str] = Field(None, description="Project description")

class ProjectMemberInfo(BaseModel):
    id: int
    full_name: str
    email: str

    model_config = ConfigDict(from_attributes=True)

class ProjectResponse(BaseModel):
    id: int
    workspace_id: str
    workspace_name: str
    group_id: int
    group_name: str
    name: str
    description: Optional[str] = None
    created_at: datetime
    members: List[ProjectMemberInfo] = []
    github_repo_url: Optional[str] = None
    progress_percentage: Optional[float] = 0.0

    model_config = ConfigDict(from_attributes=True)
