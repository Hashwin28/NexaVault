from typing import Optional, Tuple
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.group import Group, GroupMembership
from app.models.workspace import Workspace, WorkspaceGroup, WorkspaceStaff
from app.models.project import Project, ProjectUpdate
from app.models.review import ReviewRound

def get_user_active_group(db: Session, user_id: int) -> Optional[Group]:
    """Returns the single active group that the user currently belongs to, or None."""
    membership = (
        db.query(GroupMembership)
        .join(Group, GroupMembership.group_id == Group.id)
        .filter(GroupMembership.user_id == user_id, Group.is_deleted == False)
        .first()
    )
    if membership:
        return membership.group
    return None

def is_user_group_member(db: Session, user_id: int, group_id: int) -> bool:
    """Checks whether the user is a current member of the specified group."""
    membership = (
        db.query(GroupMembership)
        .join(Group, GroupMembership.group_id == Group.id)
        .filter(
            GroupMembership.user_id == user_id,
            GroupMembership.group_id == group_id,
            Group.is_deleted == False
        )
        .first()
    )
    return membership is not None

def can_access_group(db: Session, user_id: int, group_id: int) -> bool:
    """A student can only access details of their own active group."""
    return is_user_group_member(db, user_id, group_id)

def can_access_workspace(db: Session, user_id: int, workspace_id: str) -> bool:
    """
    A student can access a workspace if their active group is enrolled in it.
    A staff member can access if they are assigned staff or owner.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return False

    if user.role.lower() == "staff":
        staff_entry = (
            db.query(WorkspaceStaff)
            .filter(WorkspaceStaff.workspace_id == workspace_id, WorkspaceStaff.user_id == user_id)
            .first()
        )
        workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
        return staff_entry is not None or (workspace is not None and workspace.owner_id == user_id)

    # Student check: active group enrolled
    user_group = get_user_active_group(db, user_id)
    if not user_group:
        return False

    enrollment = (
        db.query(WorkspaceGroup)
        .filter(WorkspaceGroup.workspace_id == workspace_id, WorkspaceGroup.group_id == user_group.id)
        .first()
    )
    return enrollment is not None

def can_access_project(db: Session, user_id: int, project: Project) -> bool:
    """
    Project access is derived strictly from current group membership.
    If a student left the group, access is immediately revoked.
    Staff can access if assigned to the workspace.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return False

    if user.role.lower() == "staff":
        return can_access_workspace(db, user_id, project.workspace_id)

    # Student must currently belong to project's group
    return is_user_group_member(db, user_id, project.group_id)

def can_create_project(db: Session, user_id: int, workspace_id: str) -> Tuple[bool, Optional[str], Optional[Group]]:
    """
    A student can create a project in a workspace if:
    1. They belong to an active group.
    2. The group has at least 2 members.
    3. The group is actively enrolled in the workspace.
    4. The group does NOT already have a project in this workspace.
    5. The workspace is open and not archived.
    """
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        return False, "Workspace not found.", None

    if workspace.is_archived or not workspace.is_open:
        return False, "Workspace is currently closed or archived.", None

    group = get_user_active_group(db, user_id)
    if not group:
        return False, "You do not belong to an active group.", None

    member_count = db.query(GroupMembership).filter(GroupMembership.group_id == group.id).count()
    if member_count < 2:
        return False, "Your group must have at least 2 members to create a project.", group

    enrollment = (
        db.query(WorkspaceGroup)
        .filter(WorkspaceGroup.workspace_id == workspace_id, WorkspaceGroup.group_id == group.id)
        .first()
    )
    if not enrollment:
        return False, "Your group is not enrolled in this workspace.", group

    existing_project = (
        db.query(Project)
        .filter(Project.workspace_id == workspace_id, Project.group_id == group.id)
        .first()
    )
    if existing_project:
        return False, f"Your group already has a project '{existing_project.name}' in this workspace.", group

    return True, None, group

def can_submit_to_round(db: Session, user_id: int, project: Project, round_id: int) -> Tuple[bool, Optional[str], Optional[Group]]:
    """
    A student can submit if:
    1. They are a current member of the project's group.
    2. The group has at least 2 active members.
    3. The workspace is active and not archived.
    4. The round is open.
    5. The group enrollment is active.
    """
    if not is_user_group_member(db, user_id, project.group_id):
        return False, "You are not a current member of this project's group.", None

    group = db.query(Group).filter(Group.id == project.group_id).first()
    member_count = db.query(GroupMembership).filter(GroupMembership.group_id == group.id).count()
    if member_count < 2:
        return False, "Your group must have at least 2 members to submit work.", group

    workspace = db.query(Workspace).filter(Workspace.id == project.workspace_id).first()
    if not workspace or workspace.is_archived:
        return False, "This workspace is archived. Submissions are disabled.", group

    # Check enrollment
    enrollment = (
        db.query(WorkspaceGroup)
        .filter(WorkspaceGroup.workspace_id == project.workspace_id, WorkspaceGroup.group_id == group.id)
        .first()
    )
    if not enrollment:
        return False, "Your group is no longer enrolled in this workspace.", group

    # Check round
    round_obj = db.query(ReviewRound).filter(ReviewRound.id == round_id, ReviewRound.workspace_id == project.workspace_id).first()
    if not round_obj:
        return False, "Review round not found.", group

    if not round_obj.is_open:
        return False, f"Review round '{round_obj.title}' is closed for submissions.", group

    return True, None, group
