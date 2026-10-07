from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

class QueueItemResponse(BaseModel):
    version_id: int
    submission_id: int
    project_id: int
    project_name: str
    workspace_id: str
    workspace_name: str
    round_id: int
    round_title: str
    round_due_date: datetime
    version_number: int
    status: str
    submitted_by: int
    submitter_name: Optional[str] = None
    submitted_at: Optional[datetime] = None
    claimed_by_id: Optional[int] = None
    claimed_by_name: Optional[str] = None
    is_late: bool
    roster_snapshot: List[Dict[str, Any]] = []

    model_config = ConfigDict(from_attributes=True)

class StudentScoreInput(BaseModel):
    user_id: int
    score: float = Field(..., ge=0.0)

class ReviewEvaluationInput(BaseModel):
    verdict: str = Field(..., description="'APPROVED' or 'REVISION_REQUESTED'")
    feedback: str = Field(..., min_length=1)
    student_scores: Optional[List[StudentScoreInput]] = None

class ReviewEvaluationResponse(BaseModel):
    version_id: int
    status: str
    verdict: str
    feedback: Optional[str] = None
    scores: List[Dict[str, Any]] = []
