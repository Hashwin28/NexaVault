from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict

class WorkspaceCreate(BaseModel):
    id: Optional[str] = Field(None, max_length=100, description="Unique workspace ID, e.g., CS204-DSA")
    name: Optional[str] = Field(None, max_length=255)
    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    term: Optional[str] = Field("Academic Term", max_length=100)

class WorkspaceResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    term: str
    owner_id: int
    owner_name: Optional[str] = None
    is_open: bool
    is_archived: bool
    created_at: datetime
    role: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class WorkspaceStaffRequestResponse(BaseModel):
    id: int
    workspace_id: str
    requester_id: int
    requester_name: Optional[str] = None
    requester_email: Optional[str] = None
    status: str
    created_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class WorkspaceStaffRequestResolve(BaseModel):
    action: str = Field(..., description="'approve' or 'reject'")

class WorkspaceNoticeCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    body: str = Field(..., min_length=1)
    image_url: Optional[str] = None
    is_pinned: bool = False

class WorkspaceNoticeUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    body: Optional[str] = Field(None, min_length=1)
    image_url: Optional[str] = None
    is_pinned: Optional[bool] = None

class WorkspaceNoticeResponse(BaseModel):
    id: int
    workspace_id: str
    title: str
    body: str
    image_url: Optional[str] = None
    is_pinned: bool
    is_archived: bool = False
    created_at: datetime
    author_name: str

    model_config = ConfigDict(from_attributes=True)

class ReviewRoundCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    order_index: int = Field(1, ge=1)
    due_date: datetime
    max_score: float = Field(..., ge=1.0, description="Max score must be >= 1")

class ReviewRoundUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    order_index: Optional[int] = Field(None, ge=1)
    due_date: Optional[datetime] = None
    max_score: Optional[float] = Field(None, ge=1.0, description="Max score must be >= 1")

class ReviewRoundResponse(BaseModel):
    id: int
    workspace_id: str
    title: str
    description: Optional[str] = None
    order_index: int
    due_date: datetime
    max_score: float
    is_open: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class WorkspaceStudentResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    term: str
    is_open: bool
    created_at: datetime
    enrolled_at: Optional[datetime] = None
    has_project: bool = False
    project_id: Optional[int] = None
    notices: List[WorkspaceNoticeResponse] = []
    review_rounds: List[ReviewRoundResponse] = []

    model_config = ConfigDict(from_attributes=True)
