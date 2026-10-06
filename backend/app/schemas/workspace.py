from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

class WorkspaceNoticeResponse(BaseModel):
    id: int
    workspace_id: str
    title: str
    body: str
    image_url: Optional[str] = None
    is_pinned: bool
    created_at: datetime
    author_name: str

    model_config = ConfigDict(from_attributes=True)

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
