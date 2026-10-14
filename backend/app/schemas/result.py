from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict

# --- EXISTING SCHEMAS (STUDENT / CORRECTION) ---

class StudentResultResponse(BaseModel):
    id: int
    round_id: int
    round_title: str
    round_order: int
    workspace_id: str
    workspace_name: str
    score: float
    max_score: float
    percentage: float
    released_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class StudentResultsSummary(BaseModel):
    total_earned: float
    total_possible: float
    cumulative_percentage: float
    results: list[StudentResultResponse] = []

class ResultCorrectionCreate(BaseModel):
    new_score: float
    reason: str

class ResultCorrectionResponse(BaseModel):
    id: int
    result_entry_id: int
    corrected_by_id: int
    corrected_by_name: Optional[str] = None
    old_score: float
    new_score: float
    reason: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- DEDICATED RESULTS SECTION SCHEMAS ---

class RoundColumnHeader(BaseModel):
    id: int
    title: str
    order_index: int
    max_score: float
    is_open: bool
    weight: Optional[float] = 20.0

class StudentRoundScoreDetail(BaseModel):
    round_id: int
    round_title: str
    score: Optional[float] = None
    max_score: float
    percentage: Optional[float] = None
    feedback: Optional[str] = None
    reviewer_id: Optional[int] = None
    reviewer_name: Optional[str] = None
    review_date: Optional[datetime] = None
    status: str  # "GRADED", "SUBMITTED", "IN_REVIEW", "REVISION_REQUESTED", "MISSING", "NOT_SUBMITTED"
    result_entry_id: Optional[int] = None

class WorkspaceStudentResultItem(BaseModel):
    student_id: int
    student_name: str
    student_email: str
    roll_number: str
    group_id: int
    group_number: Optional[int] = None
    group_name: str
    group_code: str
    project_id: Optional[int] = None
    project_topic: str
    rounds: Dict[str, StudentRoundScoreDetail] = {}
    total_marks: float
    max_marks: float
    percentage: float
    review_completion_status: str  # "COMPLETED", "IN_PROGRESS", "PENDING"
    final_result_status: str  # "PASSED", "FAILED", "INCOMPLETE", "PENDING"

class WorkspaceResultsSummaryStats(BaseModel):
    total_students: int
    total_groups: int
    completed_students: int
    average_percentage: float
    pass_rate: float

class WorkspaceResultsResponse(BaseModel):
    workspace_id: str
    workspace_name: str
    rounds: List[RoundColumnHeader]
    students: List[WorkspaceStudentResultItem]
    summary: WorkspaceResultsSummaryStats
