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
