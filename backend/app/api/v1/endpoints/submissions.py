from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, get_current_student
from app.models.user import User
from app.models.project import Project
from app.models.group import GroupMembership
from app.models.review import ReviewRound, Submission, SubmissionVersion
from app.schemas.submission import (
    SubmissionVersionCreate,
    SubmissionDraftUpdate,
    SubmissionVersionResponse,
    SubmissionResponse,
)
from app.core.permissions import (
    can_access_project,
    can_submit_to_round,
    is_user_group_member,
)
from app.services.audit_service import log_audit
from app.core.config import settings
from app.core.cache import (
    cache,
    key_project_submissions,
    invalidate_project,
)

router = APIRouter()

def build_version_response(v: SubmissionVersion) -> SubmissionVersionResponse:
    return SubmissionVersionResponse(
        id=v.id,
        submission_id=v.submission_id,
        version_number=v.version_number,
        submitted_by=v.submitted_by,
        submitter_name=v.submitter.full_name if v.submitter else "Unknown",
        status=v.status,
        notes=v.notes,
        link=v.link,
        github_commit_sha=v.github_commit_sha,
        is_late=v.is_late,
        submitted_at=v.submitted_at,
        roster_snapshot=v.roster_snapshot or [],
        feedback=v.review.feedback if v.review else None,
        created_at=v.created_at
    )

def build_submission_response(s: Submission) -> SubmissionResponse:
    version_responses = [build_version_response(v) for v in s.versions]
    latest = version_responses[-1] if version_responses else None
    return SubmissionResponse(
        id=s.id,
        project_id=s.project_id,
        round_id=s.round_id,
        round_title=s.round.title if s.round else f"Round #{s.round_id}",
        max_score=float(s.round.max_score) if s.round else 100.0,
        is_round_open=s.round.is_open if s.round else False,
        versions=version_responses,
        latest_version=latest
    )

@router.get("/projects/{project_id}/submissions", response_model=List[SubmissionResponse])
def list_project_submissions(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all submissions and version histories for a project.
    Accessible to current group members and workspace staff.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project or not can_access_project(db, current_user.id, project):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or access denied."
        )

    submissions_cache_key = key_project_submissions(project_id)
    cached = cache.get(submissions_cache_key)
    if cached is not None:
        return cached

    submissions = (
        db.query(Submission)
        .filter(Submission.project_id == project.id)
        .all()
    )
    result = [build_submission_response(s).model_dump(mode="json") for s in submissions]
    cache.set(
        submissions_cache_key,
        result,
        ttl=settings.CACHE_DEFAULT_TTL,
        tags=[f"project:{project_id}", f"workspace:{project.workspace_id}"]
    )
    return result

@router.post("/projects/{project_id}/rounds/{round_id}/submissions", response_model=SubmissionResponse, status_code=status.HTTP_201_CREATED)
@router.post("/projects/{project_id}/submissions/{round_id}", response_model=SubmissionResponse, status_code=status.HTTP_201_CREATED)
def submit_round_deliverable(
    project_id: int,
    round_id: int,
    sub_in: SubmissionVersionCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_student: User = Depends(get_current_student)
):
    """
    Create a submission deliverable (Draft or Submitted).
    - Checks group size >= 2.
    - Checks round is open and workspace is active.
    - If submitted: freezes immutable roster snapshot of current group members.
    - Detects late submissions (submitted_at > round.due_date).
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    allowed, reason, group = can_submit_to_round(db, current_student.id, project, round_id)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=reason or "Submission disallowed."
        )

    round_obj = db.query(ReviewRound).filter(ReviewRound.id == round_id).first()

    # Find or create root Submission entity
    submission = (
        db.query(Submission)
        .filter(Submission.project_id == project.id, Submission.round_id == round_id)
        .first()
    )
    if not submission:
        submission = Submission(project_id=project.id, round_id=round_id)
        db.add(submission)
        db.flush()

    # Determine version number
    current_versions = db.query(SubmissionVersion).filter(SubmissionVersion.submission_id == submission.id).count()
    version_num = current_versions + 1

    now = datetime.now(timezone.utc)
    if sub_in.is_draft:
        status_val = "DRAFT"
        submitted_at_val = None
        is_late_val = False
        roster_snapshot_val = []
    else:
        status_val = "SUBMITTED"
        submitted_at_val = now
        is_late_val = (now > round_obj.due_date) if round_obj.due_date else False
        # Snapshot current group members
        memberships = (
            db.query(GroupMembership)
            .filter(GroupMembership.group_id == group.id)
            .all()
        )
        roster_snapshot_val = [
            {"user_id": m.user.id, "full_name": m.user.full_name, "email": m.user.email}
            for m in memberships if m.user
        ]

    version = SubmissionVersion(
        submission_id=submission.id,
        version_number=version_num,
        submitted_by=current_student.id,
        status=status_val,
        notes=sub_in.notes.strip() if sub_in.notes else None,
        link=sub_in.link.strip() if sub_in.link else None,
        github_commit_sha=sub_in.github_commit_sha.strip() if sub_in.github_commit_sha else None,
        is_late=is_late_val,
        submitted_at=submitted_at_val,
        roster_snapshot=roster_snapshot_val
    )
    db.add(version)
    db.flush()

    client_ip = request.client.host if request.client else None
    log_audit(
        db=db,
        actor_id=current_student.id,
        action_type="SUBMISSION_SUBMITTED" if not sub_in.is_draft else "SUBMISSION_DRAFT_CREATED",
        entity_type="SUBMISSION_VERSION",
        entity_id=version.id,
        workspace_id=project.workspace_id,
        new_value={
            "submission_id": submission.id,
            "version": version.version_number,
            "status": version.status,
            "is_late": version.is_late,
            "roster_count": len(roster_snapshot_val)
        },
        ip_address=client_ip
    )

    db.commit()
    invalidate_project(project.id, project.workspace_id)
    cache.invalidate_prefix("review:queue")
    db.refresh(submission)

    return build_submission_response(submission)

@router.patch("/submissions/{submission_id}/draft", response_model=SubmissionResponse)
def update_draft_submission(
    submission_id: int,
    draft_in: SubmissionDraftUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_student: User = Depends(get_current_student)
):
    """
    Update a draft submission before final submission.
    Submitted versions are immutable and cannot be updated.
    """
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")

    if not is_user_group_member(db, current_student.id, submission.project.group_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Access denied.")

    latest_version = (
        db.query(SubmissionVersion)
        .filter(SubmissionVersion.submission_id == submission.id)
        .order_by(SubmissionVersion.version_number.desc())
        .first()
    )
    if not latest_version or latest_version.status != "DRAFT":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active editable draft found. Submitted versions are immutable."
        )

    if draft_in.notes is not None:
        latest_version.notes = draft_in.notes.strip()
    if draft_in.link is not None:
        latest_version.link = draft_in.link.strip()
    if draft_in.github_commit_sha is not None:
        latest_version.github_commit_sha = draft_in.github_commit_sha.strip()

    db.commit()
    invalidate_project(submission.project_id, submission.project.workspace_id)
    db.refresh(submission)
    return build_submission_response(submission)

@router.post("/submissions/{submission_id}/submit", response_model=SubmissionResponse)
def finalize_draft_submission(
    submission_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_student: User = Depends(get_current_student)
):
    """
    Finalize a draft submission into SUBMITTED status.
    Freezes immutable roster snapshot of active group members.
    """
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")

    allowed, reason, group = can_submit_to_round(db, current_student.id, submission.project, submission.round_id)
    if not allowed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=reason or "Submission disallowed.")

    latest_version = (
        db.query(SubmissionVersion)
        .filter(SubmissionVersion.submission_id == submission.id)
        .order_by(SubmissionVersion.version_number.desc())
        .first()
    )
    if not latest_version or latest_version.status != "DRAFT":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No draft version found to submit."
        )

    now = datetime.now(timezone.utc)
    round_obj = submission.round

    # Freeze snapshot
    memberships = db.query(GroupMembership).filter(GroupMembership.group_id == group.id).all()
    roster_snapshot_val = [
        {"user_id": m.user.id, "full_name": m.user.full_name, "email": m.user.email}
        for m in memberships if m.user
    ]

    latest_version.status = "SUBMITTED"
    latest_version.submitted_at = now
    latest_version.is_late = (now > round_obj.due_date) if round_obj and round_obj.due_date else False
    latest_version.roster_snapshot = roster_snapshot_val
    latest_version.submitted_by = current_student.id

    client_ip = request.client.host if request.client else None
    log_audit(
        db=db,
        actor_id=current_student.id,
        action_type="SUBMISSION_SUBMITTED",
        entity_type="SUBMISSION_VERSION",
        entity_id=latest_version.id,
        workspace_id=submission.project.workspace_id,
        new_value={
            "submission_id": submission.id,
            "version": latest_version.version_number,
            "is_late": latest_version.is_late,
            "roster_count": len(roster_snapshot_val)
        },
        ip_address=client_ip
    )

    db.commit()
    invalidate_project(submission.project_id, submission.project.workspace_id)
    cache.invalidate_prefix("review:queue")
    db.refresh(submission)
    return build_submission_response(submission)
