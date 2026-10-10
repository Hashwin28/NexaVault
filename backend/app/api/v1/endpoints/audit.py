import math
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func

from app.api.deps import get_db, get_current_user, get_current_staff
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceStaff, WorkspaceGroup
from app.models.audit import AuditLog
from app.schemas.audit import (
    AuditLogResponse,
    AuditEventResponse,
    AuditActivityPaginatedResponse,
    AuditStatsResponse,
    AuditFiltersResponse,
    AuditFilterOption,
)
from app.core.permissions import get_user_active_group

router = APIRouter(prefix="/audit", tags=["Administrative Activity Center"])

def get_staff_managed_workspaces(db: Session, staff_id: int) -> List[str]:
    """Returns list of workspace IDs managed or owned by the staff user."""
    staff_entries = db.query(WorkspaceStaff).filter(WorkspaceStaff.user_id == staff_id).all()
    ws_ids = {s.workspace_id for s in staff_entries}
    owned = db.query(Workspace).filter(Workspace.owner_id == staff_id).all()
    for o in owned:
        ws_ids.add(o.id)
    return list(ws_ids)

def apply_time_range_filter(query, time_range: Optional[str], start_date: Optional[datetime], end_date: Optional[datetime]):
    """Applies time-based filtering using UTC timestamps."""
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

@router.get("/activity", response_model=AuditActivityPaginatedResponse)
def get_activity_feed(
    workspace_id: Optional[str] = Query(None, description="Filter by workspace ID"),
    actor_id: Optional[int] = Query(None, description="Filter by actor ID"),
    category: Optional[str] = Query(None, description="Filter by category (WORKSPACE, ACCESS, SECURITY, etc.)"),
    action_type: Optional[str] = Query(None, description="Filter by action type"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by outcome (SUCCESS, FAILURE)"),
    time_range: Optional[str] = Query("all", description="24h, 7d, 30d, all"),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    search: Optional[str] = Query(None, description="Search keyword across actor, action, workspace, or resource"),
    limit: int = Query(25, ge=1, le=100, description="Events per page (25 or 50)"),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
):
    """
    Administrative Activity Center log feed.
    Restricted to authorized staff. Supports full multi-faceted filtering, searching, and server-side pagination.
    """
    managed_ws_ids = get_staff_managed_workspaces(db, current_staff.id)

    # 1. Base query with eager relationship loading to eliminate N+1 queries
    query = (
        db.query(AuditLog)
        .options(joinedload(AuditLog.actor), joinedload(AuditLog.workspace))
    )

    # 2. Workspace scoping & permissions
    if workspace_id:
        if workspace_id not in managed_ws_ids:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found or access denied."
            )
        query = query.filter(AuditLog.workspace_id == workspace_id)
    else:
        # Include all managed workspaces PLUS global events (workspace_id IS NULL)
        query = query.filter(
            or_(
                AuditLog.workspace_id.in_(managed_ws_ids),
                AuditLog.workspace_id.is_(None)
            )
        )

    # 3. Category filter
    if category and category.upper() != "ALL":
        query = query.filter(AuditLog.category == category.upper())

    # 4. Action Type filter
    if action_type and action_type.strip():
        query = query.filter(AuditLog.action_type == action_type.strip())

    # 5. Outcome / Status filter
    if status_filter and status_filter.upper() != "ALL":
        query = query.filter(AuditLog.status == status_filter.upper())

    # 6. Actor filter
    if actor_id:
        query = query.filter(AuditLog.actor_id == actor_id)

    # 7. Time range / Date range filter
    query = apply_time_range_filter(query, time_range, start_date, end_date)

    # 8. Full-text search
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

    # 9. Total count for pagination
    total = query.count()

    # 10. Order by timestamp descending and apply pagination limit/offset
    logs = (
        query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    # 11. Format responses
    items = []
    for l in logs:
        actor_name = l.actor.full_name if l.actor else ("System / Automated" if not l.actor_id else f"User #{l.actor_id}")
        actor_email = l.actor.email if l.actor else None
        actor_role = l.actor.role if l.actor else None
        ws_name = l.workspace.name if l.workspace else None

        items.append(
            AuditEventResponse(
                id=l.id,
                timestamp=l.created_at,
                action=l.action_name or l.action_type,
                action_type=l.action_type,
                category=l.category or "SYSTEM",
                status=l.status or "SUCCESS",
                outcome=l.status or "SUCCESS",
                actor_id=l.actor_id,
                actor_name=actor_name,
                actor_email=actor_email,
                actor_role=actor_role,
                workspace_id=l.workspace_id,
                workspace_name=ws_name,
                resource_type=l.resource_type or l.entity_type,
                resource_id=l.entity_id,
                resource_name=l.resource_name,
                description=l.description,
                details=l.description or l.action_name or l.action_type,
                error_reason=l.error_reason,
                request_id=l.request_id,
                ip_address=l.ip_address,
                old_value=l.old_value,
                new_value=l.new_value,
            )
        )

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

@router.get("/stats", response_model=AuditStatsResponse)
def get_activity_stats(
    workspace_id: Optional[str] = Query(None, description="Optional workspace scope"),
    time_range: str = Query("all", description="24h, 7d, 30d, all"),
    db: Session = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
):
    """
    Calculates real aggregated statistics for the Activity Center overview cards.
    Total Events, Workspace Changes, Access Changes, Security Events, and Failure counts.
    """
    managed_ws_ids = get_staff_managed_workspaces(db, current_staff.id)

    query = db.query(AuditLog)
    if workspace_id:
        if workspace_id not in managed_ws_ids:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workspace not found or access denied."
            )
        query = query.filter(AuditLog.workspace_id == workspace_id)
    else:
        query = query.filter(
            or_(
                AuditLog.workspace_id.in_(managed_ws_ids),
                AuditLog.workspace_id.is_(None)
            )
        )

    query = apply_time_range_filter(query, time_range, None, None)

    # Calculate real aggregations directly in database
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

@router.get("/filters", response_model=AuditFiltersResponse)
def get_activity_filters(
    db: Session = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
):
    """
    Returns dynamically populated filter choices for workspaces, categories, and actions.
    """
    managed_ws_ids = get_staff_managed_workspaces(db, current_staff.id)
    workspaces = (
        db.query(Workspace)
        .filter(Workspace.id.in_(managed_ws_ids))
        .order_by(Workspace.name.asc())
        .all()
    )
    ws_options = [AuditFilterOption(id=ws.id, label=f"{ws.name} (#{ws.id})") for ws in workspaces]

    # Categories
    categories = ["ALL", "WORKSPACE", "ACCESS", "SECURITY", "ASSESSMENT", "NOTICE", "PROJECT"]

    # Action Types
    actions = (
        db.query(AuditLog.action_type, AuditLog.action_name)
        .filter(or_(AuditLog.workspace_id.in_(managed_ws_ids), AuditLog.workspace_id.is_(None)))
        .distinct()
        .all()
    )
    action_options = [
        AuditFilterOption(id=a[0], label=a[1] or a[0].replace("_", " ").title())
        for a in actions if a[0]
    ]

    # Actors
    actors = (
        db.query(User.id, User.full_name, User.email)
        .join(AuditLog, User.id == AuditLog.actor_id)
        .filter(or_(AuditLog.workspace_id.in_(managed_ws_ids), AuditLog.workspace_id.is_(None)))
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

@router.get("/logs", response_model=List[AuditLogResponse])
def get_audit_logs(
    workspace_id: Optional[str] = Query(None, description="Optional filter by workspace ID"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Backward-compatible role-scoped append-only audit trail reader.
    - Staff sees events from managed workspaces and global security events.
    - Students see events they authored and events belonging to their enrolled workspace/group.
    """
    if current_user.role.lower() == "staff":
        managed_ws_ids = get_staff_managed_workspaces(db, current_user.id)
        if not managed_ws_ids:
            return []

        if workspace_id:
            if workspace_id not in managed_ws_ids:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Workspace not found or access denied."
                )
            target_filter = AuditLog.workspace_id == workspace_id
        else:
            target_filter = or_(
                AuditLog.workspace_id.in_(managed_ws_ids),
                AuditLog.workspace_id.is_(None)
            )

        logs = (
            db.query(AuditLog)
            .options(joinedload(AuditLog.actor))
            .filter(target_filter)
            .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
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
            .options(joinedload(AuditLog.actor))
            .filter(or_(*filter_conditions))
            .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

    return [
        AuditLogResponse(
            id=l.id,
            actor_id=l.actor_id,
            actor_name=l.actor.full_name if l.actor else "System",
            actor_email=l.actor.email if l.actor else None,
            action_type=l.action_type,
            action=l.action_name or l.action_type,
            category=l.category or "SYSTEM",
            entity_type=l.entity_type,
            entity_id=l.entity_id,
            resource_type=l.resource_type or l.entity_type,
            resource_id=l.entity_id,
            resource_name=l.resource_name,
            workspace_id=l.workspace_id,
            status=l.status or "SUCCESS",
            outcome=l.status or "SUCCESS",
            description=l.description,
            details=l.description or l.action_name or l.action_type,
            error_reason=l.error_reason,
            request_id=l.request_id,
            ip_address=l.ip_address,
            old_value=l.old_value,
            new_value=l.new_value,
            created_at=l.created_at,
            timestamp=l.created_at,
        )
        for l in logs
    ]
