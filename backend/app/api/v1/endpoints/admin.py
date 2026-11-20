import os
import math
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Query, Header
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_

from app.api.deps import get_db, get_current_admin, get_optional_current_user
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceStaff, WorkspaceGroup, WorkspaceNotice
from app.models.group import Group, GroupMembership
from app.models.project import Project
from app.models.review import ReviewRound, Submission, SubmissionVersion, ResultEntry
from app.models.audit import AuditLog
from app.core.permissions import is_admin_for_workspace, get_admin_workspace_ids
from app.schemas.workspace import WorkspaceResponse, WorkspaceUpdate
from app.schemas.audit import (
    AuditEventResponse,
    AuditActivityPaginatedResponse,
    AuditStatsResponse,
    AuditFiltersResponse,
    AuditFilterOption,
)
from app.services.audit_service import log_audit
from app.core.cache import cache, invalidate_workspace
from app.core.security import hash_password

router = APIRouter(prefix="/admin", tags=["Administrator"])

# ---------------------------------------------------------------------------
# Inline Pydantic Schemas
# ---------------------------------------------------------------------------

class AdminUserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    department: Optional[str] = None
    is_active: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class AdminWorkspaceDetailResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    term: str
    department: Optional[str] = None
    owner_id: int
    owner_name: Optional[str] = None
    is_open: bool
    is_archived: bool
    created_at: datetime
    staff_count: int
    group_count: int
    project_count: int


class AdminProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    workspace_id: str
    workspace_name: Optional[str] = None
    group_id: int
    group_name: Optional[str] = None
    created_at: datetime
    custom_progress: Optional[float] = None
    submission_count: int
    has_github: bool


class AdminStaffDetailResponse(BaseModel):
    id: int
    email: str
    full_name: str
    department: Optional[str] = None
    is_active: bool
    created_at: datetime
    workspace_count: int
    workspaces: List[Dict[str, Any]]


class AdminStudentDetailResponse(BaseModel):
    id: int
    email: str
    full_name: str
    roll_number: Optional[str] = None
    department: Optional[str] = None
    is_active: bool
    created_at: datetime
    group_id: Optional[int] = None
    group_name: Optional[str] = None
    workspace_count: int


class AdminDashboardStats(BaseModel):
    total_workspaces: int
    active_workspaces: int
    archived_workspaces: int
    total_staff: int
    total_students: int
    total_projects: int
    total_groups: int
    open_review_rounds: int
    total_submissions: int
    department: Optional[str] = None


class AccountStatusUpdate(BaseModel):
    is_active: bool
    reason: Optional[str] = None


class AdminStaffAssignRequest(BaseModel):
    user_id: int


class AdminProvisionRequest(BaseModel):
    email: str
    full_name: str
    password: str
    department: Optional[str] = None


class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    total_pages: int
    limit: int
    offset: int


class ArchiveRequest(BaseModel):
    reason: Optional[str] = None


# ---------------------------------------------------------------------------
# Internal Helpers
# ---------------------------------------------------------------------------

def _build_workspace_detail(db: Session, ws: Workspace) -> AdminWorkspaceDetailResponse:
    """Builds an AdminWorkspaceDetailResponse with counts for a single workspace."""
    owner_name = ws.owner.full_name if ws.owner else None
    staff_count = db.query(WorkspaceStaff).filter(WorkspaceStaff.workspace_id == ws.id).count()
    group_count = db.query(WorkspaceGroup).filter(WorkspaceGroup.workspace_id == ws.id).count()
    project_count = db.query(Project).filter(Project.workspace_id == ws.id).count()
    return AdminWorkspaceDetailResponse(
        id=ws.id,
        name=ws.name,
        description=ws.description,
        term=ws.term,
        department=ws.department,
        owner_id=ws.owner_id,
        owner_name=owner_name,
        is_open=ws.is_open,
        is_archived=ws.is_archived,
        created_at=ws.created_at,
        staff_count=staff_count,
        group_count=group_count,
        project_count=project_count,
    )


def _apply_audit_time_range(query, time_range: Optional[str], start_date: Optional[datetime], end_date: Optional[datetime]):
    """Applies time-based filtering to an audit query using UTC timestamps."""
    now_utc = datetime.now(timezone.utc)
    if start_date:
        query = query.filter(AuditLog.created_at >= start_date)
    elif time_range == "24h":
        query = query.filter(AuditLog.created_at >= (now_utc - timedelta(hours=24)))
    elif time_range == "7d":
        query = query.filter(AuditLog.created_at >= (now_utc - timedelta(days=7)))
    elif time_range == "30d":
        query = query.filter(AuditLog.created_at >= (now_utc - timedelta(days=30)))
    if end_date:
        query = query.filter(AuditLog.created_at <= end_date)
    return query


def _format_audit_event(log: AuditLog) -> AuditEventResponse:
    """Serializes an AuditLog ORM row to AuditEventResponse."""
    actor_name = (
        log.actor.full_name
        if log.actor
        else ("System / Automated" if not log.actor_id else f"User #{log.actor_id}")
    )
    actor_email = log.actor.email if log.actor else None
    actor_role = log.actor.role if log.actor else None
    ws_name = log.workspace.name if log.workspace else None
    return AuditEventResponse(
        id=log.id,
        timestamp=log.created_at,
        action=log.action_name or log.action_type,
        action_type=log.action_type,
        category=log.category or "SYSTEM",
        status=log.status or "SUCCESS",
        outcome=log.status or "SUCCESS",
        actor_id=log.actor_id,
        actor_name=actor_name,
        actor_email=actor_email,
        actor_role=actor_role,
        workspace_id=log.workspace_id,
        workspace_name=ws_name,
        resource_type=log.resource_type or log.entity_type,
        resource_id=log.entity_id,
        resource_name=log.resource_name,
        description=log.description,
        details=log.description or log.action_name or log.action_type,
        error_reason=log.error_reason,
        request_id=log.request_id,
        ip_address=log.ip_address,
        old_value=log.old_value,
        new_value=log.new_value,
    )


# ---------------------------------------------------------------------------
# 1. GET /admin/dashboard
# ---------------------------------------------------------------------------

@router.get("/dashboard", response_model=AdminDashboardStats)
def get_admin_dashboard(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """
    Returns high-level administrative statistics scoped to the admin's department.
    Super-admins (department=None) see global stats.
    """
    ws_ids = get_admin_workspace_ids(db, current_admin)

    # Workspace counts
    total_workspaces = len(ws_ids)
    if ws_ids:
        active_workspaces = (
            db.query(Workspace)
            .filter(Workspace.id.in_(ws_ids), Workspace.is_archived == False)
            .count()
        )
        archived_workspaces = (
            db.query(Workspace)
            .filter(Workspace.id.in_(ws_ids), Workspace.is_archived == True)
            .count()
        )
    else:
        active_workspaces = 0
        archived_workspaces = 0

    # Staff count scoped to department
    staff_query = db.query(User).filter(User.role == "staff")
    if current_admin.department is not None:
        staff_query = staff_query.filter(
            or_(User.department == current_admin.department, User.department.is_(None))
        )
    total_staff = staff_query.count()

    # Students enrolled in dept workspaces
    if ws_ids:
        student_group_ids = (
            db.query(WorkspaceGroup.group_id)
            .filter(WorkspaceGroup.workspace_id.in_(ws_ids))
            .distinct()
            .subquery()
        )
        total_students = (
            db.query(GroupMembership)
            .filter(GroupMembership.group_id.in_(student_group_ids))
            .join(User, GroupMembership.user_id == User.id)
            .filter(User.role == "student")
            .count()
        )

        # Projects
        total_projects = (
            db.query(Project)
            .filter(Project.workspace_id.in_(ws_ids))
            .count()
        )

        # Distinct groups via WorkspaceGroup
        total_groups = (
            db.query(WorkspaceGroup.group_id)
            .filter(WorkspaceGroup.workspace_id.in_(ws_ids))
            .distinct()
            .count()
        )

        # Open review rounds
        open_review_rounds = (
            db.query(ReviewRound)
            .filter(ReviewRound.workspace_id.in_(ws_ids), ReviewRound.is_open == True)
            .count()
        )

        # Submissions via projects
        project_ids_subq = (
            db.query(Project.id)
            .filter(Project.workspace_id.in_(ws_ids))
            .subquery()
        )
        total_submissions = (
            db.query(Submission)
            .filter(Submission.project_id.in_(project_ids_subq))
            .count()
        )
    else:
        total_students = 0
        total_projects = 0
        total_groups = 0
        open_review_rounds = 0
        total_submissions = 0

    return AdminDashboardStats(
        total_workspaces=total_workspaces,
        active_workspaces=active_workspaces,
        archived_workspaces=archived_workspaces,
        total_staff=total_staff,
        total_students=total_students,
        total_projects=total_projects,
        total_groups=total_groups,
        open_review_rounds=open_review_rounds,
        total_submissions=total_submissions,
        department=current_admin.department,
    )


# ---------------------------------------------------------------------------
# 2. GET /admin/workspaces
# ---------------------------------------------------------------------------

@router.get("/workspaces")
def list_admin_workspaces(
    search: Optional[str] = Query(None),
    is_archived: Optional[bool] = Query(None),
    department: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """
    Returns a paginated list of workspaces scoped to the admin's department,
    with optional filters for search string, archived status, and department.
    """
    ws_ids = get_admin_workspace_ids(db, current_admin)

    query = db.query(Workspace).options(joinedload(Workspace.owner))
    if ws_ids:
        query = query.filter(Workspace.id.in_(ws_ids))
    else:
        # No accessible workspaces
        return {
            "items": [],
            "total": 0,
            "page": 1,
            "total_pages": 1,
            "limit": limit,
            "offset": offset,
        }

    if search and search.strip():
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Workspace.name.ilike(pattern),
                Workspace.id.ilike(pattern),
                Workspace.description.ilike(pattern),
            )
        )

    if is_archived is not None:
        query = query.filter(Workspace.is_archived == is_archived)

    if department and department.strip():
        query = query.filter(Workspace.department == department.strip())

    total = query.count()
    workspaces = (
        query.order_by(Workspace.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    items = [_build_workspace_detail(db, ws) for ws in workspaces]
    current_page = (offset // limit) + 1 if limit > 0 else 1
    total_pages = max(1, math.ceil(total / limit)) if limit > 0 else 1

    return {
        "items": [item.model_dump() for item in items],
        "total": total,
        "page": current_page,
        "total_pages": total_pages,
        "limit": limit,
        "offset": offset,
    }


# ---------------------------------------------------------------------------
# 3. GET /admin/workspaces/{workspace_id}
# ---------------------------------------------------------------------------

@router.get("/workspaces/{workspace_id}", response_model=AdminWorkspaceDetailResponse)
def get_admin_workspace(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Returns detailed information about a single workspace, including staff and group lists."""
    if not is_admin_for_workspace(db, current_admin, workspace_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied.",
        )
    ws = (
        db.query(Workspace)
        .options(joinedload(Workspace.owner))
        .filter(Workspace.id == workspace_id)
        .first()
    )
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")

    return _build_workspace_detail(db, ws)


# ---------------------------------------------------------------------------
# 4. PATCH /admin/workspaces/{workspace_id}
# ---------------------------------------------------------------------------

@router.patch("/workspaces/{workspace_id}", response_model=AdminWorkspaceDetailResponse)
def update_admin_workspace(
    workspace_id: str,
    body: WorkspaceUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """
    Updates workspace configuration fields (name, description, term, department, is_open).
    Administrators cannot change owner_id or any grading fields.
    Logs an audit event and invalidates the workspace cache.
    """
    if not is_admin_for_workspace(db, current_admin, workspace_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied.",
        )
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")

    old_value: Dict[str, Any] = {
        "name": ws.name,
        "description": ws.description,
        "term": ws.term,
        "department": ws.department,
        "is_open": ws.is_open,
    }

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(ws, field, value)

    new_value: Dict[str, Any] = {
        "name": ws.name,
        "description": ws.description,
        "term": ws.term,
        "department": ws.department,
        "is_open": ws.is_open,
    }

    log_audit(
        db=db,
        action_type="admin_workspace_updated",
        entity_type="workspace",
        actor_id=current_admin.id,
        workspace_id=workspace_id,
        old_value=old_value,
        new_value=new_value,
        description=f"Admin {current_admin.email} updated workspace '{ws.name}'",
    )

    db.commit()
    db.refresh(ws)
    invalidate_workspace(workspace_id)

    return _build_workspace_detail(db, ws)


# ---------------------------------------------------------------------------
# 5. POST /admin/workspaces/{workspace_id}/archive
# ---------------------------------------------------------------------------

@router.post("/workspaces/{workspace_id}/archive")
def archive_workspace(
    workspace_id: str,
    body: ArchiveRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Archives a workspace (sets is_archived=True, is_open=False) and logs the event."""
    if not is_admin_for_workspace(db, current_admin, workspace_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied.",
        )
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")

    if ws.is_archived:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Workspace is already archived.",
        )

    ws.is_archived = True
    ws.is_open = False

    log_audit(
        db=db,
        action_type="admin_workspace_archived",
        entity_type="workspace",
        actor_id=current_admin.id,
        workspace_id=workspace_id,
        description=f"Admin {current_admin.email} archived workspace '{ws.name}'. Reason: {body.reason or 'Not provided'}",
        new_value={"reason": body.reason},
    )

    db.commit()
    invalidate_workspace(workspace_id)

    return {"message": f"Workspace '{workspace_id}' has been archived successfully."}


# ---------------------------------------------------------------------------
# 6. POST /admin/workspaces/{workspace_id}/unarchive
# ---------------------------------------------------------------------------

@router.post("/workspaces/{workspace_id}/unarchive")
def unarchive_workspace(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Restores an archived workspace (sets is_archived=False) and logs the event."""
    if not is_admin_for_workspace(db, current_admin, workspace_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied.",
        )
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")

    if not ws.is_archived:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Workspace is not archived.",
        )

    ws.is_archived = False

    log_audit(
        db=db,
        action_type="admin_workspace_unarchived",
        entity_type="workspace",
        actor_id=current_admin.id,
        workspace_id=workspace_id,
        description=f"Admin {current_admin.email} unarchived workspace '{ws.name}'.",
    )

    db.commit()
    invalidate_workspace(workspace_id)

    return {"message": f"Workspace '{workspace_id}' has been unarchived successfully."}


# ---------------------------------------------------------------------------
# 7. POST /admin/workspaces/{workspace_id}/staff
# ---------------------------------------------------------------------------

@router.post("/workspaces/{workspace_id}/staff")
def assign_staff_to_workspace(
    workspace_id: str,
    body: AdminStaffAssignRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Assigns a staff user to a workspace as 'costaff'. Validates the target user role."""
    if not is_admin_for_workspace(db, current_admin, workspace_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied.",
        )
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")

    target_user = db.query(User).filter(User.id == body.user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if target_user.role.lower() not in ["staff", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target user must have the 'staff' role.",
        )

    existing = (
        db.query(WorkspaceStaff)
        .filter(WorkspaceStaff.workspace_id == workspace_id, WorkspaceStaff.user_id == body.user_id)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already assigned to this workspace.",
        )

    new_entry = WorkspaceStaff(
        workspace_id=workspace_id,
        user_id=body.user_id,
        role="costaff",
    )
    db.add(new_entry)

    log_audit(
        db=db,
        action_type="admin_staff_assigned",
        entity_type="workspace_staff",
        actor_id=current_admin.id,
        workspace_id=workspace_id,
        description=f"Admin {current_admin.email} assigned staff '{target_user.email}' to workspace '{ws.name}'.",
        new_value={"user_id": body.user_id, "email": target_user.email, "role": "costaff"},
    )

    db.commit()
    return {"message": f"Staff member '{target_user.full_name}' assigned to workspace '{workspace_id}' successfully."}


# ---------------------------------------------------------------------------
# 8. DELETE /admin/workspaces/{workspace_id}/staff/{user_id}
# ---------------------------------------------------------------------------

@router.delete("/workspaces/{workspace_id}/staff/{user_id}")
def remove_staff_from_workspace(
    workspace_id: str,
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Removes a staff member from a workspace. Cannot remove the workspace owner."""
    if not is_admin_for_workspace(db, current_admin, workspace_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied.",
        )
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")

    if ws.owner_id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove the workspace owner from the workspace.",
        )

    target_user = db.query(User).filter(User.id == user_id).first()
    staff_entry = (
        db.query(WorkspaceStaff)
        .filter(WorkspaceStaff.workspace_id == workspace_id, WorkspaceStaff.user_id == user_id)
        .first()
    )
    if not staff_entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Staff assignment not found for this workspace.",
        )

    db.delete(staff_entry)

    log_audit(
        db=db,
        action_type="admin_staff_removed",
        entity_type="workspace_staff",
        actor_id=current_admin.id,
        workspace_id=workspace_id,
        description=f"Admin {current_admin.email} removed staff user_id={user_id} from workspace '{ws.name}'.",
        old_value={"user_id": user_id, "email": target_user.email if target_user else None},
    )

    db.commit()
    return {"message": f"Staff member removed from workspace '{workspace_id}' successfully."}


# ---------------------------------------------------------------------------
# 9. GET /admin/projects
# ---------------------------------------------------------------------------

@router.get("/projects")
def list_admin_projects(
    workspace_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    has_github: Optional[bool] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """
    Returns a paginated list of projects scoped to the admin's department workspaces.
    Optionally filters by workspace_id, search term, and GitHub link presence.
    """
    admin_ws_ids = get_admin_workspace_ids(db, current_admin)

    if not admin_ws_ids:
        return {"items": [], "total": 0, "page": 1, "total_pages": 1, "limit": limit, "offset": offset}

    query = (
        db.query(Project)
        .options(
            joinedload(Project.workspace),
            joinedload(Project.group),
            joinedload(Project.github_link),
        )
        .filter(Project.workspace_id.in_(admin_ws_ids))
    )

    if workspace_id:
        if workspace_id not in admin_ws_ids:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found or access denied.",
            )
        query = query.filter(Project.workspace_id == workspace_id)

    if search and search.strip():
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Project.name.ilike(pattern),
                Project.description.ilike(pattern),
            )
        )

    if has_github is not None:
        from app.models.github import GithubLink
        if has_github:
            query = query.filter(Project.github_link != None)
        else:
            query = query.filter(Project.github_link == None)

    total = query.count()
    projects = (
        query.order_by(Project.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    items = []
    for p in projects:
        sub_count = db.query(Submission).filter(Submission.project_id == p.id).count()
        items.append(
            AdminProjectResponse(
                id=p.id,
                name=p.name,
                description=p.description,
                workspace_id=p.workspace_id,
                workspace_name=p.workspace.name if p.workspace else None,
                group_id=p.group_id,
                group_name=p.group.name if p.group else None,
                created_at=p.created_at,
                custom_progress=p.custom_progress,
                submission_count=sub_count,
                has_github=p.github_link is not None,
            )
        )

    current_page = (offset // limit) + 1 if limit > 0 else 1
    total_pages = max(1, math.ceil(total / limit)) if limit > 0 else 1

    return {
        "items": [item.model_dump() for item in items],
        "total": total,
        "page": current_page,
        "total_pages": total_pages,
        "limit": limit,
        "offset": offset,
    }


# ---------------------------------------------------------------------------
# 10. GET /admin/projects/{project_id}
# ---------------------------------------------------------------------------

@router.get("/projects/{project_id}")
def get_admin_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """
    Returns detailed project information including group members, submission history,
    and review rounds. Validates admin access to the project's workspace.
    """
    project = (
        db.query(Project)
        .options(
            joinedload(Project.workspace),
            joinedload(Project.group),
            joinedload(Project.github_link),
            joinedload(Project.submissions).joinedload(Submission.round),
            joinedload(Project.submissions).joinedload(Submission.versions),
        )
        .filter(Project.id == project_id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    if not is_admin_for_workspace(db, current_admin, project.workspace_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: project is not in your department's workspaces.",
        )

    # Group members
    memberships = (
        db.query(GroupMembership)
        .options(joinedload(GroupMembership.user))
        .filter(GroupMembership.group_id == project.group_id)
        .all()
    )
    members = [
        {
            "user_id": m.user_id,
            "full_name": m.user.full_name if m.user else None,
            "email": m.user.email if m.user else None,
            "roll_number": m.user.roll_number if m.user else None,
        }
        for m in memberships
    ]

    # Review rounds in the workspace
    rounds = (
        db.query(ReviewRound)
        .filter(ReviewRound.workspace_id == project.workspace_id)
        .order_by(ReviewRound.order_index)
        .all()
    )

    # Submission summary
    submissions_summary = []
    for sub in project.submissions:
        latest_version = max(sub.versions, key=lambda v: v.version_number, default=None)
        submissions_summary.append(
            {
                "submission_id": sub.id,
                "round_id": sub.round_id,
                "round_title": sub.round.title if sub.round else None,
                "version_count": len(sub.versions),
                "latest_status": latest_version.status if latest_version else None,
                "created_at": sub.created_at.isoformat() if sub.created_at else None,
            }
        )

    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "workspace_id": project.workspace_id,
        "workspace_name": project.workspace.name if project.workspace else None,
        "group_id": project.group_id,
        "group_name": project.group.name if project.group else None,
        "created_at": project.created_at.isoformat() if project.created_at else None,
        "custom_progress": project.custom_progress,
        "has_github": project.github_link is not None,
        "github_url": project.github_link.repo_url if project.github_link else None,
        "members": members,
        "review_rounds": [
            {
                "id": r.id,
                "title": r.title,
                "order_index": r.order_index,
                "is_open": r.is_open,
                "due_date": r.due_date.isoformat() if r.due_date else None,
            }
            for r in rounds
        ],
        "submissions": submissions_summary,
    }


# ---------------------------------------------------------------------------
# 11. GET /admin/staff
# ---------------------------------------------------------------------------

@router.get("/staff")
def list_admin_staff(
    search: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """
    Returns a paginated list of staff users scoped to the admin's department.
    Includes workspace_count per staff member.
    """
    query = db.query(User).filter(User.role == "staff")

    if current_admin.department is not None:
        query = query.filter(
            or_(User.department == current_admin.department, User.department.is_(None))
        )

    if search and search.strip():
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                User.full_name.ilike(pattern),
                User.email.ilike(pattern),
            )
        )

    total = query.count()
    staff_users = (
        query.order_by(User.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    items = []
    for u in staff_users:
        ws_count = db.query(WorkspaceStaff).filter(WorkspaceStaff.user_id == u.id).count()
        # Also count owned workspaces
        owned_count = db.query(Workspace).filter(Workspace.owner_id == u.id).count()
        total_ws_count = ws_count + owned_count
        items.append(
            {
                **AdminUserResponse.model_validate(u).model_dump(),
                "workspace_count": total_ws_count,
            }
        )

    current_page = (offset // limit) + 1 if limit > 0 else 1
    total_pages = max(1, math.ceil(total / limit)) if limit > 0 else 1

    return {
        "items": items,
        "total": total,
        "page": current_page,
        "total_pages": total_pages,
        "limit": limit,
        "offset": offset,
    }


# ---------------------------------------------------------------------------
# 12. GET /admin/staff/{user_id}
# ---------------------------------------------------------------------------

@router.get("/staff/{user_id}", response_model=AdminStaffDetailResponse)
def get_admin_staff_detail(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """
    Returns detailed information about a specific staff member including their workspace list.
    Validates the target user is accessible to the requesting admin.
    """
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if target.role.lower() not in ["staff", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target user is not a staff member.",
        )

    # Dept access check
    if current_admin.department is not None:
        if target.department is not None and target.department != current_admin.department:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: staff member is not in your department.",
            )

    # Workspace assignments
    staff_entries = (
        db.query(WorkspaceStaff)
        .options(joinedload(WorkspaceStaff.workspace))
        .filter(WorkspaceStaff.user_id == user_id)
        .all()
    )
    owned = (
        db.query(Workspace)
        .filter(Workspace.owner_id == user_id)
        .all()
    )

    workspaces: List[Dict[str, Any]] = []
    seen_ws_ids = set()

    for ws in owned:
        if ws.id not in seen_ws_ids:
            seen_ws_ids.add(ws.id)
            workspaces.append({"workspace_id": ws.id, "workspace_name": ws.name, "role": "owner"})

    for entry in staff_entries:
        if entry.workspace_id not in seen_ws_ids:
            seen_ws_ids.add(entry.workspace_id)
            ws_name = entry.workspace.name if entry.workspace else entry.workspace_id
            workspaces.append({"workspace_id": entry.workspace_id, "workspace_name": ws_name, "role": entry.role})

    return AdminStaffDetailResponse(
        id=target.id,
        email=target.email,
        full_name=target.full_name,
        department=target.department,
        is_active=target.is_active,
        created_at=target.created_at,
        workspace_count=len(workspaces),
        workspaces=workspaces,
    )


# ---------------------------------------------------------------------------
# 13. GET /admin/students
# ---------------------------------------------------------------------------

@router.get("/students")
def list_admin_students(
    search: Optional[str] = Query(None),
    workspace_id: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """
    Returns a paginated list of students enrolled in the admin's department workspaces.
    Optionally scoped by workspace_id. Includes group info and workspace count.
    """
    admin_ws_ids = get_admin_workspace_ids(db, current_admin)

    if not admin_ws_ids:
        return {"items": [], "total": 0, "page": 1, "total_pages": 1, "limit": limit, "offset": offset}

    if workspace_id:
        if workspace_id not in admin_ws_ids:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found or access denied.",
            )
        effective_ws_ids = [workspace_id]
    else:
        effective_ws_ids = admin_ws_ids

    # Get group IDs enrolled in the effective workspaces
    enrolled_group_ids_subq = (
        db.query(WorkspaceGroup.group_id)
        .filter(WorkspaceGroup.workspace_id.in_(effective_ws_ids))
        .distinct()
        .subquery()
    )

    # Get user IDs in those groups
    query = (
        db.query(User)
        .join(GroupMembership, GroupMembership.user_id == User.id)
        .filter(
            User.role == "student",
            GroupMembership.group_id.in_(enrolled_group_ids_subq),
        )
    )

    if search and search.strip():
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                User.full_name.ilike(pattern),
                User.email.ilike(pattern),
                User.roll_number.ilike(pattern),
            )
        )

    total = query.distinct(User.id).count()
    students = (
        query.distinct(User.id)
        .order_by(User.id, User.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    items = []
    for u in students:
        membership = (
            db.query(GroupMembership)
            .options(joinedload(GroupMembership.group))
            .filter(GroupMembership.user_id == u.id)
            .first()
        )
        group_id = membership.group_id if membership else None
        group_name = membership.group.name if membership and membership.group else None

        # Count workspaces the student is enrolled in (via group)
        ws_count = 0
        if membership:
            ws_count = (
                db.query(WorkspaceGroup)
                .filter(WorkspaceGroup.group_id == membership.group_id)
                .count()
            )

        items.append(
            AdminStudentDetailResponse(
                id=u.id,
                email=u.email,
                full_name=u.full_name,
                roll_number=u.roll_number,
                department=u.department,
                is_active=u.is_active,
                created_at=u.created_at,
                group_id=group_id,
                group_name=group_name,
                workspace_count=ws_count,
            ).model_dump()
        )

    current_page = (offset // limit) + 1 if limit > 0 else 1
    total_pages = max(1, math.ceil(total / limit)) if limit > 0 else 1

    return {
        "items": items,
        "total": total,
        "page": current_page,
        "total_pages": total_pages,
        "limit": limit,
        "offset": offset,
    }


# ---------------------------------------------------------------------------
# 14. GET /admin/students/{user_id}
# ---------------------------------------------------------------------------

@router.get("/students/{user_id}", response_model=AdminStudentDetailResponse)
def get_admin_student_detail(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """
    Returns detailed information about a specific student.
    Validates the student is enrolled in one of the admin's department workspaces.
    """
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if target.role.lower() != "student":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Target user is not a student.")

    admin_ws_ids = get_admin_workspace_ids(db, current_admin)

    # Check student's group enrollment in admin's workspaces
    membership = (
        db.query(GroupMembership)
        .options(joinedload(GroupMembership.group))
        .filter(GroupMembership.user_id == user_id)
        .first()
    )

    enrolled_in_admin_ws = False
    ws_count = 0
    if membership:
        enrolled_ws = (
            db.query(WorkspaceGroup)
            .filter(WorkspaceGroup.group_id == membership.group_id)
            .all()
        )
        enrolled_ws_ids = [e.workspace_id for e in enrolled_ws]
        ws_count = len(enrolled_ws_ids)
        enrolled_in_admin_ws = any(wid in admin_ws_ids for wid in enrolled_ws_ids)

    if not enrolled_in_admin_ws:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found or not enrolled in your department's workspaces.",
        )

    group_id = membership.group_id if membership else None
    group_name = membership.group.name if membership and membership.group else None

    return AdminStudentDetailResponse(
        id=target.id,
        email=target.email,
        full_name=target.full_name,
        roll_number=target.roll_number,
        department=target.department,
        is_active=target.is_active,
        created_at=target.created_at,
        group_id=group_id,
        group_name=group_name,
        workspace_count=ws_count,
    )


# ---------------------------------------------------------------------------
# 15. PATCH /admin/users/{user_id}/status
# ---------------------------------------------------------------------------

@router.patch("/users/{user_id}/status", response_model=AdminUserResponse)
def update_user_account_status(
    user_id: int,
    body: AccountStatusUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """
    Activates or deactivates a user account (staff or student).
    Cannot deactivate other administrators. Logs an audit event.
    """
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if target.role.lower() == "administrator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot change the status of another administrator account.",
        )

    # Dept access check
    if current_admin.department is not None:
        if target.role.lower() in ["staff", "teacher"]:
            if target.department is not None and target.department != current_admin.department:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: user is not in your department.",
                )
        elif target.role.lower() == "student":
            # Verify student is enrolled in admin's workspaces
            admin_ws_ids = get_admin_workspace_ids(db, current_admin)
            membership = db.query(GroupMembership).filter(GroupMembership.user_id == user_id).first()
            enrolled_in_admin_ws = False
            if membership:
                enrolled_ws = (
                    db.query(WorkspaceGroup)
                    .filter(WorkspaceGroup.group_id == membership.group_id)
                    .all()
                )
                enrolled_in_admin_ws = any(e.workspace_id in admin_ws_ids for e in enrolled_ws)
            if not enrolled_in_admin_ws:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: student is not enrolled in your department's workspaces.",
                )

    old_status = target.is_active
    target.is_active = body.is_active

    log_audit(
        db=db,
        action_type="admin_account_status_changed",
        entity_type="user",
        entity_id=user_id,
        actor_id=current_admin.id,
        description=(
            f"Admin {current_admin.email} set user '{target.email}' "
            f"is_active={body.is_active}. Reason: {body.reason or 'Not provided'}"
        ),
        old_value={"is_active": old_status},
        new_value={"is_active": body.is_active, "reason": body.reason},
    )

    db.commit()
    db.refresh(target)
    return AdminUserResponse.model_validate(target)


# ---------------------------------------------------------------------------
# 16. GET /admin/audit
# ---------------------------------------------------------------------------

@router.get("/audit", response_model=AuditActivityPaginatedResponse)
def get_admin_audit(
    workspace_id: Optional[str] = Query(None),
    actor_id: Optional[int] = Query(None),
    category: Optional[str] = Query(None),
    action_type: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    time_range: Optional[str] = Query("all"),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """
    Returns paginated audit log events scoped to the admin's department workspaces.
    Includes global/null-workspace events as well.
    """
    admin_ws_ids = get_admin_workspace_ids(db, current_admin)

    query = (
        db.query(AuditLog)
        .options(joinedload(AuditLog.actor), joinedload(AuditLog.workspace))
    )

    if workspace_id:
        if workspace_id not in admin_ws_ids:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found or access denied.",
            )
        query = query.filter(AuditLog.workspace_id == workspace_id)
    else:
        query = query.filter(
            or_(
                AuditLog.workspace_id.in_(admin_ws_ids),
                AuditLog.workspace_id.is_(None),
            )
        )

    if category and category.upper() != "ALL":
        query = query.filter(AuditLog.category == category.upper())

    if action_type and action_type.strip():
        query = query.filter(AuditLog.action_type == action_type.strip())

    if status_filter and status_filter.upper() != "ALL":
        query = query.filter(AuditLog.status == status_filter.upper())

    if actor_id:
        query = query.filter(AuditLog.actor_id == actor_id)

    query = _apply_audit_time_range(query, time_range, start_date, end_date)

    if search and search.strip():
        pattern = f"%{search.strip()}%"
        query = query.outerjoin(User, AuditLog.actor_id == User.id)
        query = query.filter(
            or_(
                AuditLog.action_name.ilike(pattern),
                AuditLog.action_type.ilike(pattern),
                AuditLog.description.ilike(pattern),
                AuditLog.resource_name.ilike(pattern),
                AuditLog.workspace_id.ilike(pattern),
                User.full_name.ilike(pattern),
                User.email.ilike(pattern),
            )
        )

    total = query.count()
    logs = (
        query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    items = [_format_audit_event(log) for log in logs]
    current_page = (offset // limit) + 1 if limit > 0 else 1
    total_pages = max(1, math.ceil(total / limit)) if limit > 0 else 1

    return AuditActivityPaginatedResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
        page=current_page,
        total_pages=total_pages,
    )


# ---------------------------------------------------------------------------
# 17. GET /admin/audit/stats
# ---------------------------------------------------------------------------

@router.get("/audit/stats", response_model=AuditStatsResponse)
def get_admin_audit_stats(
    workspace_id: Optional[str] = Query(None),
    time_range: str = Query("all"),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Returns aggregated audit statistics for the admin's department workspaces."""
    admin_ws_ids = get_admin_workspace_ids(db, current_admin)

    query = db.query(AuditLog)

    if workspace_id:
        if workspace_id not in admin_ws_ids:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found or access denied.",
            )
        query = query.filter(AuditLog.workspace_id == workspace_id)
    else:
        query = query.filter(
            or_(
                AuditLog.workspace_id.in_(admin_ws_ids),
                AuditLog.workspace_id.is_(None),
            )
        )

    query = _apply_audit_time_range(query, time_range, None, None)

    total_events = query.count()
    workspace_changes = query.filter(AuditLog.category == "WORKSPACE").count()
    access_changes = query.filter(AuditLog.category == "ACCESS").count()
    security_events = query.filter(AuditLog.category == "SECURITY").count()
    failure_count = query.filter(AuditLog.status == "FAILURE").count()

    return AuditStatsResponse(
        total_events=total_events,
        workspace_changes=workspace_changes,
        access_changes=access_changes,
        security_events=security_events,
        failure_count=failure_count,
        time_range=time_range,
    )


# ---------------------------------------------------------------------------
# 18. GET /admin/audit/filters
# ---------------------------------------------------------------------------

@router.get("/audit/filters", response_model=AuditFiltersResponse)
def get_admin_audit_filters(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Returns dynamically populated filter options for the admin's department audit log."""
    admin_ws_ids = get_admin_workspace_ids(db, current_admin)

    workspaces = (
        db.query(Workspace)
        .filter(Workspace.id.in_(admin_ws_ids))
        .order_by(Workspace.name.asc())
        .all()
    )
    ws_options = [AuditFilterOption(id=ws.id, label=f"{ws.name} (#{ws.id})") for ws in workspaces]

    categories = ["ALL", "WORKSPACE", "ACCESS", "SECURITY", "ASSESSMENT", "NOTICE", "PROJECT", "ADMIN"]

    actions = (
        db.query(AuditLog.action_type, AuditLog.action_name)
        .filter(
            or_(
                AuditLog.workspace_id.in_(admin_ws_ids),
                AuditLog.workspace_id.is_(None),
            )
        )
        .distinct()
        .all()
    )
    action_options = [
        AuditFilterOption(id=a[0], label=a[1] or a[0].replace("_", " ").title())
        for a in actions
        if a[0]
    ]

    actors = (
        db.query(User.id, User.full_name, User.email)
        .join(AuditLog, User.id == AuditLog.actor_id)
        .filter(
            or_(
                AuditLog.workspace_id.in_(admin_ws_ids),
                AuditLog.workspace_id.is_(None),
            )
        )
        .distinct()
        .all()
    )
    actor_options = [
        AuditFilterOption(id=str(act[0]), label=f"{act[1]} ({act[2]})")
        for act in actors
    ]

    return AuditFiltersResponse(
        workspaces=ws_options,
        categories=categories,
        action_types=action_options,
        actors=actor_options,
    )


# ---------------------------------------------------------------------------
# 19. GET /admin/reports/overview
# ---------------------------------------------------------------------------

@router.get("/reports/overview")
def get_admin_reports_overview(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """
    Returns analytics for the admin's department:
    workspace status breakdown, projects per workspace, submission status distribution,
    staff assignment counts, and review round open/closed counts.
    """
    admin_ws_ids = get_admin_workspace_ids(db, current_admin)

    if not admin_ws_ids:
        return {
            "workspaces_by_status": {"active": 0, "archived": 0},
            "projects_by_workspace": [],
            "submission_status": {"submitted": 0, "in_review": 0, "reviewed": 0},
            "staff_assignments": [],
            "review_round_completion": [],
        }

    # Workspace status breakdown
    ws_list = db.query(Workspace).filter(Workspace.id.in_(admin_ws_ids)).all()
    active_ws = sum(1 for w in ws_list if not w.is_archived)
    archived_ws = sum(1 for w in ws_list if w.is_archived)
    workspaces_by_status = {"active": active_ws, "archived": archived_ws}

    # Projects per workspace
    proj_counts = (
        db.query(Project.workspace_id, func.count(Project.id).label("project_count"))
        .filter(Project.workspace_id.in_(admin_ws_ids))
        .group_by(Project.workspace_id)
        .all()
    )
    ws_name_map = {ws.id: ws.name for ws in ws_list}
    projects_by_workspace = [
        {
            "workspace_id": row.workspace_id,
            "workspace_name": ws_name_map.get(row.workspace_id, row.workspace_id),
            "project_count": row.project_count,
        }
        for row in proj_counts
    ]

    # Submission status distribution (via SubmissionVersion latest status)
    project_ids_subq = (
        db.query(Project.id)
        .filter(Project.workspace_id.in_(admin_ws_ids))
        .subquery()
    )
    submission_ids_subq = (
        db.query(Submission.id)
        .filter(Submission.project_id.in_(project_ids_subq))
        .subquery()
    )
    # Count SubmissionVersions by status
    version_status_counts = (
        db.query(SubmissionVersion.status, func.count(SubmissionVersion.id).label("cnt"))
        .filter(SubmissionVersion.submission_id.in_(submission_ids_subq))
        .group_by(SubmissionVersion.status)
        .all()
    )
    submitted = 0
    in_review = 0
    reviewed = 0
    for row in version_status_counts:
        s = (row.status or "").upper()
        if s in ("SUBMITTED",):
            submitted += row.cnt
        elif s in ("IN_REVIEW", "REVISION_REQUESTED"):
            in_review += row.cnt
        elif s in ("APPROVED", "COMPLETED"):
            reviewed += row.cnt
    submission_status = {"submitted": submitted, "in_review": in_review, "reviewed": reviewed}

    # Staff assignment counts
    staff_ws_counts = (
        db.query(WorkspaceStaff.user_id, func.count(WorkspaceStaff.workspace_id).label("ws_count"))
        .filter(WorkspaceStaff.workspace_id.in_(admin_ws_ids))
        .group_by(WorkspaceStaff.user_id)
        .order_by(func.count(WorkspaceStaff.workspace_id).desc())
        .limit(20)
        .all()
    )
    staff_user_ids = [row.user_id for row in staff_ws_counts]
    staff_users_map = {}
    if staff_user_ids:
        staff_users = db.query(User).filter(User.id.in_(staff_user_ids)).all()
        staff_users_map = {u.id: u for u in staff_users}
    staff_assignments = [
        {
            "staff_id": row.user_id,
            "staff_name": staff_users_map[row.user_id].full_name if row.user_id in staff_users_map else f"User #{row.user_id}",
            "workspace_count": row.ws_count,
        }
        for row in staff_ws_counts
    ]

    # Review round open/closed per workspace
    rounds_data = (
        db.query(
            ReviewRound.workspace_id,
            ReviewRound.is_open,
            func.count(ReviewRound.id).label("cnt"),
        )
        .filter(ReviewRound.workspace_id.in_(admin_ws_ids))
        .group_by(ReviewRound.workspace_id, ReviewRound.is_open)
        .all()
    )
    round_map: Dict[str, Dict[str, int]] = {}
    for row in rounds_data:
        wid = row.workspace_id
        if wid not in round_map:
            round_map[wid] = {"open_rounds": 0, "closed_rounds": 0}
        if row.is_open:
            round_map[wid]["open_rounds"] += row.cnt
        else:
            round_map[wid]["closed_rounds"] += row.cnt
    review_round_completion = [
        {
            "workspace_id": wid,
            "workspace_name": ws_name_map.get(wid, wid),
            "open_rounds": counts["open_rounds"],
            "closed_rounds": counts["closed_rounds"],
        }
        for wid, counts in round_map.items()
    ]

    return {
        "workspaces_by_status": workspaces_by_status,
        "projects_by_workspace": projects_by_workspace,
        "submission_status": submission_status,
        "staff_assignments": staff_assignments,
        "review_round_completion": review_round_completion,
    }


# ---------------------------------------------------------------------------
# 20. POST /admin/provision (Shared secret OR Authenticated Administrator)
# ---------------------------------------------------------------------------

@router.post("/provision", response_model=AdminUserResponse, status_code=status.HTTP_201_CREATED)
def provision_admin_account(
    body: AdminProvisionRequest,
    x_provision_secret: Optional[str] = Header(None, alias="x-provision-secret"),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """
    Creates a new administrator account.
    Authorized via:
      1) Valid X-Provision-Secret header matching ADMIN_PROVISION_SECRET, OR
      2) Authenticated Administrator Bearer token (scoped administrators can only provision
         admins for their own department; global administrators can provision for any department).
    Public registration as Administrator is strictly prevented.
    """
    is_authorized = False
    actor_id: Optional[int] = None
    provision_secret = os.getenv("ADMIN_PROVISION_SECRET", "NexaVault-Admin-Provision-2026-ProdSecret!")

    # Check 1: Shared provision secret
    if x_provision_secret:
        if not provision_secret or x_provision_secret != provision_secret:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid provision secret.",
            )
        is_authorized = True

    # Check 2: Authenticated Administrator
    elif current_user and current_user.role.lower() == "administrator":
        actor_id = current_user.id
        if current_user.department:
            # Department admin can only provision admins within their own department
            if body.department != current_user.department:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Department Administrators may only provision administrators for their own department ({current_user.department}).",
                )
        is_authorized = True

    if not is_authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: Provisioning requires a valid X-Provision-Secret header or an active Administrator session.",
        )

    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A user with email '{body.email}' already exists.",
        )

    hashed = hash_password(body.password)
    new_admin = User(
        email=body.email,
        full_name=body.full_name,
        hashed_password=hashed,
        role="administrator",
        department=body.department,
        is_active=True,
    )
    db.add(new_admin)
    db.flush()

    log_audit(
        db=db,
        actor_id=actor_id,
        action_type="admin_account_provisioned",
        entity_type="user",
        entity_id=new_admin.id,
        description=f"Administrator account provisioned for '{body.email}' (dept: {body.department or 'global'}).",
        new_value={"email": body.email, "full_name": body.full_name, "department": body.department},
    )

    db.commit()
    db.refresh(new_admin)
    return AdminUserResponse.model_validate(new_admin)
