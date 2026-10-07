from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, ConfigDict

class AuditLogResponse(BaseModel):
    id: int
    actor_id: Optional[int] = None
    actor_name: Optional[str] = None
    action_type: str
    entity_type: str
    entity_id: Optional[int] = None
    workspace_id: Optional[str] = None
    old_value: Optional[Dict[str, Any]] = None
    new_value: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
