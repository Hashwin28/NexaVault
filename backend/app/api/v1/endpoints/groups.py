import random
import string
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session, joinedload
from app.api.deps import get_db, get_current_student, get_current_staff
from app.models.user import User
from app.models.group import Group, GroupMembership
from app.models.workspace import Workspace, WorkspaceGroup, WorkspaceStaff
from app.models.project import Project
from app.models.review import ReviewRound, Submission, SubmissionVersion, Review, ResultEntry
from app.services.project_service import calculate_project_progress
from app.schemas.group import (
    GroupCreate,
    GroupJoin,
    GroupCodeUpdate,
    GroupResponse,
    GroupMemberResponse,
    GroupEnrollRequest,
    GroupMessageResponse,
    StaffGroupOversightItem,
)
from app.core.permissions import get_user_active_group, is_user_group_member, is_workspace_staff
from app.services.audit_service import log_audit
from app.core.cache import (
    cache,
    key_group_detail,
    key_group_me,
    invalidate_group,
    invalidate_user,
    invalidate_workspace,
)

router = APIRouter()

def generate_unique_alphanumeric_code(db: Session, length: int = 7) -> str:
    """Generates a random unique alphanumeric group code without hyphens."""
    chars = string.ascii_uppercase + string.digits
    for _ in range(50):
        candidate = "".join(random.choices(chars, k=length))
        existing = db.query(Group).filter(Group.code == candidate).first()
        if not existing:
            return candidate
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Failed to generate a unique group code. Please provide one manually."
    )

def build_group_response(group: Group, db: Session) -> GroupResponse:
    """Builds a leaderless GroupResponse with all active members."""
    memberships = (
        db.query(GroupMembership)
        .filter(GroupMembership.group_id == group.id)
        .order_by(GroupMembership.joined_at.asc())
        .all()
    )
    members_list = [
        GroupMemberResponse(
            id=m.user.id,
            full_name=m.user.full_name,
            email=m.user.email,
            joined_at=m.joined_at
        )
        for m in memberships if m.user
    ]

    return GroupResponse(
        id=group.id,
        name=group.name,
        code=group.code,
        created_at=group.created_at,
        member_count=len(members_list),
        members=members_list,
        is_member=True
    )

@router.post("/", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
def create_group(
    group_in: GroupCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_student: User = Depends(get_current_student)
):
    """
    Creates a new Group.
    - Creator becomes the first equal member (no leader).
    - A student can belong to only ONE group at a time.
    - Enforces alphanumeric group codes.
    """
    # Check if student already belongs to an active group
    existing_group = get_user_active_group(db, current_student.id)
    if existing_group:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You are already a member of active group '{existing_group.name}'. You must leave your current group before creating a new one."
        )

    # Validate or generate unique code
    if group_in.code and group_in.code.strip():
        code = group_in.code.strip().upper()
        existing_code = db.query(Group).filter(Group.code == code).first()
        if existing_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Group code '{code}' is already in use. Please select a different code."
            )
    else:
        code = generate_unique_alphanumeric_code(db)

    new_group = Group(
        name=group_in.name.strip(),
        code=code,
        created_by=current_student.id,
        is_deleted=False
    )
    db.add(new_group)
    db.flush()

    # Add creator as first equal member
    membership = GroupMembership(
        group_id=new_group.id,
        user_id=current_student.id
    )
    db.add(membership)
    db.flush()

    client_ip = request.client.host if request.client else None
    log_audit(
        db=db,
        actor_id=current_student.id,
        action_type="GROUP_CREATED",
        entity_type="GROUP",
        entity_id=new_group.id,
        new_value={"name": new_group.name, "code": new_group.code},
        ip_address=client_ip
    )

    db.commit()
    db.refresh(new_group)
    invalidate_user(current_student.id)
    cache.invalidate_prefix("ws:list:")

    return build_group_response(new_group, db)

@router.get("/me", response_model=GroupResponse)
def get_my_current_group(
    db: Session = Depends(get_db),
    current_student: User = Depends(get_current_student)
):
    """Returns the single active group the student belongs to."""
    c_key = key_group_me(current_student.id)
    cached = cache.get(c_key)
    if cached is not None:
        return GroupResponse(**cached)

    group = get_user_active_group(db, current_student.id)
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You do not currently belong to any active group."
        )
    res = build_group_response(group, db)
    cache.set(c_key, res.model_dump(), ttl=180, tags=[f"user:{current_student.id}", f"group:{group.id}"])
    return res

@router.get("/{group_id}", response_model=GroupResponse)
def get_group_details(
    group_id: int,
    db: Session = Depends(get_db),
    current_student: User = Depends(get_current_student)
):
    """
    Returns group details.
    Restricted strictly to current members of the group.
    """
    if not is_user_group_member(db, current_student.id, group_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found or access denied."
        )

    c_key = key_group_detail(group_id)
    cached = cache.get(c_key)
    if cached is not None:
        return GroupResponse(**cached)

    group = db.query(Group).filter(Group.id == group_id, Group.is_deleted == False).first()
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found."
        )

    res = build_group_response(group, db)
    cache.set(c_key, res.model_dump(), ttl=180, tags=[f"group:{group_id}"])
    return res

@router.post("/join", response_model=GroupResponse)
def join_group(
    join_in: GroupJoin,
    request: Request,
    db: Session = Depends(get_db),
    current_student: User = Depends(get_current_student)
):
    """
    Join an active group using its unique alphanumeric code.
    - Immediate join, no approval required.
    - Strictly blocks joining multiple groups.
    - Strictly blocks joining if group already has 5 members.
    """
    # Check single group constraint
    active_group = get_user_active_group(db, current_student.id)
    if active_group:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You are already a member of '{active_group.name}'. You must leave it before joining another group."
        )

    code = join_in.code.strip().upper()
    # PostgreSQL row-level locking via with_for_update() to eliminate member capacity race conditions
    group = (
        db.query(Group)
        .filter(Group.code == code, Group.is_deleted == False)
        .with_for_update()
        .first()
    )
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid Group Code. No active group found matching this code."
        )

    # Check maximum member limit while holding row lock
    member_count = db.query(GroupMembership).filter(GroupMembership.group_id == group.id).count()
    if member_count >= 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Group '{group.name}' has reached its maximum capacity of 5 members."
        )

    membership = GroupMembership(
        group_id=group.id,
        user_id=current_student.id
    )
    db.add(membership)
    db.flush()

    client_ip = request.client.host if request.client else None
    log_audit(
        db=db,
        actor_id=current_student.id,
        action_type="MEMBER_JOINED",
        entity_type="GROUP",
        entity_id=group.id,
        new_value={"user_id": current_student.id, "email": current_student.email},
        ip_address=client_ip
    )

    db.commit()
    db.refresh(group)
    invalidate_group(group.id)
    invalidate_user(current_student.id)
    cache.invalidate_prefix("ws:list:")

    return build_group_response(group, db)

@router.patch("/{group_id}/code", response_model=GroupResponse)
def change_group_code(
    group_id: int,
    code_in: GroupCodeUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_student: User = Depends(get_current_student)
):
    """
    Any current group member can change the group code.
    The old code stops working immediately.
    """
    if not is_user_group_member(db, current_student.id, group_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found or access denied."
        )

    group = db.query(Group).filter(Group.id == group_id, Group.is_deleted == False).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found.")

    old_code = group.code
    if code_in.code and code_in.code.strip():
        new_code = code_in.code.strip().upper()
        existing = db.query(Group).filter(Group.code == new_code, Group.id != group.id).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Group code '{new_code}' is already in use by another group."
            )
    else:
        new_code = generate_unique_alphanumeric_code(db)

    group.code = new_code
    db.flush()

    client_ip = request.client.host if request.client else None
    log_audit(
        db=db,
        actor_id=current_student.id,
        action_type="GROUP_CODE_CHANGED",
        entity_type="GROUP",
        entity_id=group.id,
        old_value={"code": old_code},
        new_value={"code": new_code},
        ip_address=client_ip
    )

    db.commit()
    db.refresh(group)
    invalidate_group(group.id)

    return build_group_response(group, db)

@router.post("/{group_id}/leave", response_model=GroupMessageResponse)
def leave_group(
    group_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_student: User = Depends(get_current_student)
):
    """
    Voluntarily leave a group.
    - Any member can leave.
    - If the last member leaves, the group is dissolved/deleted.
    """
    membership = (
        db.query(GroupMembership)
        .filter(GroupMembership.group_id == group_id, GroupMembership.user_id == current_student.id)
        .first()
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are not a member of this group."
        )

    group = db.query(Group).filter(Group.id == group_id).first()
    group_name = group.name if group else f"Group #{group_id}"

    db.delete(membership)
    db.flush()

    # Check remaining members
    remaining_count = db.query(GroupMembership).filter(GroupMembership.group_id == group_id).count()
    client_ip = request.client.host if request.client else None

    if remaining_count == 0:
        if group:
            group.is_deleted = True
        log_audit(
            db=db,
            actor_id=current_student.id,
            action_type="GROUP_DISSOLVED",
            entity_type="GROUP",
            entity_id=group_id,
            new_value={"reason": "Last member left group"},
            ip_address=client_ip
        )
        msg = f"You have left '{group_name}'. As the last member, the group has been dissolved."
    else:
        log_audit(
            db=db,
            actor_id=current_student.id,
            action_type="MEMBER_LEFT",
            entity_type="GROUP",
            entity_id=group_id,
            new_value={"user_id": current_student.id, "remaining_members": remaining_count},
            ip_address=client_ip
        )
        msg = f"You have successfully left the group '{group_name}'."

    db.commit()
    invalidate_group(group_id)
    invalidate_user(current_student.id)
    cache.invalidate_prefix("ws:")
    return GroupMessageResponse(message=msg)

@router.post("/{group_id}/enroll", response_model=GroupMessageResponse)
def enroll_group_in_workspace(
    group_id: int,
    enroll_in: GroupEnrollRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_student: User = Depends(get_current_student)
):
    """
    Enroll the group into a workspace.
    - Requires group to have at least 2 active members.
    - Any current member can perform the enrollment.
    - Workspace must be open and not archived.
    """
    if not is_user_group_member(db, current_student.id, group_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found or access denied."
        )

    group = db.query(Group).filter(Group.id == group_id, Group.is_deleted == False).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found.")

    member_count = db.query(GroupMembership).filter(GroupMembership.group_id == group.id).count()
    if member_count < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A group must have at least 2 members before it can enroll in a workspace."
        )

    ws_id = enroll_in.workspace_id.strip()
    workspace = db.query(Workspace).filter(Workspace.id == ws_id).first()
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workspace with ID '{ws_id}' not found. Please verify the Workspace ID."
        )

    if workspace.is_archived:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This workspace is archived and no longer accepting enrollments."
        )

    if not workspace.is_open:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Enrollment for this workspace is currently closed."
        )

    # Check existing enrollment
    existing_enrollment = (
        db.query(WorkspaceGroup)
        .filter(WorkspaceGroup.workspace_id == workspace.id, WorkspaceGroup.group_id == group.id)
        .first()
    )
    if existing_enrollment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Group '{group.name}' is already enrolled in workspace '{workspace.name}'."
        )

    enrollment = WorkspaceGroup(
        workspace_id=workspace.id,
        group_id=group.id,
        enrolled_by=current_student.id
    )
    db.add(enrollment)
    db.flush()

    client_ip = request.client.host if request.client else None
    log_audit(
        db=db,
        actor_id=current_student.id,
        action_type="WORKSPACE_ENROLLED",
        entity_type="WORKSPACE",
        entity_id=None,
        workspace_id=workspace.id,
        new_value={"workspace_id": workspace.id, "group_id": group.id},
        ip_address=client_ip
    )

    db.commit()
    invalidate_group(group_id)
    invalidate_workspace(workspace.id)
    invalidate_user(current_student.id)
    cache.invalidate_prefix("ws:list:")

    return GroupMessageResponse(
        message=f"Group '{group.name}' successfully enrolled in workspace '{workspace.name}' ({workspace.id}).",
        group=build_group_response(group, db)
    )


# --- DEDICATED STAFF GROUPS OVERSIGHT ENDPOINTS ---

@router.get("/staff/oversight", response_model=List[StaffGroupOversightItem])
def list_staff_groups_oversight(
    workspace_id: Optional[str] = Query(None, description="Optional workspace filter"),
    db: Session = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
):
    """
    Staff oversight endpoint for groups.
    Lists all distinct groups enrolled in workspaces managed by the current staff member.
    Includes group metadata, member rosters with roll numbers, connected project info,
    submission status, review verdicts, and results publication state.
    Eliminates N+1 queries.
    """
    # 1. Determine authorized workspaces for staff
    staff_entries = db.query(WorkspaceStaff).filter(WorkspaceStaff.user_id == current_staff.id).all()
    ws_ids = {s.workspace_id for s in staff_entries}
    owned = db.query(Workspace).filter(Workspace.owner_id == current_staff.id).all()
    for o in owned:
        ws_ids.add(o.id)

    if not ws_ids:
        return []

    if workspace_id:
        if workspace_id not in ws_ids:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found or access denied."
            )
        target_ws_ids = [workspace_id]
    else:
        target_ws_ids = list(ws_ids)

    # 2. Fetch enrollments with eager loading
    enrollments = (
        db.query(WorkspaceGroup)
        .options(
            joinedload(WorkspaceGroup.workspace),
            joinedload(WorkspaceGroup.group).joinedload(Group.creator),
            joinedload(WorkspaceGroup.group).joinedload(Group.memberships).joinedload(GroupMembership.user),
        )
        .filter(WorkspaceGroup.workspace_id.in_(target_ws_ids))
        .order_by(WorkspaceGroup.enrolled_at.asc())
        .all()
    )

    group_ids = [enr.group_id for enr in enrollments if enr.group and not enr.group.is_deleted]

    # 3. Pre-fetch associated projects in ONE query
    projects = (
        db.query(Project)
        .options(
            joinedload(Project.github_link),
            joinedload(Project.submissions).joinedload(Submission.round),
            joinedload(Project.submissions).joinedload(Submission.versions).joinedload(SubmissionVersion.review).joinedload(Review.reviewer),
            joinedload(Project.submissions).joinedload(Submission.versions).joinedload(SubmissionVersion.review).joinedload(Review.result_entries),
        )
        .filter(Project.workspace_id.in_(target_ws_ids), Project.group_id.in_(group_ids))
        .all()
    )
    project_by_ws_group = {(p.workspace_id, p.group_id): p for p in projects}

    result = []
    for enr in enrollments:
        group = enr.group
        ws = enr.workspace
        if not group or group.is_deleted or not ws:
            continue

        members_data = [
            {
                "id": m.user.id,
                "full_name": m.user.full_name,
                "email": m.user.email,
                "roll_number": m.user.roll_number or m.user.email.split("@")[0],
                "joined_at": m.joined_at,
            }
            for m in group.memberships
            if m.user
        ]

        proj = project_by_ws_group.get((ws.id, group.id))
        submissions_data = []
        latest_sub_dict = None
        review_status = "NO_PROJECT"
        results_status = "PENDING"
        prog_pct = 0.0

        if proj:
            prog_pct = calculate_project_progress(db, proj.id)
            all_versions = []
            for sub in (proj.submissions or []):
                round_obj = sub.round
                for ver in (sub.versions or []):
                    rev = ver.review
                    is_rel = any(re.is_released for re in rev.result_entries) if (rev and rev.result_entries) else False
                    has_scores = bool(rev and rev.result_entries)
                    scores_cnt = len(rev.result_entries) if (rev and rev.result_entries) else 0

                    sub_item = {
                        "submission_id": sub.id,
                        "round_id": sub.round_id,
                        "round_title": round_obj.title if round_obj else f"Round #{sub.round_id}",
                        "round_order": round_obj.order_index if round_obj else 1,
                        "max_score": float(round_obj.max_score) if round_obj and round_obj.max_score is not None else 100.0,
                        "due_date": round_obj.due_date if round_obj else None,
                        "version_id": ver.id,
                        "version_number": ver.version_number,
                        "status": ver.status,
                        "submitted_at": ver.submitted_at,
                        "verdict": rev.status if rev else None,
                        "reviewer_name": rev.reviewer.full_name if (rev and rev.reviewer) else None,
                        "is_released": is_rel,
                        "scores_count": scores_cnt,
                    }
                    submissions_data.append(sub_item)
                    all_versions.append((ver.submitted_at or ver.created_at, sub_item, ver.status, is_rel, has_scores))

            if all_versions:
                all_versions.sort(key=lambda x: x[0], reverse=True)
                latest_sub_dict = all_versions[0][1]
                latest_status = all_versions[0][2]
                any_released = any(x[3] for x in all_versions)
                any_graded = any(x[4] for x in all_versions)

                review_status = latest_status or "SUBMITTED"
                results_status = "PUBLISHED" if any_released else ("DRAFT" if any_graded else "PENDING")
            else:
                review_status = "NO_SUBMISSION"
                results_status = "PENDING"

        project_overview = {
            "id": proj.id,
            "name": proj.name,
            "description": proj.description,
            "progress_percentage": prog_pct,
            "github_repo_url": proj.github_link.repo_url if (proj and proj.github_link) else None,
            "created_at": proj.created_at,
        } if proj else None

        result.append(
            StaffGroupOversightItem(
                id=group.id,
                name=group.name,
                code=group.code,
                group_id=group.id,
                group_name=group.name,
                group_code=group.code,
                created_at=group.created_at,
                created_by=group.created_by,
                creator_name=group.creator.full_name if group.creator else None,
                workspace_id=ws.id,
                workspace_name=ws.name,
                enrolled_at=enr.enrolled_at,
                member_count=len(members_data),
                members=members_data,
                has_project=proj is not None,
                project=project_overview,
                latest_submission=latest_sub_dict,
                submissions=submissions_data,
                review_status=review_status,
                results_status=results_status,
            )
        )

    return result


@router.get("/{group_id}/oversight", response_model=StaffGroupOversightItem)
def get_staff_group_oversight_detail(
    group_id: int,
    db: Session = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
):
    """
    Dedicated detail view for staff to inspect a group:
    Includes group metadata, member roster with roll numbers, connected project details,
    all review round submissions, evaluations, and publication status.
    """
    group = (
        db.query(Group)
        .options(
            joinedload(Group.creator),
            joinedload(Group.memberships).joinedload(GroupMembership.user),
            joinedload(Group.enrolled_workspaces).joinedload(WorkspaceGroup.workspace),
        )
        .filter(Group.id == group_id, Group.is_deleted == False)
        .first()
    )
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found."
        )

    # Check staff authorization across workspaces in which group is enrolled
    staff_entries = db.query(WorkspaceStaff).filter(WorkspaceStaff.user_id == current_staff.id).all()
    authorized_ws_ids = {s.workspace_id for s in staff_entries}
    owned = db.query(Workspace).filter(Workspace.owner_id == current_staff.id).all()
    for o in owned:
        authorized_ws_ids.add(o.id)

    enrolled_ws = [ew.workspace for ew in group.enrolled_workspaces if ew.workspace and ew.workspace.id in authorized_ws_ids]
    if not enrolled_ws:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found or access denied in managed workspaces."
        )

    primary_ws = enrolled_ws[0]

    # Pre-fetch project
    proj = (
        db.query(Project)
        .options(
            joinedload(Project.github_link),
            joinedload(Project.submissions).joinedload(Submission.round),
            joinedload(Project.submissions).joinedload(Submission.versions).joinedload(SubmissionVersion.review).joinedload(Review.reviewer),
            joinedload(Project.submissions).joinedload(Submission.versions).joinedload(SubmissionVersion.review).joinedload(Review.result_entries),
        )
        .filter(Project.group_id == group.id, Project.workspace_id == primary_ws.id)
        .first()
    )

    members_data = [
        {
            "id": m.user.id,
            "full_name": m.user.full_name,
            "email": m.user.email,
            "roll_number": m.user.roll_number or m.user.email.split("@")[0],
            "joined_at": m.joined_at,
        }
        for m in group.memberships
        if m.user
    ]

    submissions_data = []
    latest_sub_dict = None
    review_status = "NO_PROJECT"
    results_status = "PENDING"
    prog_pct = 0.0

    if proj:
        prog_pct = calculate_project_progress(db, proj.id)
        all_versions = []
        for sub in (proj.submissions or []):
            round_obj = sub.round
            for ver in (sub.versions or []):
                rev = ver.review
                is_rel = any(re.is_released for re in rev.result_entries) if (rev and rev.result_entries) else False
                has_scores = bool(rev and rev.result_entries)
                scores_cnt = len(rev.result_entries) if (rev and rev.result_entries) else 0

                sub_item = {
                    "submission_id": sub.id,
                    "round_id": sub.round_id,
                    "round_title": round_obj.title if round_obj else f"Round #{sub.round_id}",
                    "round_order": round_obj.order_index if round_obj else 1,
                    "max_score": float(round_obj.max_score) if round_obj and round_obj.max_score is not None else 100.0,
                    "due_date": round_obj.due_date if round_obj else None,
                    "version_id": ver.id,
                    "version_number": ver.version_number,
                    "status": ver.status,
                    "submitted_at": ver.submitted_at,
                    "verdict": rev.status if rev else None,
                    "reviewer_name": rev.reviewer.full_name if (rev and rev.reviewer) else None,
                    "is_released": is_rel,
                    "scores_count": scores_cnt,
                }
                submissions_data.append(sub_item)
                all_versions.append((ver.submitted_at or ver.created_at, sub_item, ver.status, is_rel, has_scores))

        if all_versions:
            all_versions.sort(key=lambda x: x[0], reverse=True)
            latest_sub_dict = all_versions[0][1]
            latest_status = all_versions[0][2]
            any_released = any(x[3] for x in all_versions)
            any_graded = any(x[4] for x in all_versions)

            review_status = latest_status or "SUBMITTED"
            results_status = "PUBLISHED" if any_released else ("DRAFT" if any_graded else "PENDING")
        else:
            review_status = "NO_SUBMISSION"
            results_status = "PENDING"

    project_overview = {
        "id": proj.id,
        "name": proj.name,
        "description": proj.description,
        "progress_percentage": prog_pct,
        "github_repo_url": proj.github_link.repo_url if (proj and proj.github_link) else None,
        "created_at": proj.created_at,
    } if proj else None

    # Find enrollment timestamp
    enr = next((ew for ew in group.enrolled_workspaces if ew.workspace_id == primary_ws.id), None)
    enrolled_at = enr.enrolled_at if enr else None

    return StaffGroupOversightItem(
        id=group.id,
        name=group.name,
        code=group.code,
        group_id=group.id,
        group_name=group.name,
        group_code=group.code,
        created_at=group.created_at,
        created_by=group.created_by,
        creator_name=group.creator.full_name if group.creator else None,
        workspace_id=primary_ws.id,
        workspace_name=primary_ws.name,
        enrolled_at=enrolled_at,
        member_count=len(members_data),
        members=members_data,
        has_project=proj is not None,
        project=project_overview,
        latest_submission=latest_sub_dict,
        submissions=submissions_data,
        review_status=review_status,
        results_status=results_status,
    )
