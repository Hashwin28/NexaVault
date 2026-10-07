from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_staff
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceStaff
from app.models.audit import AuditLog
from app.schemas.audit import AuditLogResponse

router = APIRouter(prefix="/audit", tags=["Audit Trail"])

@router.get("/logs", response_model=List[AuditLogResponse])
def get_staff_audit_logs(
    workspace_id: Optional[str] = Query(None, description="Optional filter by workspace ID"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
):
    """
    Staff views audit logs for Workspaces they manage.
    """
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

    logs = (
        db.query(AuditLog)
        .filter(AuditLog.workspace_id.in_(target_ws_ids))
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
