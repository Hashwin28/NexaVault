from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import asc
from app.api.deps import get_db, get_current_staff
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceStaff
from app.models.project import Project
from app.models.group import Group, GroupMembership
from app.models.review import ReviewRound, Submission, SubmissionVersion, Review, ResultEntry
from app.schemas.review import (
    QueueItemResponse,
    ReviewEvaluationInput,
    ReviewEvaluationResponse,
)
from app.core.permissions import can_review_submission, is_workspace_staff
from app.services.audit_service import log_audit
from app.core.cache import (
    cache,
    key_review_queue,
    invalidate_project,
    invalidate_results,
    invalidate_workspace,
)

router = APIRouter(prefix="/reviews", tags=["Reviews"])

@router.get("/queue", response_model=List[QueueItemResponse])
def get_review_queue(
    limit: int = Query(50, ge=1, le=100, description="Maximum number of queue items to return"),
    offset: int = Query(0, ge=0, description="Queue pagination offset"),
    db: Session = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
):
    """
    Staff review queue across workspaces the staff is authorized to manage.
    Ordered by: 1. Review Round due_date asc; 2. Submission creation/submission time asc.
    Applies DB-level limit and offset pagination.
    """
    c_key = key_review_queue(current_staff.id, limit, offset)
    cached = cache.get(c_key)
    if cached is not None:
        return [QueueItemResponse(**x) for x in cached]

    staff_entries = db.query(WorkspaceStaff).filter(WorkspaceStaff.user_id == current_staff.id).all()
    ws_ids = {s.workspace_id for s in staff_entries}
    owned = db.query(Workspace).filter(Workspace.owner_id == current_staff.id).all()
    for o in owned:
        ws_ids.add(o.id)

    if not ws_ids:
        return []

    # Query pending versions
    versions = (
        db.query(SubmissionVersion)
        .join(Submission, SubmissionVersion.submission_id == Submission.id)
        .join(Project, Submission.project_id == Project.id)
        .join(ReviewRound, Submission.round_id == ReviewRound.id)
        .filter(
            Project.workspace_id.in_(ws_ids),
            SubmissionVersion.status.in_(["SUBMITTED", "IN_REVIEW", "NEW_SUBMISSION"]),
        )
        .order_by(asc(ReviewRound.due_date), asc(SubmissionVersion.submitted_at), asc(SubmissionVersion.created_at))
        .offset(offset)
        .limit(limit)
        .all()
    )

    result = []
    for ver in versions:
        sub = ver.submission
        proj = sub.project
        round_obj = sub.round
        workspace = proj.workspace

        submitter_name = ver.submitter.full_name if ver.submitter else None
        claimed_name = ver.claimed_by.full_name if ver.claimed_by else None

        result.append(
            QueueItemResponse(
                version_id=ver.id,
                submission_id=sub.id,
                project_id=proj.id,
                project_name=proj.name,
                workspace_id=workspace.id,
                workspace_name=workspace.name,
                round_id=round_obj.id,
                round_title=round_obj.title,
                round_due_date=round_obj.due_date,
                round_max_score=float(round_obj.max_score) if round_obj and round_obj.max_score is not None else 100.0,
                version_number=ver.version_number,
                status=ver.status,
                submitted_by=ver.submitted_by,
                submitter_name=submitter_name,
                submitted_at=ver.submitted_at,
                claimed_by_id=ver.claimed_by_id,
                claimed_by_name=claimed_name,
                is_late=ver.is_late,
                roster_snapshot=ver.roster_snapshot or [],
            )
        )

    cache.set(c_key, [r.model_dump() for r in result], ttl=30, tags=["review:queue"])
    return result

@router.post("/{version_id}/claim")
def claim_submission(
    version_id: int,
    db: Session = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
):
    """
    Staff claims a submission version for review using PostgreSQL row-level locking.
    """
    if not can_review_submission(db, current_staff.id, version_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission version not found or access denied."
        )

    # Row-level lock on PostgreSQL
    version = (
        db.query(SubmissionVersion)
        .filter(SubmissionVersion.id == version_id)
        .with_for_update(skip_locked=True)
        .first()
    )

    if not version:
        # Check if version exists or was locked/claimed by another process
        existing = db.query(SubmissionVersion).filter(SubmissionVersion.id == version_id).first()
        if existing and existing.claimed_by_id and existing.claimed_by_id != current_staff.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Submission version already claimed by staff user #{existing.claimed_by_id}."
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission version not found or lock unavailable."
        )

    if version.claimed_by_id and version.claimed_by_id != current_staff.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Submission version already claimed by staff user #{version.claimed_by_id}."
        )

    version.claimed_by_id = current_staff.id
    version.status = "IN_REVIEW"

    # Create/update review record
    review = db.query(Review).filter(Review.submission_version_id == version_id).first()
    if not review:
        review = Review(
            submission_version_id=version_id,
            reviewer_id=current_staff.id,
            status="IN_REVIEW",
            claimed_at=datetime.now(timezone.utc),
        )
        db.add(review)
    else:
        review.reviewer_id = current_staff.id
        review.status = "IN_REVIEW"
        review.claimed_at = datetime.now(timezone.utc)

    proj = version.submission.project

    log_audit(
        db=db,
        actor_id=current_staff.id,
        action_type="submission_claimed",
        entity_type="submission_version",
        entity_id=version.id,
        workspace_id=proj.workspace_id,
    )

    db.commit()
    db.refresh(version)
    cache.invalidate_prefix("review:queue")

    return {"message": f"Submission version {version_id} claimed successfully.", "version_id": version_id, "claimed_by": current_staff.id}

@router.post("/{version_id}/release-claim")
def release_submission_claim(
    version_id: int,
    db: Session = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
):
    """
    Staff releases claim on a submission version.
    """
    if not can_review_submission(db, current_staff.id, version_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission version not found or access denied."
        )

    version = db.query(SubmissionVersion).filter(SubmissionVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission version not found.")

    version.claimed_by_id = None
    if version.status == "IN_REVIEW":
        version.status = "SUBMITTED"

    review = db.query(Review).filter(Review.submission_version_id == version_id).first()
    if review:
        review.status = "NEW_SUBMISSION"
        review.reviewer_id = None

    proj = version.submission.project

    log_audit(
        db=db,
        actor_id=current_staff.id,
        action_type="submission_claim_released",
        entity_type="submission_version",
        entity_id=version.id,
        workspace_id=proj.workspace_id,
    )

    db.commit()
    cache.invalidate_prefix("review:queue")
    return {"message": f"Claim released for submission version {version_id}."}

@router.post("/{version_id}/evaluate", response_model=ReviewEvaluationResponse)
def evaluate_submission(
    version_id: int,
    payload: ReviewEvaluationInput,
    db: Session = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
):
    """
    Staff evaluates a submission version.
    Verdict: 'APPROVED' or 'REVISION_REQUESTED'.
    If APPROVED: score MUST be provided for EVERY student in roster_snapshot!
    """
    if not can_review_submission(db, current_staff.id, version_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission version not found or access denied."
        )

    version = db.query(SubmissionVersion).filter(SubmissionVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission version not found.")

    verdict = payload.verdict.upper()
    if verdict not in ["APPROVED", "REVISION_REQUESTED"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verdict must be 'APPROVED' or 'REVISION_REQUESTED'."
        )

    submission = version.submission
    round_obj = submission.round
    max_score = float(round_obj.max_score)
    proj = submission.project

    review = db.query(Review).filter(Review.submission_version_id == version_id).first()
    if not review:
        review = Review(
            submission_version_id=version_id,
            reviewer_id=current_staff.id,
            status=verdict,
            feedback=payload.feedback,
            completed_at=datetime.now(timezone.utc),
        )
        db.add(review)
        db.flush()
    else:
        review.reviewer_id = current_staff.id
        review.status = verdict
        review.feedback = payload.feedback
        review.completed_at = datetime.now(timezone.utc)

    created_scores = []

    if verdict == "APPROVED":
        # Check roster
        roster = version.roster_snapshot or []
        roster_user_ids = {item.get("id") or item.get("user_id") for item in roster if item.get("id") or item.get("user_id")}
        
        # If roster empty, fallback to project members
        if not roster_user_ids:
            memberships = db.query(GroupMembership).filter(GroupMembership.group_id == proj.group_id).all()
            roster_user_ids = {m.user_id for m in memberships}

        scores_input = payload.student_scores or []
        submitted_user_ids = {s.user_id for s in scores_input}

        if roster_user_ids and submitted_user_ids != roster_user_ids:
            missing = roster_user_ids - submitted_user_ids
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Individual scores must be provided for every roster member. Missing student IDs: {list(missing)}"
            )

        for s_in in scores_input:
            if s_in.score < 0 or s_in.score > max_score:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Score {s_in.score} for user {s_in.user_id} is out of range (0 <= score <= {max_score})."
                )

            # Check if result entry exists
            existing_result = (
                db.query(ResultEntry)
                .filter(ResultEntry.review_id == review.id, ResultEntry.student_id == s_in.user_id)
                .first()
            )
            if existing_result:
                existing_result.score = s_in.score
                existing_result.feedback = s_in.feedback or payload.feedback
            else:
                res_entry = ResultEntry(
                    review_id=review.id,
                    student_id=s_in.user_id,
                    round_id=round_obj.id,
                    score=s_in.score,
                    feedback=s_in.feedback or payload.feedback,
                    is_released=False,
                )
                db.add(res_entry)

            created_scores.append({"student_id": s_in.user_id, "score": s_in.score, "feedback": s_in.feedback or payload.feedback})

        version.status = "APPROVED"

        log_audit(
            db=db,
            actor_id=current_staff.id,
            action_type="review_completed",
            entity_type="review",
            entity_id=review.id,
            workspace_id=proj.workspace_id,
            new_value={"verdict": "APPROVED", "scores": created_scores},
        )
        log_audit(
            db=db,
            actor_id=current_staff.id,
            action_type="score_entered",
            entity_type="submission_version",
            entity_id=version.id,
            workspace_id=proj.workspace_id,
            new_value={"scores": created_scores},
        )
    else:
        # REVISION_REQUESTED
        version.status = "REVISION_REQUESTED"
        log_audit(
            db=db,
            actor_id=current_staff.id,
            action_type="revision_requested",
            entity_type="review",
            entity_id=review.id,
            workspace_id=proj.workspace_id,
            new_value={"verdict": "REVISION_REQUESTED", "feedback": payload.feedback},
        )

    db.commit()
    db.refresh(version)
    cache.invalidate_prefix("review:queue")
    invalidate_project(proj.id, proj.workspace_id)
    invalidate_results()
    cache.invalidate_prefix("project:progress:")

    return ReviewEvaluationResponse(
        version_id=version.id,
        status=version.status,
        verdict=verdict,
        feedback=payload.feedback,
        scores=created_scores,
    )

@router.post("/{version_id}/release-results", status_code=status.HTTP_200_OK)
def release_results(
    version_id: int,
    db: Session = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
):
    """
    Staff explicitly releases results for a evaluated submission version.
    """
    if not can_review_submission(db, current_staff.id, version_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission version not found or access denied."
        )

    version = db.query(SubmissionVersion).filter(SubmissionVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission version not found.")

    review = db.query(Review).filter(Review.submission_version_id == version_id).first()
    if not review:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Submission version has not been evaluated yet."
        )

    entries = db.query(ResultEntry).filter(ResultEntry.review_id == review.id).all()
    if not entries:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No result entries found to release for this submission version."
        )

    now = datetime.now(timezone.utc)
    for entry in entries:
        entry.is_released = True
        entry.released_at = now

    proj = version.submission.project

    log_audit(
        db=db,
        actor_id=current_staff.id,
        action_type="results_released",
        entity_type="review",
        entity_id=review.id,
        workspace_id=proj.workspace_id,
        new_value={"released_count": len(entries)},
    )

    db.commit()
    invalidate_results()
    cache.invalidate_prefix("project:progress:")
    invalidate_workspace(proj.workspace_id)
    return {"message": f"Results for submission version {version_id} released successfully.", "released_count": len(entries)}
