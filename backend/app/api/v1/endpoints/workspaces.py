from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_student
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceGroup, WorkspaceNotice
from app.models.review import ReviewRound
from app.models.project import Project
from app.schemas.workspace import (
    WorkspaceStudentResponse,
    WorkspaceNoticeResponse,
    ReviewRoundResponse,
)
from app.core.permissions import get_user_active_group, can_access_workspace

router = APIRouter()

@router.get("/", response_model=List[WorkspaceStudentResponse])
def list_my_enrolled_workspaces(
    db: Session = Depends(get_db),
    current_student: User = Depends(get_current_student)
):
    """
    List all Workspaces that the student's active Group is enrolled in.
    Returns empty list if the student has no active group or no enrollments.
    """
    active_group = get_user_active_group(db, current_student.id)
    if not active_group:
        return []

    enrollments = (
        db.query(WorkspaceGroup)
        .join(Workspace, WorkspaceGroup.workspace_id == Workspace.id)
        .filter(WorkspaceGroup.group_id == active_group.id, Workspace.is_archived == False)
        .order_by(WorkspaceGroup.enrolled_at.desc())
        .all()
    )

    results = []
    for enr in enrollments:
        ws = enr.workspace
        # Check if project exists for this group in this workspace
        project = (
            db.query(Project)
            .filter(Project.workspace_id == ws.id, Project.group_id == active_group.id)
            .first()
        )
        
        # Load active notices
        notices = (
            db.query(WorkspaceNotice)
            .filter(WorkspaceNotice.workspace_id == ws.id, WorkspaceNotice.is_archived == False)
            .order_by(WorkspaceNotice.is_pinned.desc(), WorkspaceNotice.created_at.desc())
            .all()
        )
        notice_responses = [
            WorkspaceNoticeResponse(
                id=n.id,
                workspace_id=n.workspace_id,
                title=n.title,
                body=n.body,
                image_url=n.image_url,
                is_pinned=n.is_pinned,
                created_at=n.created_at,
                author_name=n.author.full_name if n.author else "Staff"
            )
            for n in notices
        ]

        # Load review rounds
        rounds = (
            db.query(ReviewRound)
            .filter(ReviewRound.workspace_id == ws.id)
            .order_by(ReviewRound.order_index.asc())
            .all()
        )
        round_responses = [
            ReviewRoundResponse(
                id=r.id,
                workspace_id=r.workspace_id,
                title=r.title,
                description=r.description,
                order_index=r.order_index,
                due_date=r.due_date,
                max_score=float(r.max_score),
                is_open=r.is_open,
                created_at=r.created_at
            )
            for r in rounds
        ]

        results.append(
            WorkspaceStudentResponse(
                id=ws.id,
                name=ws.name,
                description=ws.description,
                term=ws.term,
                is_open=ws.is_open,
                created_at=ws.created_at,
                enrolled_at=enr.enrolled_at,
                has_project=project is not None,
                project_id=project.id if project else None,
                notices=notice_responses,
                review_rounds=round_responses
            )
        )

    return results

@router.get("/{workspace_id}", response_model=WorkspaceStudentResponse)
def get_enrolled_workspace_details(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_student: User = Depends(get_current_student)
):
    """
    Get detailed student view of an enrolled workspace.
    Unauthorized workspaces return 404.
    """
    if not can_access_workspace(db, current_student.id, workspace_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied."
        )

    ws = db.query(Workspace).filter(Workspace.id == workspace_id, Workspace.is_archived == False).first()
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")

    active_group = get_user_active_group(db, current_student.id)
    enrollment = (
        db.query(WorkspaceGroup)
        .filter(WorkspaceGroup.workspace_id == ws.id, WorkspaceGroup.group_id == active_group.id)
        .first() if active_group else None
    )

    project = (
        db.query(Project)
        .filter(Project.workspace_id == ws.id, Project.group_id == active_group.id)
        .first() if active_group else None
    )

    notices = (
        db.query(WorkspaceNotice)
        .filter(WorkspaceNotice.workspace_id == ws.id, WorkspaceNotice.is_archived == False)
        .order_by(WorkspaceNotice.is_pinned.desc(), WorkspaceNotice.created_at.desc())
        .all()
    )
    notice_responses = [
        WorkspaceNoticeResponse(
            id=n.id,
            workspace_id=n.workspace_id,
            title=n.title,
            body=n.body,
            image_url=n.image_url,
            is_pinned=n.is_pinned,
            created_at=n.created_at,
            author_name=n.author.full_name if n.author else "Staff"
        )
        for n in notices
    ]

    rounds = (
        db.query(ReviewRound)
        .filter(ReviewRound.workspace_id == ws.id)
        .order_by(ReviewRound.order_index.asc())
        .all()
    )
    round_responses = [
        ReviewRoundResponse(
            id=r.id,
            workspace_id=r.workspace_id,
            title=r.title,
            description=r.description,
            order_index=r.order_index,
            due_date=r.due_date,
            max_score=float(r.max_score),
            is_open=r.is_open,
            created_at=r.created_at
        )
        for r in rounds
    ]

    return WorkspaceStudentResponse(
        id=ws.id,
        name=ws.name,
        description=ws.description,
        term=ws.term,
        is_open=ws.is_open,
        created_at=ws.created_at,
        enrolled_at=enrollment.enrolled_at if enrollment else None,
        has_project=project is not None,
        project_id=project.id if project else None,
        notices=notice_responses,
        review_rounds=round_responses
    )

@router.get("/{workspace_id}/notices", response_model=List[WorkspaceNoticeResponse])
def get_workspace_notices(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_student: User = Depends(get_current_student)
):
    """Get active notices for an enrolled workspace."""
    if not can_access_workspace(db, current_student.id, workspace_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied."
        )

    notices = (
        db.query(WorkspaceNotice)
        .filter(WorkspaceNotice.workspace_id == workspace_id, WorkspaceNotice.is_archived == False)
        .order_by(WorkspaceNotice.is_pinned.desc(), WorkspaceNotice.created_at.desc())
        .all()
    )
    return [
        WorkspaceNoticeResponse(
            id=n.id,
            workspace_id=n.workspace_id,
            title=n.title,
            body=n.body,
            image_url=n.image_url,
            is_pinned=n.is_pinned,
            created_at=n.created_at,
            author_name=n.author.full_name if n.author else "Staff"
        )
        for n in notices
    ]

@router.get("/{workspace_id}/rounds", response_model=List[ReviewRoundResponse])
def get_workspace_review_rounds(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_student: User = Depends(get_current_student)
):
    """Get review rounds list for an enrolled workspace."""
    if not can_access_workspace(db, current_student.id, workspace_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied."
        )

    rounds = (
        db.query(ReviewRound)
        .filter(ReviewRound.workspace_id == workspace_id)
        .order_by(ReviewRound.order_index.asc())
        .all()
    )
    return [
        ReviewRoundResponse(
            id=r.id,
            workspace_id=r.workspace_id,
            title=r.title,
            description=r.description,
            order_index=r.order_index,
            due_date=r.due_date,
            max_score=float(r.max_score),
            is_open=r.is_open,
            created_at=r.created_at
        )
        for r in rounds
    ]
