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

class ApprovedRoundInfo(BaseModel):
    round_id: int
    round_title: str
    order_index: int
    max_score: float

    model_config = ConfigDict(from_attributes=True)

class ProjectProgressResponse(BaseModel):
    project_id: int
    workspace_id: str
    approved_marks: float
    total_round_marks: float
    progress_percentage: float
    calculated_progress_percentage: float = 0.0
    staff_custom_progress: Optional[float] = None
    is_staff_override: bool = False
    progress_updated_at: Optional[datetime] = None
    progress_updated_by_name: Optional[str] = None
    approved_rounds: List[ApprovedRoundInfo] = []

    model_config = ConfigDict(from_attributes=True)

class ProjectProgressUpdate(BaseModel):
    progress_percentage: Optional[float] = Field(None, ge=0.0, le=100.0, description="Staff-set progress percentage (0-100)")
    reset_to_calculated: bool = Field(False, description="Whether to clear staff override and revert to calculated progress")

class ProjectReviewItem(BaseModel):
    submission_id: int
    round_id: int
    round_title: str
    version_number: int
    status: str
    feedback: str
    reviewer_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class ProjectReviewsResponse(BaseModel):
    project_id: int
    reviews: List[ProjectReviewItem] = []

    model_config = ConfigDict(from_attributes=True)

# --- STAFF PROJECTS OVERSIGHT SCHEMAS ---

class StaffProjectOversightItem(BaseModel):
    project_id: int
    name: str
    description: Optional[str] = None
    created_at: datetime
    progress_percentage: float = 0.0
    github_repo_url: Optional[str] = None
    workspace_id: str
    workspace_name: str
    group_id: Optional[int] = None
    group_name: Optional[str] = None
    group_code: Optional[str] = None
    members: List[ProjectMemberInfo] = []
    submission_count: int = 0
    latest_round_title: Optional[str] = None
    latest_version_number: Optional[int] = None
    latest_submission_status: Optional[str] = None
    grading_status: str  # "APPROVED", "IN_REVIEW", "REVISION_REQUESTED", "SUBMITTED", "PENDING"
    results_status: str  # "PUBLISHED", "DRAFT", "PENDING"

    model_config = ConfigDict(from_attributes=True)

class StaffProjectSubmissionItem(BaseModel):
    id: int
    version_id: int
    version_number: int
    round_id: int
    round_name: str
    round_number: int
    max_score: float
    due_date: Optional[datetime] = None
    status: str
    submitted_by: int
    submitter_name: Optional[str] = None
    submitted_at: Optional[datetime] = None
    commit_hash: Optional[str] = None
    submission_notes: Optional[str] = None
    repo_url: Optional[str] = None
    feedback: Optional[str] = None
    reviewer_name: Optional[str] = None
    is_evaluated: bool = False
    is_released: bool = False

    model_config = ConfigDict(from_attributes=True)

class StaffProjectResultItem(BaseModel):
    id: int
    student_id: int
    student_name: str
    student_email: str
    roll_number: Optional[str] = None
    round_id: int
    round_name: str
    score: float
    max_score: float
    percentage: float
    feedback: Optional[str] = None
    reviewer_name: Optional[str] = None
    is_released: bool = False
    released_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class StaffProjectDetailResponse(BaseModel):
    project: ProjectResponse
    submissions: List[StaffProjectSubmissionItem] = []
    results: List[StaffProjectResultItem] = []
    rounds: List[ApprovedRoundInfo] = []
