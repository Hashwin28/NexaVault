from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_student
from app.models.user import User
from app.models.review import ResultEntry, ReviewRound
from app.schemas.result import StudentResultResponse, StudentResultsSummary

router = APIRouter()

@router.get("/me", response_model=StudentResultsSummary)
def get_my_released_results(
    db: Session = Depends(get_db),
    current_student: User = Depends(get_current_student)
):
    """
    Returns the student's individual released results across all past and present rounds.
    - Strictly filters `is_released == True`.
    - Unreleased marks and peer student scores are NEVER exposed.
    - Former group members retain access to their own historical released scores.
    """
    released_entries = (
        db.query(ResultEntry)
        .join(ReviewRound, ResultEntry.round_id == ReviewRound.id)
        .filter(ResultEntry.student_id == current_student.id, ResultEntry.is_released == True)
        .order_by(ReviewRound.order_index.asc(), ResultEntry.released_at.asc())
        .all()
    )

    results_list = []
    total_earned = 0.0
    total_possible = 0.0

    for entry in released_entries:
        round_obj = entry.round
        score_val = float(entry.score)
        max_val = float(round_obj.max_score) if round_obj else 100.0
        pct = (score_val / max_val * 100.0) if max_val > 0 else 0.0

        total_earned += score_val
        total_possible += max_val

        ws = round_obj.workspace if round_obj else None
        results_list.append(
            StudentResultResponse(
                id=entry.id,
                round_id=entry.round_id,
                round_title=round_obj.title if round_obj else f"Round #{entry.round_id}",
                round_order=round_obj.order_index if round_obj else 1,
                workspace_id=ws.id if ws else "UNKNOWN",
                workspace_name=ws.name if ws else "Workspace",
                score=score_val,
                max_score=max_val,
                percentage=round(pct, 2),
                released_at=entry.released_at
            )
        )

    cumulative_pct = (total_earned / total_possible * 100.0) if total_possible > 0 else 0.0

    return StudentResultsSummary(
        total_earned=round(total_earned, 2),
        total_possible=round(total_possible, 2),
        cumulative_percentage=round(cumulative_pct, 2),
        results=results_list
    )
