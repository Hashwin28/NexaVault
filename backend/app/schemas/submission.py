from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

class SubmissionVersionCreate(BaseModel):
    notes: Optional[str] = Field(None, description="Deliverable notes or execution summary")
    link: Optional[str] = Field(None, description="Optional deliverable or artifact link")
    github_commit_sha: Optional[str] = Field(None, max_length=100, description="Optional GitHub commit SHA")
    is_draft: bool = Field(False, description="Set True to save as draft, False to submit immediately")

class SubmissionDraftUpdate(BaseModel):
    notes: Optional[str] = None
    link: Optional[str] = None
    github_commit_sha: Optional[str] = None

class SubmissionVersionResponse(BaseModel):
    id: int
    submission_id: int
    version_number: int
    submitted_by: int
    submitter_name: Optional[str] = None
    status: str
    notes: Optional[str] = None
    link: Optional[str] = None
    github_commit_sha: Optional[str] = None
    is_late: bool
    submitted_at: Optional[datetime] = None
    roster_snapshot: List[Dict[str, Any]] = []
    feedback: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class SubmissionResponse(BaseModel):
    id: int
    project_id: int
    round_id: int
    round_title: str
    max_score: float
    is_round_open: bool
    versions: List[SubmissionVersionResponse] = []
    latest_version: Optional[SubmissionVersionResponse] = None

    model_config = ConfigDict(from_attributes=True)
