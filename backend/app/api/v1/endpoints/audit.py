from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceStaff, WorkspaceGroup
from app.models.audit import AuditLog
from app.schemas.audit import AuditLogResponse
from app.core.permissions import get_user_active_group

router = APIRouter(prefix="/audit", tags=["Audit Trail"])

@router.get("/logs", response_model=List[AuditLogResponse])
def get_audit_logs(
    workspace_id: Optional[str] = Query(None, description="Optional filter by workspace ID"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Role-scoped append-only audit trail reader.
    - Staff sees events from managed workspaces.
    - Students see events they authored and events belonging to their enrolled group/project.
    """
    if current_user.role.lower() == "staff":
        staff_entries = db.query(WorkspaceStaff).filter(WorkspaceStaff.user_id == current_user.id).all()
        ws_ids = {s.workspace_id for s in staff_entries}
        owned = db.query(Workspace).filter(Workspace.owner_id == current_user.id).all()
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

        logs = (
            db.query(AuditLog)
            .filter(AuditLog.workspace_id.in_(target_ws_ids))
            .order_by(AuditLog.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
    else:
        # Student user
        active_group = get_user_active_group(db, current_user.id)
        enrolled_ws_ids = []
        if active_group:
            enrs = db.query(WorkspaceGroup).filter(WorkspaceGroup.group_id == active_group.id).all()
            enrolled_ws_ids = [e.workspace_id for e in enrs]

        if workspace_id:
            if workspace_id not in enrolled_ws_ids:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Workspace not found or enrollment required."
                )
            filter_conditions = [
                AuditLog.actor_id == current_user.id,
                (AuditLog.workspace_id == workspace_id)
            ]
        else:
            filter_conditions = [
                AuditLog.actor_id == current_user.id,
            ]
            if enrolled_ws_ids:
                filter_conditions.append(AuditLog.workspace_id.in_(enrolled_ws_ids))

        logs = (
            db.query(AuditLog)
            .filter(or_(*filter_conditions))
            .order_by(AuditLog.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

    return [
        AuditLogResponse(
            id=l.id,
            actor_id=l.actor_id,
            actor_name=l.actor.full_name if l.actor else "System",
            action_type=l.action_type,
            entity_type=l.entity_type,
            entity_id=l.entity_id,
            workspace_id=l.workspace_id,
            old_value=l.old_value,
            new_value=l.new_value,
            created_at=l.created_at,
        )
        for l in logs
    ]
