from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, String
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceStaff, WorkspaceGroup
from app.models.group import Group, GroupMembership
from app.models.project import Project
from app.models.review import Submission, SubmissionVersion
from app.schemas.search import SmartSearchResponse
from app.core.permissions import get_user_active_group

router = APIRouter(prefix="/search", tags=["Smart Search"])

@router.get("", response_model=SmartSearchResponse)
@router.get("/", response_model=SmartSearchResponse)
def smart_search(
    q: str = Query(..., min_length=1, description="Search term"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Role-isolated Smart Search.
    - For Staff: searches across managed workspaces, enrolled groups, projects, deliverables, and student roster.
    - For Students: scopes strictly to current group, enrolled workspaces, projects, and deliverables.
    - Excludes Group Codes and Workspace IDs from searchable text and responses.
    - Safe limit of 50 items per category.
    """
    term = f"%{q.strip()}%"

    if current_user.role.lower() == "staff":
        # Find authorized workspaces for this staff member
        staff_entries = db.query(WorkspaceStaff).filter(WorkspaceStaff.user_id == current_user.id).all()
        ws_ids = {s.workspace_id for s in staff_entries}
        owned = db.query(Workspace).filter(Workspace.owner_id == current_user.id).all()
        for o in owned:
            ws_ids.add(o.id)

        if not ws_ids:
            return SmartSearchResponse(
                query=q,
                workspaces=[],
                groups=[],
                projects=[],
                submissions=[],
                students=[],
            )

        # 1. Search Workspaces (name, description, term) - excludes Workspace IDs (max 50)
        workspaces = (
            db.query(Workspace)
            .filter(
                Workspace.id.in_(ws_ids),
                or_(
                    Workspace.name.ilike(term),
                    Workspace.description.ilike(term),
                    Workspace.term.ilike(term),
                )
            )
            .limit(50)
            .all()
        )
        ws_results = [
            {"id": w.id, "name": w.name, "description": w.description, "term": w.term}
            for w in workspaces
        ]

        # 2. Search Groups enrolled in managed workspaces (name ONLY - excludes code) (max 50)
        groups = (
            db.query(Group)
            .join(WorkspaceGroup, WorkspaceGroup.group_id == Group.id)
            .filter(
                WorkspaceGroup.workspace_id.in_(ws_ids),
                Group.is_deleted == False,
                Group.name.ilike(term),
            )
            .limit(50)
            .all()
        )
        group_results = [
            {"id": g.id, "name": g.name}
            for g in groups
        ]

        # 3. Search Projects in managed workspaces (name, description) (max 50)
        projects = (
            db.query(Project)
            .filter(
                Project.workspace_id.in_(ws_ids),
                or_(
                    Project.name.ilike(term),
                    Project.description.ilike(term),
                )
            )
            .limit(50)
            .all()
        )
        project_results = [
            {"id": p.id, "name": p.name, "description": p.description, "workspace_id": p.workspace_id}
            for p in projects
        ]

        # 4. Search Submissions / Deliverables in managed workspaces (max 50)
        versions = (
            db.query(SubmissionVersion)
            .join(Submission, SubmissionVersion.submission_id == Submission.id)
            .join(Project, Submission.project_id == Project.id)
            .filter(
                Project.workspace_id.in_(ws_ids),
                or_(
                    SubmissionVersion.notes.ilike(term),
                    SubmissionVersion.link.ilike(term),
                    SubmissionVersion.github_commit_sha.ilike(term),
                )
            )
            .limit(50)
            .all()
        )
        submission_results = [
            {
                "version_id": v.id,
                "submission_id": v.submission_id,
                "version_number": v.version_number,
                "status": v.status,
                "notes": v.notes,
                "link": v.link,
                "github_commit_sha": v.github_commit_sha,
                "workspace_id": v.submission.project.workspace_id if v.submission and v.submission.project else None,
            }
            for v in versions
        ]

        # 5. Search Enrolled Students (full_name, email) (max 50)
        students = (
            db.query(User)
            .join(GroupMembership, GroupMembership.user_id == User.id)
            .join(Group, GroupMembership.group_id == Group.id)
            .join(WorkspaceGroup, WorkspaceGroup.group_id == Group.id)
            .filter(
                WorkspaceGroup.workspace_id.in_(ws_ids),
                User.role.ilike("student"),
                or_(
                    User.full_name.ilike(term),
                    User.email.ilike(term),
                )
            )
            .distinct()
            .limit(50)
            .all()
        )
        student_results = [
            {"id": s.id, "full_name": s.full_name, "email": s.email}
            for s in students
        ]

        return SmartSearchResponse(
            query=q,
            workspaces=ws_results,
            groups=group_results,
            projects=project_results,
            submissions=submission_results,
            students=student_results,
        )

    # Student Scoped Search
    active_group = get_user_active_group(db, current_user.id)
    if not active_group:
        return SmartSearchResponse(
            query=q,
            workspaces=[],
            groups=[],
            projects=[],
            submissions=[],
            students=[],
        )

    enrollments = db.query(WorkspaceGroup).filter(WorkspaceGroup.group_id == active_group.id).all()
    enrolled_ws_ids = {e.workspace_id for e in enrollments}

    # 1. Enrolled Workspaces matching query
    workspaces = (
        db.query(Workspace)
        .filter(
            Workspace.id.in_(enrolled_ws_ids),
            or_(
                Workspace.name.ilike(term),
                Workspace.description.ilike(term),
                Workspace.term.ilike(term),
            )
        )
        .limit(50)
        .all()
    )
    ws_results = [
        {"id": w.id, "name": w.name, "description": w.description, "term": w.term}
        for w in workspaces
    ]

    # 2. Current group matching query (name only, no code)
    group_results = []
    if q.strip().lower() in active_group.name.lower():
        group_results.append({"id": active_group.id, "name": active_group.name})

    # 3. Student's Projects
    projects = (
        db.query(Project)
        .filter(
            Project.group_id == active_group.id,
            or_(
                Project.name.ilike(term),
                Project.description.ilike(term),
            )
        )
        .limit(50)
        .all()
    )
    project_results = [
        {"id": p.id, "name": p.name, "description": p.description, "workspace_id": p.workspace_id}
        for p in projects
    ]

    # 4. Student's Submissions
    project_ids = {p.id for p in projects}
    if project_ids:
        versions = (
            db.query(SubmissionVersion)
            .join(Submission, SubmissionVersion.submission_id == Submission.id)
            .filter(
                Submission.project_id.in_(project_ids),
                or_(
                    SubmissionVersion.notes.ilike(term),
                    SubmissionVersion.link.ilike(term),
                    SubmissionVersion.github_commit_sha.ilike(term),
                )
            )
            .limit(50)
            .all()
        )
        submission_results = [
            {
                "version_id": v.id,
                "submission_id": v.submission_id,
                "version_number": v.version_number,
                "status": v.status,
                "notes": v.notes,
                "link": v.link,
                "github_commit_sha": v.github_commit_sha,
                "workspace_id": v.submission.project.workspace_id if v.submission and v.submission.project else None,
            }
            for v in versions
        ]
    else:
        submission_results = []

    return SmartSearchResponse(
        query=q,
        workspaces=ws_results,
        groups=group_results,
        projects=project_results,
        submissions=submission_results,
        students=[],  # Students cannot search student directory
    )
