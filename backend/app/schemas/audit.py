from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, ConfigDict, model_validator

class AuditLogResponse(BaseModel):
    id: int
    actor_id: Optional[int] = None
    actor_name: Optional[str] = None
    actor_email: Optional[str] = None
    action_type: str
    action: Optional[str] = None
    category: Optional[str] = "SYSTEM"
    entity_type: str
    entity_id: Optional[int] = None
    resource_type: Optional[str] = None
    resource_id: Optional[int] = None
    resource_name: Optional[str] = None
    workspace_id: Optional[str] = None
    status: Optional[str] = "SUCCESS"
    outcome: Optional[str] = "SUCCESS"
    description: Optional[str] = None
    details: Optional[str] = None
    error_reason: Optional[str] = None
    request_id: Optional[str] = None
    ip_address: Optional[str] = None
    old_value: Optional[Dict[str, Any]] = None
    new_value: Optional[Dict[str, Any]] = None
    created_at: datetime
    timestamp: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def populate_aliases(self):
        if not self.action:
            self.action = self.action_type
        if not self.outcome:
            self.outcome = self.status or "SUCCESS"
        if not self.timestamp:
            self.timestamp = self.created_at
        if not self.details:
            self.details = self.description or self.action
        return self

class AuditEventResponse(BaseModel):
    id: int
    timestamp: datetime
    action: str
    action_type: str
    category: str
    status: str
    outcome: str
    actor_id: Optional[int] = None
    actor_name: str
    actor_email: Optional[str] = None
    actor_role: Optional[str] = None
    workspace_id: Optional[str] = None
    workspace_name: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[int] = None
    resource_name: Optional[str] = None
    description: Optional[str] = None
    details: Optional[str] = None
    error_reason: Optional[str] = None
    request_id: Optional[str] = None
    ip_address: Optional[str] = None
    old_value: Optional[Dict[str, Any]] = None
    new_value: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)

class AuditActivityPaginatedResponse(BaseModel):
    items: List[AuditEventResponse]
    total: int
    limit: int
    offset: int
    page: int
    total_pages: int

class AuditStatsResponse(BaseModel):
    total_events: int
    workspace_changes: int
    access_changes: int
    security_events: int
    failure_count: int
    time_range: str

class AuditFilterOption(BaseModel):
    id: str
    label: str

class AuditFiltersResponse(BaseModel):
    workspaces: List[AuditFilterOption]
    categories: List[str]
    action_types: List[AuditFilterOption]
    actors: List[AuditFilterOption]
