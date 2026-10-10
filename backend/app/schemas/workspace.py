from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict, model_validator

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
    body: Optional[str] = None
    content: Optional[str] = None
    image_url: Optional[str] = None
    is_pinned: bool = False

    @model_validator(mode="before")
    @classmethod
    def resolve_body(cls, data):
        if isinstance(data, dict):
            val = data.get("body") if data.get("body") is not None else data.get("content")
            if val is not None:
                data["body"] = str(val)
                data["content"] = str(val)
        return data

class WorkspaceNoticeUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    body: Optional[str] = None
    content: Optional[str] = None
    image_url: Optional[str] = None
    is_pinned: Optional[bool] = None

    @model_validator(mode="before")
    @classmethod
    def resolve_body_update(cls, data):
        if isinstance(data, dict):
            val = data.get("body") if data.get("body") is not None else data.get("content")
            if val is not None:
                data["body"] = str(val)
                data["content"] = str(val)
        return data

class WorkspaceNoticeResponse(BaseModel):
    id: int
    workspace_id: str
    title: str
    body: str
    content: Optional[str] = None
    image_url: Optional[str] = None
    image_key: Optional[str] = None
    thumbnail_url: Optional[str] = None
    is_pinned: bool
    is_archived: bool = False
    created_at: datetime
    expires_at: Optional[datetime] = None
    author_name: str

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def populate_content(self):
        if not self.content and self.body:
            self.content = self.body
        return self

class ReviewRoundCreate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    order_index: Optional[int] = Field(None, ge=1)
    round_number: Optional[int] = Field(None, ge=1)
    due_date: datetime
    max_score: float = Field(..., ge=1.0, description="Max score must be >= 1")
    is_open: Optional[bool] = True
    is_active: Optional[bool] = True
    weight: Optional[float] = None

class ReviewRoundUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    order_index: Optional[int] = Field(None, ge=1)
    round_number: Optional[int] = Field(None, ge=1)
    due_date: Optional[datetime] = None
    max_score: Optional[float] = Field(None, ge=1.0, description="Max score must be >= 1")
    is_open: Optional[bool] = None
    is_active: Optional[bool] = None
    weight: Optional[float] = None

class ReviewRoundResponse(BaseModel):
    id: int
    workspace_id: str
    title: str
    name: Optional[str] = None
    description: Optional[str] = None
    order_index: int
    round_number: Optional[int] = None
    due_date: datetime
    max_score: float
    is_open: bool
    is_active: Optional[bool] = None
    created_at: datetime
    weight: Optional[float] = 20.0

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def populate_aliases(self):
        if not self.name:
            self.name = self.title
        if self.round_number is None:
            self.round_number = self.order_index
        if self.is_active is None:
            self.is_active = self.is_open
        if self.weight is None:
            self.weight = 20.0
        return self

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
