from datetime import datetime
from typing import Optional, List
import re
from pydantic import BaseModel, Field, field_validator, ConfigDict

ALPHANUMERIC_REGEX = re.compile(r"^[A-Za-z0-9]+$")

class GroupMemberResponse(BaseModel):
    id: int
    full_name: str
    email: str
    joined_at: datetime

    model_config = ConfigDict(from_attributes=True)

class GroupCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Name of the academic group")
    code: Optional[str] = Field(None, min_length=6, max_length=50, description="Unique alphanumeric group code (auto-generated if omitted)")

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            clean = v.strip().upper()
            if not ALPHANUMERIC_REGEX.match(clean):
                raise ValueError("Group code must be strictly alphanumeric (letters and numbers only, no symbols or spaces).")
            return clean
        return None

class GroupJoin(BaseModel):
    code: str = Field(..., min_length=1, max_length=50, description="Unique Group Code to join")

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: str) -> str:
        clean = v.strip().upper()
        if not ALPHANUMERIC_REGEX.match(clean):
            raise ValueError("Group code must be strictly alphanumeric.")
        return clean

class GroupCodeUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=6, max_length=50, description="New alphanumeric code (auto-generated if omitted)")

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            clean = v.strip().upper()
            if not ALPHANUMERIC_REGEX.match(clean):
                raise ValueError("Group code must be strictly alphanumeric.")
            return clean
        return None

class GroupEnrollRequest(BaseModel):
    workspace_id: str = Field(..., min_length=1, max_length=100, description="Workspace ID / Enrollment code")

class GroupResponse(BaseModel):
    id: int
    name: str
    code: str
    created_at: datetime
    member_count: int
    members: List[GroupMemberResponse] = []
    is_member: bool = True

    model_config = ConfigDict(from_attributes=True)

class GroupMessageResponse(BaseModel):
    message: str
    group: Optional[GroupResponse] = None

# --- STAFF OVERSIGHT SCHEMAS ---

class StaffGroupMemberItem(BaseModel):
    id: int
    full_name: str
    email: str
    roll_number: Optional[str] = None
    joined_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class StaffGroupProjectOverview(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    progress_percentage: float = 0.0
    github_repo_url: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class StaffGroupSubmissionSummary(BaseModel):
    submission_id: int
    round_id: int
    round_title: str
    round_order: int
    max_score: float
    due_date: Optional[datetime] = None
    version_id: int
    version_number: int
    status: str
    submitted_at: Optional[datetime] = None
    verdict: Optional[str] = None
    reviewer_name: Optional[str] = None
    is_released: bool = False
    scores_count: int = 0

    model_config = ConfigDict(from_attributes=True)

class StaffGroupOversightItem(BaseModel):
    group_id: int
    group_name: str
    group_code: str
    id: Optional[int] = None
    name: Optional[str] = None
    code: Optional[str] = None
    created_at: datetime
    created_by: int
    creator_name: Optional[str] = None
    workspace_id: str
    workspace_name: str
    enrolled_at: Optional[datetime] = None
    member_count: int
    members: List[StaffGroupMemberItem] = []
    has_project: bool = False
    project: Optional[StaffGroupProjectOverview] = None
    latest_submission: Optional[StaffGroupSubmissionSummary] = None
    submissions: List[StaffGroupSubmissionSummary] = []
    review_status: str  # "APPROVED", "IN_REVIEW", "REVISION_REQUESTED", "SUBMITTED", "PENDING_REVIEW", "NO_SUBMISSION"
    results_status: str  # "PUBLISHED", "DRAFT", "PENDING"

    model_config = ConfigDict(from_attributes=True)
