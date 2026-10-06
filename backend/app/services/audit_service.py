from typing import Optional, Any, Dict
from sqlalchemy.orm import Session
from app.models.audit import AuditLog

def log_audit(
    db: Session,
    action_type: str,
    entity_type: str,
    actor_id: Optional[int] = None,
    entity_id: Optional[int] = None,
    old_value: Optional[Dict[str, Any]] = None,
    new_value: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
) -> AuditLog:
    """
    Creates an append-only audit log entry in the active database session.
    """
    entry = AuditLog(
        actor_id=actor_id,
        action_type=action_type,
        entity_type=entity_type,
        entity_id=entity_id,
        old_value=old_value,
        new_value=new_value,
        ip_address=ip_address,
    )
    db.add(entry)
    return entry
