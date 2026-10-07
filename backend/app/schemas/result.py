from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

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
