from datetime import datetime, timezone
from typing import List, Optional, Union
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, get_current_staff, get_current_student
from app.models.user import User
from app.models.workspace import (
    Workspace,
    WorkspaceStaff,
    WorkspaceStaffRequest,
    WorkspaceGroup,
    WorkspaceNotice,
)
from app.models.group import Group, GroupMembership
from app.models.review import ReviewRound, Submission, SubmissionVersion
from app.models.project import Project
from app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceResponse,
    WorkspaceStudentResponse,
    WorkspaceStaffRequestResponse,
    WorkspaceStaffRequestResolve,
    WorkspaceNoticeCreate,
    WorkspaceNoticeUpdate,
    WorkspaceNoticeResponse,
    ReviewRoundCreate,
    ReviewRoundUpdate,
    ReviewRoundResponse,
)
from app.core.permissions import (
    get_user_active_group,
    can_access_workspace,
    is_workspace_owner,
    is_workspace_staff,
    can_manage_workspace,
    can_manage_notice,
    can_manage_round,
)
from app.services.audit_service import log_audit

router = APIRouter()

# --- WORKSPACE MANAGEMENT ---

@router.post("/", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
def create_workspace(
    payload: WorkspaceCreate,
    db: Session = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
):
    """
    Staff creates a new workspace.
    The creating staff user becomes the owner.
    """
    existing = db.query(Workspace).filter(Workspace.id == payload.id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Workspace with ID '{payload.id}' already exists."
        )

    workspace = Workspace(
        id=payload.id,
        name=payload.name,
        description=payload.description,
        term=payload.term,
        owner_id=current_staff.id,
        is_open=True,
        is_archived=False,
    )
    db.add(workspace)
    db.flush()

    # Assign owner to workspace_staff
    owner_staff = WorkspaceStaff(
        workspace_id=workspace.id,
        user_id=current_staff.id,
        role="owner",
    )
    db.add(owner_staff)

    log_audit(
        db=db,
        actor_id=current_staff.id,
        action_type="workspace_created",
        entity_type="workspace",
        workspace_id=workspace.id,
        new_value={"id": workspace.id, "name": workspace.name, "term": workspace.term},
    )

    db.commit()
    db.refresh(workspace)

    return WorkspaceResponse(
        id=workspace.id,
        name=workspace.name,
        description=workspace.description,
        term=workspace.term,
        owner_id=workspace.owner_id,
        owner_name=current_staff.full_name,
        is_open=workspace.is_open,
        is_archived=workspace.is_archived,
        created_at=workspace.created_at,
        role="owner",
    )

@router.get("/")
def list_workspaces(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lists workspaces accessible to the authenticated user.
    For Staff: returns workspaces where staff is owner or co-staff.
    For Student: returns workspaces where active group is enrolled.
    """
    if current_user.role.lower() == "staff":
        staff_entries = (
            db.query(WorkspaceStaff)
            .filter(WorkspaceStaff.user_id == current_user.id)
            .all()
        )
        ws_ids = {s.workspace_id for s in staff_entries}
        # Also include owned workspaces
        owned = db.query(Workspace).filter(Workspace.owner_id == current_user.id).all()
        for o in owned:
            ws_ids.add(o.id)

        workspaces = db.query(Workspace).filter(Workspace.id.in_(ws_ids)).order_by(Workspace.created_at.desc()).all()
        results = []
        for ws in workspaces:
            role = "owner" if ws.owner_id == current_user.id else "costaff"
            results.append(
                WorkspaceResponse(
                    id=ws.id,
                    name=ws.name,
                    description=ws.description,
                    term=ws.term,
                    owner_id=ws.owner_id,
                    owner_name=ws.owner.full_name if ws.owner else None,
                    is_open=ws.is_open,
                    is_archived=ws.is_archived,
                    created_at=ws.created_at,
                    role=role,
                )
            )
        return results
    else:
        # Student view
        active_group = get_user_active_group(db, current_user.id)
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
            project = (
                db.query(Project)
                .filter(Project.workspace_id == ws.id, Project.group_id == active_group.id)
                .first()
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
                    is_archived=n.is_archived,
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

@router.get("/{workspace_id}")
def get_workspace_details(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get detailed view of a workspace. Unauthorized accesses return 404.
    """
    if not can_access_workspace(db, current_user.id, workspace_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied."
        )

    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")

    if current_user.role.lower() == "staff":
        role = "owner" if ws.owner_id == current_user.id else "costaff"
        return WorkspaceResponse(
            id=ws.id,
            name=ws.name,
            description=ws.description,
            term=ws.term,
            owner_id=ws.owner_id,
            owner_name=ws.owner.full_name if ws.owner else None,
            is_open=ws.is_open,
            is_archived=ws.is_archived,
            created_at=ws.created_at,
            role=role,
        )

    # Student view
    active_group = get_user_active_group(db, current_user.id)
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
            is_archived=n.is_archived,
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

# --- STAFF ACCESS REQUESTS & CO-STAFF MANAGEMENT ---

@router.post("/{workspace_id}/staff-request", response_model=WorkspaceStaffRequestResponse, status_code=status.HTTP_201_CREATED)
def request_staff_access(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
):
    """
    Staff user requests access to a workspace.
    """
    ws = db.query(Workspace).filter(Workspace.id == workspace_id, Workspace.is_archived == False).first()
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")

    if is_workspace_staff(db, current_staff.id, workspace_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already authorized staff for this workspace."
        )

    existing_req = (
        db.query(WorkspaceStaffRequest)
        .filter(WorkspaceStaffRequest.workspace_id == workspace_id, WorkspaceStaffRequest.requester_id == current_staff.id, WorkspaceStaffRequest.status == "pending")
        .first()
    )
    if existing_req:
        return WorkspaceStaffRequestResponse(
            id=existing_req.id,
            workspace_id=existing_req.workspace_id,
            requester_id=existing_req.requester_id,
            requester_name=current_staff.full_name,
            requester_email=current_staff.email,
            status=existing_req.status,
            created_at=existing_req.created_at,
            resolved_at=existing_req.resolved_at,
        )

    req = WorkspaceStaffRequest(
        workspace_id=workspace_id,
        requester_id=current_staff.id,
        status="pending",
    )
    db.add(req)
    db.flush()

    log_audit(
        db=db,
        actor_id=current_staff.id,
        action_type="staff_access_requested",
        entity_type="workspace_staff_request",
        entity_id=req.id,
        workspace_id=workspace_id,
    )

    db.commit()
    db.refresh(req)

    return WorkspaceStaffRequestResponse(
        id=req.id,
        workspace_id=req.workspace_id,
        requester_id=req.requester_id,
        requester_name=current_staff.full_name,
        requester_email=current_staff.email,
        status=req.status,
        created_at=req.created_at,
        resolved_at=req.resolved_at,
    )

@router.get("/{workspace_id}/staff-requests", response_model=List[WorkspaceStaffRequestResponse])
def list_staff_requests(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
):
    """
    Workspace owner lists pending staff access requests.
    """
    if not is_workspace_owner(db, current_staff.id, workspace_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or owner permission required."
        )

    requests = (
        db.query(WorkspaceStaffRequest)
        .filter(WorkspaceStaffRequest.workspace_id == workspace_id)
        .order_by(WorkspaceStaffRequest.created_at.desc())
        .all()
    )

    return [
        WorkspaceStaffRequestResponse(
            id=r.id,
            workspace_id=r.workspace_id,
            requester_id=r.requester_id,
            requester_name=r.requester.full_name if r.requester else None,
            requester_email=r.requester.email if r.requester else None,
            status=r.status,
            created_at=r.created_at,
            resolved_at=r.resolved_at,
        )
        for r in requests
    ]

@router.post("/{workspace_id}/staff-request/{request_id}/resolve", response_model=WorkspaceStaffRequestResponse)
def resolve_staff_request(
    workspace_id: str,
    request_id: int,
    payload: WorkspaceStaffRequestResolve,
    db: Session = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
):
    """
    Workspace owner approves or rejects a staff access request.
    """
    if not is_workspace_owner(db, current_staff.id, workspace_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or owner permission required."
        )

    req = (
        db.query(WorkspaceStaffRequest)
        .filter(WorkspaceStaffRequest.id == request_id, WorkspaceStaffRequest.workspace_id == workspace_id)
        .first()
    )
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff request not found.")

    action = payload.action.lower()
    if action not in ["approve", "reject"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Action must be 'approve' or 'reject'.")

    req.resolved_at = datetime.now(timezone.utc)
    if action == "approve":
        req.status = "approved"
        # Add to WorkspaceStaff if not already present
        existing_staff = (
            db.query(WorkspaceStaff)
            .filter(WorkspaceStaff.workspace_id == workspace_id, WorkspaceStaff.user_id == req.requester_id)
            .first()
        )
        if not existing_staff:
            new_staff = WorkspaceStaff(
                workspace_id=workspace_id,
                user_id=req.requester_id,
                role="costaff",
            )
            db.add(new_staff)

        log_audit(
            db=db,
            actor_id=current_staff.id,
            action_type="staff_request_approved",
            entity_type="workspace_staff_request",
            entity_id=req.id,
            workspace_id=workspace_id,
            new_value={"requester_id": req.requester_id},
        )
    else:
        req.status = "rejected"
        log_audit(
            db=db,
            actor_id=current_staff.id,
            action_type="staff_request_rejected",
            entity_type="workspace_staff_request",
            entity_id=req.id,
            workspace_id=workspace_id,
            new_value={"requester_id": req.requester_id},
        )

    db.commit()
    db.refresh(req)

    return WorkspaceStaffRequestResponse(
        id=req.id,
        workspace_id=req.workspace_id,
        requester_id=req.requester_id,
        requester_name=req.requester.full_name if req.requester else None,
        requester_email=req.requester.email if req.requester else None,
        status=req.status,
        created_at=req.created_at,
        resolved_at=req.resolved_at,
    )

@router.post("/{workspace_id}/costaff/{user_id}", status_code=status.HTTP_200_OK)
def assign_costaff(
    workspace_id: str,
    user_id: int,
    db: Session = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
):
    """
    Workspace owner directly assigns a staff user as co-staff.
    """
    if not is_workspace_owner(db, current_staff.id, workspace_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or owner permission required."
        )

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user or target_user.role.lower() != "staff":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target user must be an active Staff user."
        )

    existing = (
        db.query(WorkspaceStaff)
        .filter(WorkspaceStaff.workspace_id == workspace_id, WorkspaceStaff.user_id == user_id)
        .first()
    )
    if not existing:
        new_staff = WorkspaceStaff(
            workspace_id=workspace_id,
            user_id=user_id,
            role="costaff",
        )
        db.add(new_staff)

    log_audit(
        db=db,
        actor_id=current_staff.id,
        action_type="costaff_assigned",
        entity_type="workspace_staff",
        workspace_id=workspace_id,
        new_value={"assigned_user_id": user_id},
    )

    db.commit()
    return {"message": f"User {user_id} assigned as co-staff for workspace {workspace_id}."}

@router.delete("/{workspace_id}/costaff/{user_id}", status_code=status.HTTP_200_OK)
def remove_costaff(
    workspace_id: str,
    user_id: int,
    db: Session = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
):
    """
    Workspace owner removes a co-staff user from the workspace.
    Cannot remove workspace owner. Releases active submission claims.
    """
    if not is_workspace_owner(db, current_staff.id, workspace_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or owner permission required."
        )

    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")

    if ws.owner_id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove workspace owner from workspace staff."
        )

    entry = (
        db.query(WorkspaceStaff)
        .filter(WorkspaceStaff.workspace_id == workspace_id, WorkspaceStaff.user_id == user_id)
        .first()
    )
    if entry:
        db.delete(entry)

    # Release any active submission claims held by this user in this workspace
    claimed_versions = (
        db.query(SubmissionVersion)
        .join(Submission, SubmissionVersion.submission_id == Submission.id)
        .join(Project, Submission.project_id == Project.id)
        .filter(Project.workspace_id == workspace_id, SubmissionVersion.claimed_by_id == user_id)
        .all()
    )
    for ver in claimed_versions:
        ver.claimed_by_id = None
        if ver.status == "IN_REVIEW":
            ver.status = "SUBMITTED"

    log_audit(
        db=db,
        actor_id=current_staff.id,
        action_type="costaff_removed",
        entity_type="workspace_staff",
        workspace_id=workspace_id,
        old_value={"removed_user_id": user_id},
    )

    db.commit()
    return {"message": f"Co-staff user {user_id} removed from workspace {workspace_id}."}

@router.post("/{workspace_id}/archive", status_code=status.HTTP_200_OK)
def archive_workspace(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
):
    """
    Workspace owner archives the workspace.
    """
    if not is_workspace_owner(db, current_staff.id, workspace_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or owner permission required."
        )

    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")

    ws.is_archived = True
    ws.is_open = False

    log_audit(
        db=db,
        actor_id=current_staff.id,
        action_type="workspace_archived",
        entity_type="workspace",
        workspace_id=workspace_id,
    )

    db.commit()
    return {"message": f"Workspace {workspace_id} archived successfully."}

# --- OVERSIGHT: GROUPS & PROJECTS IN WORKSPACE ---

@router.get("/{workspace_id}/groups")
def list_workspace_groups(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
):
    """
    Staff inspects enrolled groups in authorized workspace.
    """
    if not is_workspace_staff(db, current_staff.id, workspace_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied."
        )

    enrollments = (
        db.query(WorkspaceGroup)
        .filter(WorkspaceGroup.workspace_id == workspace_id)
        .all()
    )

    result = []
    for enr in enrollments:
        group = db.query(Group).filter(Group.id == enr.group_id, Group.is_deleted == False).first()
        if not group:
            continue
        memberships = db.query(GroupMembership).filter(GroupMembership.group_id == group.id).all()
        members_data = [
            {"id": m.user.id, "full_name": m.user.full_name, "email": m.user.email}
            for m in memberships if m.user
        ]
        project = db.query(Project).filter(Project.workspace_id == workspace_id, Project.group_id == group.id).first()

        result.append({
            "group_id": group.id,
            "group_name": group.name,
            "enrolled_at": enr.enrolled_at,
            "member_count": len(members_data),
            "members": members_data,
            "has_project": project is not None,
            "project_id": project.id if project else None,
            "project_name": project.name if project else None,
        })

    return result

@router.get("/{workspace_id}/projects")
def list_workspace_projects(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
):
    """
    Staff inspects projects in authorized workspace.
    """
    if not is_workspace_staff(db, current_staff.id, workspace_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied."
        )

    projects = db.query(Project).filter(Project.workspace_id == workspace_id).all()
    result = []
    for proj in projects:
        group = db.query(Group).filter(Group.id == proj.group_id).first()
        memberships = db.query(GroupMembership).filter(GroupMembership.group_id == proj.group_id).all() if group else []
        members_data = [
            {"id": m.user.id, "full_name": m.user.full_name, "email": m.user.email}
            for m in memberships if m.user
        ]
        result.append({
            "project_id": proj.id,
            "name": proj.name,
            "description": proj.description,
            "group_id": proj.group_id,
            "group_name": group.name if group else None,
            "members": members_data,
            "created_at": proj.created_at,
        })

    return result

# --- NOTICE BOARD ---

@router.get("/{workspace_id}/notices", response_model=List[WorkspaceNoticeResponse])
def get_workspace_notices(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get notices for a workspace.
    Students see non-archived notices. Staff see non-archived notices.
    """
    if not can_access_workspace(db, current_user.id, workspace_id):
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
            is_archived=n.is_archived,
            created_at=n.created_at,
            author_name=n.author.full_name if n.author else "Staff"
        )
        for n in notices
    ]

@router.post("/{workspace_id}/notices", response_model=WorkspaceNoticeResponse, status_code=status.HTTP_201_CREATED)
def create_notice(
    workspace_id: str,
    payload: WorkspaceNoticeCreate,
    db: Session = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
):
    """
    Staff creates a notice in the workspace.
    """
    if not can_manage_notice(db, current_staff.id, workspace_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied."
        )

    notice = WorkspaceNotice(
        workspace_id=workspace_id,
        author_id=current_staff.id,
        title=payload.title,
        body=payload.body,
        image_url=payload.image_url,
        is_pinned=payload.is_pinned,
        is_archived=False,
    )
    db.add(notice)
    db.flush()

    log_audit(
        db=db,
        actor_id=current_staff.id,
        action_type="notice_created",
        entity_type="workspace_notice",
        entity_id=notice.id,
        workspace_id=workspace_id,
        new_value={"title": notice.title, "is_pinned": notice.is_pinned},
    )

    db.commit()
    db.refresh(notice)

    return WorkspaceNoticeResponse(
        id=notice.id,
        workspace_id=notice.workspace_id,
        title=notice.title,
        body=notice.body,
        image_url=notice.image_url,
        is_pinned=notice.is_pinned,
        is_archived=notice.is_archived,
        created_at=notice.created_at,
        author_name=current_staff.full_name,
    )

@router.patch("/{workspace_id}/notices/{notice_id}", response_model=WorkspaceNoticeResponse)
def edit_notice(
    workspace_id: str,
    notice_id: int,
    payload: WorkspaceNoticeUpdate,
    db: Session = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
):
    """
    Staff edits an existing notice.
    """
    if not can_manage_notice(db, current_staff.id, workspace_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied."
        )

    notice = (
        db.query(WorkspaceNotice)
        .filter(WorkspaceNotice.id == notice_id, WorkspaceNotice.workspace_id == workspace_id)
        .first()
    )
    if not notice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notice not found.")

    old_val = {"title": notice.title, "body": notice.body, "image_url": notice.image_url, "is_pinned": notice.is_pinned}

    if payload.title is not None:
        notice.title = payload.title
    if payload.body is not None:
        notice.body = payload.body
    if payload.image_url is not None:
        notice.image_url = payload.image_url
    if payload.is_pinned is not None:
        notice.is_pinned = payload.is_pinned

    log_audit(
        db=db,
        actor_id=current_staff.id,
        action_type="notice_edited",
        entity_type="workspace_notice",
        entity_id=notice.id,
        workspace_id=workspace_id,
        old_value=old_val,
        new_value={"title": notice.title, "is_pinned": notice.is_pinned},
    )

    db.commit()
    db.refresh(notice)

    return WorkspaceNoticeResponse(
        id=notice.id,
        workspace_id=notice.workspace_id,
        title=notice.title,
        body=notice.body,
        image_url=notice.image_url,
        is_pinned=notice.is_pinned,
        is_archived=notice.is_archived,
        created_at=notice.created_at,
        author_name=notice.author.full_name if notice.author else "Staff",
    )

@router.post("/{workspace_id}/notices/{notice_id}/pin", response_model=WorkspaceNoticeResponse)
def toggle_pin_notice(
    workspace_id: str,
    notice_id: int,
    db: Session = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
):
    """
    Staff pins or unpins a notice.
    """
    if not can_manage_notice(db, current_staff.id, workspace_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied."
        )

    notice = (
        db.query(WorkspaceNotice)
        .filter(WorkspaceNotice.id == notice_id, WorkspaceNotice.workspace_id == workspace_id)
        .first()
    )
    if not notice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notice not found.")

    notice.is_pinned = not notice.is_pinned
    action = "notice_pinned" if notice.is_pinned else "notice_unpinned"

    log_audit(
        db=db,
        actor_id=current_staff.id,
        action_type=action,
        entity_type="workspace_notice",
        entity_id=notice.id,
        workspace_id=workspace_id,
        new_value={"is_pinned": notice.is_pinned},
    )

    db.commit()
    db.refresh(notice)

    return WorkspaceNoticeResponse(
        id=notice.id,
        workspace_id=notice.workspace_id,
        title=notice.title,
        body=notice.body,
        image_url=notice.image_url,
        is_pinned=notice.is_pinned,
        is_archived=notice.is_archived,
        created_at=notice.created_at,
        author_name=notice.author.full_name if notice.author else "Staff",
    )

@router.post("/{workspace_id}/notices/{notice_id}/archive", status_code=status.HTTP_200_OK)
def archive_notice(
    workspace_id: str,
    notice_id: int,
    db: Session = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
):
    """
    Staff archives a notice.
    """
    if not can_manage_notice(db, current_staff.id, workspace_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied."
        )

    notice = (
        db.query(WorkspaceNotice)
        .filter(WorkspaceNotice.id == notice_id, WorkspaceNotice.workspace_id == workspace_id)
        .first()
    )
    if not notice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notice not found.")

    notice.is_archived = True

    log_audit(
        db=db,
        actor_id=current_staff.id,
        action_type="notice_archived",
        entity_type="workspace_notice",
        entity_id=notice.id,
        workspace_id=workspace_id,
    )

    db.commit()
    return {"message": f"Notice {notice_id} archived successfully."}

# --- REVIEW ROUNDS ---

@router.get("/{workspace_id}/rounds", response_model=List[ReviewRoundResponse])
def get_workspace_review_rounds(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get review rounds list for a workspace.
    """
    if not can_access_workspace(db, current_user.id, workspace_id):
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

@router.post("/{workspace_id}/rounds", response_model=ReviewRoundResponse, status_code=status.HTTP_201_CREATED)
def create_review_round(
    workspace_id: str,
    payload: ReviewRoundCreate,
    db: Session = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
):
    """
    Staff creates a review round.
    Rule: max_score >= 1.0
    """
    if not can_manage_round(db, current_staff.id, workspace_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied."
        )

    if payload.max_score < 1.0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="max_score must be at least 1.0."
        )

    round_obj = ReviewRound(
        workspace_id=workspace_id,
        title=payload.title,
        description=payload.description,
        order_index=payload.order_index,
        due_date=payload.due_date,
        max_score=payload.max_score,
        is_open=True,
    )
    db.add(round_obj)
    db.flush()

    log_audit(
        db=db,
        actor_id=current_staff.id,
        action_type="round_created",
        entity_type="review_round",
        entity_id=round_obj.id,
        workspace_id=workspace_id,
        new_value={"title": round_obj.title, "max_score": float(round_obj.max_score)},
    )

    db.commit()
    db.refresh(round_obj)

    return ReviewRoundResponse(
        id=round_obj.id,
        workspace_id=round_obj.workspace_id,
        title=round_obj.title,
        description=round_obj.description,
        order_index=round_obj.order_index,
        due_date=round_obj.due_date,
        max_score=float(round_obj.max_score),
        is_open=round_obj.is_open,
        created_at=round_obj.created_at,
    )

@router.patch("/{workspace_id}/rounds/{round_id}", response_model=ReviewRoundResponse)
def edit_review_round(
    workspace_id: str,
    round_id: int,
    payload: ReviewRoundUpdate,
    db: Session = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
):
    """
    Staff edits a review round. max_score >= 1.0
    """
    if not can_manage_round(db, current_staff.id, workspace_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied."
        )

    round_obj = (
        db.query(ReviewRound)
        .filter(ReviewRound.id == round_id, ReviewRound.workspace_id == workspace_id)
        .first()
    )
    if not round_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review round not found.")

    if payload.max_score is not None and payload.max_score < 1.0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="max_score must be at least 1.0."
        )

    old_val = {"title": round_obj.title, "max_score": float(round_obj.max_score), "due_date": round_obj.due_date.isoformat()}

    if payload.title is not None:
        round_obj.title = payload.title
    if payload.description is not None:
        round_obj.description = payload.description
    if payload.order_index is not None:
        round_obj.order_index = payload.order_index
    if payload.due_date is not None:
        round_obj.due_date = payload.due_date
    if payload.max_score is not None:
        round_obj.max_score = payload.max_score

    log_audit(
        db=db,
        actor_id=current_staff.id,
        action_type="round_edited",
        entity_type="review_round",
        entity_id=round_obj.id,
        workspace_id=workspace_id,
        old_value=old_val,
        new_value={"title": round_obj.title, "max_score": float(round_obj.max_score)},
    )

    db.commit()
    db.refresh(round_obj)

    return ReviewRoundResponse(
        id=round_obj.id,
        workspace_id=round_obj.workspace_id,
        title=round_obj.title,
        description=round_obj.description,
        order_index=round_obj.order_index,
        due_date=round_obj.due_date,
        max_score=float(round_obj.max_score),
        is_open=round_obj.is_open,
        created_at=round_obj.created_at,
    )

@router.post("/{workspace_id}/rounds/{round_id}/toggle", response_model=ReviewRoundResponse)
def toggle_review_round(
    workspace_id: str,
    round_id: int,
    db: Session = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
):
    """
    Staff toggles open/closed state of a review round.
    """
    if not can_manage_round(db, current_staff.id, workspace_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied."
        )

    round_obj = (
        db.query(ReviewRound)
        .filter(ReviewRound.id == round_id, ReviewRound.workspace_id == workspace_id)
        .first()
    )
    if not round_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review round not found.")

    round_obj.is_open = not round_obj.is_open

    log_audit(
        db=db,
        actor_id=current_staff.id,
        action_type="round_toggled",
        entity_type="review_round",
        entity_id=round_obj.id,
        workspace_id=workspace_id,
        new_value={"is_open": round_obj.is_open},
    )

    db.commit()
    db.refresh(round_obj)

    return ReviewRoundResponse(
        id=round_obj.id,
        workspace_id=round_obj.workspace_id,
        title=round_obj.title,
        description=round_obj.description,
        order_index=round_obj.order_index,
        due_date=round_obj.due_date,
        max_score=float(round_obj.max_score),
        is_open=round_obj.is_open,
        created_at=round_obj.created_at,
    )

@router.delete("/{workspace_id}/rounds/{round_id}", status_code=status.HTTP_200_OK)
def delete_review_round(
    workspace_id: str,
    round_id: int,
    db: Session = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
):
    """
    Staff deletes a review round.
    Rule: Deletion MUST be BLOCKED once submissions exist for this round!
    """
    if not can_manage_round(db, current_staff.id, workspace_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied."
        )

    round_obj = (
        db.query(ReviewRound)
        .filter(ReviewRound.id == round_id, ReviewRound.workspace_id == workspace_id)
        .first()
    )
    if not round_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review round not found.")

    existing_submissions = db.query(Submission).filter(Submission.round_id == round_id).count()
    if existing_submissions > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete review round because submissions already exist for it."
        )

    db.delete(round_obj)
    db.commit()
    return {"message": f"Review round {round_id} deleted successfully."}
