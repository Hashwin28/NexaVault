import random
import string
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_student
from app.models.user import User
from app.models.group import Group
from app.schemas.group import GroupCreate, GroupJoin, GroupResponse, GroupMessageResponse, UserSummary

router = APIRouter()

def generate_unique_code(db: Session, prefix: str = "NV") -> str:
    """Generates a random unique group code."""
    for _ in range(20):
        rand_str = "".join(random.choices(string.ascii_uppercase + string.digits, k=5))
        candidate = f"{prefix}-{rand_str}"
        existing = db.query(Group).filter(Group.code == candidate).first()
        if not existing:
            return candidate
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Could not generate a unique group code. Please provide one manually."
    )

def build_group_response(group: Group, current_user_id: int) -> GroupResponse:
    """Builds GroupResponse with computed boolean flags for current user."""
    is_leader = (group.leader_id == current_user_id)
    is_member = any(m.id == current_user_id for m in group.members) or is_leader

    return GroupResponse(
        id=group.id,
        name=group.name,
        code=group.code,
        leader_id=group.leader_id,
        workspace_code=group.workspace_code,
        project_title=group.project_title,
        created_at=group.created_at,
        leader=UserSummary.model_validate(group.leader) if hasattr(UserSummary, 'model_validate') else UserSummary.from_orm(group.leader),
        members=[UserSummary.model_validate(m) if hasattr(UserSummary, 'model_validate') else UserSummary.from_orm(m) for m in group.members],
        is_leader=is_leader,
        is_member=is_member
    )

@router.post("/", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
def create_group(
    group_in: GroupCreate,
    db: Session = Depends(get_db),
    current_student: User = Depends(get_current_student)
):
    """
    Create a new Group.
    The authenticated student automatically becomes the Group Leader.
    Generates a unique group code if not provided.
    """
    # Generate or validate custom group code
    if group_in.code and group_in.code.strip():
        code = group_in.code.strip().upper()
        existing = db.query(Group).filter(Group.code == code).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Group code '{code}' already exists. Please choose a different code."
            )
    else:
        code = generate_unique_code(db)

    new_group = Group(
        name=group_in.name.strip(),
        code=code,
        leader_id=current_student.id,
        workspace_code=group_in.workspace_code.strip() if group_in.workspace_code else None,
        project_title=group_in.project_title.strip() if group_in.project_title else None
    )

    # Creator automatically becomes leader and member
    new_group.members.append(current_student)
    
    db.add(new_group)
    db.commit()
    db.refresh(new_group)

    return build_group_response(new_group, current_student.id)

@router.get("/", response_model=List[GroupResponse])
def list_my_groups(
    db: Session = Depends(get_db),
    current_student: User = Depends(get_current_student)
):
    """
    List all groups that the authenticated student belongs to (either as Leader or Member).
    """
    all_groups = db.query(Group).all()
    my_groups = [
        g for g in all_groups 
        if g.leader_id == current_student.id or any(m.id == current_student.id for m in g.members)
    ]
    return [build_group_response(g, current_student.id) for g in my_groups]

@router.post("/join", response_model=GroupResponse)
def join_group(
    join_in: GroupJoin,
    db: Session = Depends(get_db),
    current_student: User = Depends(get_current_student)
):
    """
    Join a Group by providing its unique Group Code.
    """
    code = join_in.code.strip().upper()
    group = db.query(Group).filter(Group.code == code).first()

    if not group:
      raise HTTPException(
          status_code=status.HTTP_404_NOT_FOUND,
          detail="Invalid Group Code. No matching group found."
      )

    # Check if user is already a member or leader
    if any(m.id == current_student.id for m in group.members):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You are already a member of group '{group.name}'."
        )

    group.members.append(current_student)
    db.commit()
    db.refresh(group)

    return build_group_response(group, current_student.id)

@router.get("/{group_id}", response_model=GroupResponse)
def get_group_details(
    group_id: int,
    db: Session = Depends(get_db),
    current_student: User = Depends(get_current_student)
):
    """
    Get Group details. Only members of the group can view its details.
    """
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found."
        )

    is_member = any(m.id == current_student.id for m in group.members) or group.leader_id == current_student.id
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You must be a member of this group to view its details."
        )

    return build_group_response(group, current_student.id)

@router.post("/{group_id}/leave", response_model=GroupMessageResponse)
def leave_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_student: User = Depends(get_current_student)
):
    """
    Leave a Group (for regular members).
    The Group Leader cannot leave without deleting the group.
    """
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found."
        )

    if group.leader_id == current_student.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="As the Group Leader, you cannot leave the group. You must delete the group instead."
        )

    is_member = any(m.id == current_student.id for m in group.members)
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are not a member of this group."
        )

    group.members.remove(current_student)
    db.commit()

    return GroupMessageResponse(message=f"You have successfully left the group '{group.name}'.")

@router.delete("/{group_id}", response_model=GroupMessageResponse)
def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_student: User = Depends(get_current_student)
):
    """
    Delete a Group. Only the Group Leader is authorized to delete the group.
    """
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found."
        )

    if group.leader_id != current_student.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: Only the Group Leader can delete this group."
        )

    group_name = group.name
    db.delete(group)
    db.commit()

    return GroupMessageResponse(message=f"Group '{group_name}' has been successfully deleted.")
