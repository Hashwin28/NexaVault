from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_student, get_current_staff
from app.models.user import User
from app.models.review import ResultEntry, ReviewRound, ResultCorrection
from app.schemas.result import (
    StudentResultResponse,
    StudentResultsSummary,
    ResultCorrectionCreate,
    ResultCorrectionResponse,
)
from app.core.permissions import can_correct_result
from app.services.audit_service import log_audit
from app.core.cache import cache, key_results_me, invalidate_results

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
    c_key = key_results_me(current_student.id)
    cached = cache.get(c_key)
    if cached is not None:
        return StudentResultsSummary(**cached)

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

    summary = StudentResultsSummary(
        total_earned=round(total_earned, 2),
        total_possible=round(total_possible, 2),
        cumulative_percentage=round(cumulative_pct, 2),
        results=results_list
    )
    cache.set(c_key, summary.model_dump(), ttl=60, tags=[f"user:{current_student.id}:results", f"results:{current_student.id}"])
    return summary

@router.patch("/{entry_id}/correct", response_model=ResultCorrectionResponse)
def correct_result_score(
    entry_id: int,
    payload: ResultCorrectionCreate,
    db: Session = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
):
    """
    Staff corrects an already-approved score.
    Old score, new score, and reason are recorded in the audit log and ResultCorrection table.
    """
    if not can_correct_result(db, current_staff.id, entry_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Result entry not found or access denied."
        )

    entry = db.query(ResultEntry).filter(ResultEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Result entry not found.")

    round_obj = entry.round
    max_score = float(round_obj.max_score) if round_obj else 100.0

    if payload.new_score < 0 or payload.new_score > max_score:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"New score {payload.new_score} is out of valid range (0 <= score <= {max_score})."
        )

    old_score_val = float(entry.score)

    correction = ResultCorrection(
        result_entry_id=entry.id,
        corrected_by_id=current_staff.id,
        old_score=old_score_val,
        new_score=payload.new_score,
        reason=payload.reason,
    )
    db.add(correction)

    entry.score = payload.new_score

    ws_id = round_obj.workspace_id if round_obj else None

    log_audit(
        db=db,
        actor_id=current_staff.id,
        action_type="score_corrected",
        entity_type="result_entry",
        entity_id=entry.id,
        workspace_id=ws_id,
        old_value={"score": old_score_val},
        new_value={"score": payload.new_score, "reason": payload.reason},
    )

    db.commit()
    db.refresh(correction)
    invalidate_results(entry.student_id)
    cache.invalidate_prefix("project:progress:")

    return ResultCorrectionResponse(
        id=correction.id,
        result_entry_id=correction.result_entry_id,
        corrected_by_id=correction.corrected_by_id,
        corrected_by_name=current_staff.full_name,
        old_score=float(correction.old_score),
        new_score=float(correction.new_score),
        reason=correction.reason,
        created_at=correction.created_at,
    )
