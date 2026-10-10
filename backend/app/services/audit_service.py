import re
from typing import Optional, Any, Dict
from sqlalchemy.orm import Session
from app.models.audit import AuditLog

SENSITIVE_KEYWORDS = {
    "password", "secret", "token", "credential", "auth", "api_key", "private_key", "jwt"
}

def is_sensitive_key(k: str) -> bool:
    kl = str(k).lower()
    return any(sub in kl for sub in SENSITIVE_KEYWORDS)

def sanitize_metadata(data: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Recursively removes passwords, tokens, and secret fields from audit metadata."""
    if not isinstance(data, dict):
        return data
    sanitized = {}
    for k, v in data.items():
        if is_sensitive_key(k):
            sanitized[k] = "[REDACTED]"
        elif isinstance(v, dict):
            sanitized[k] = sanitize_metadata(v)
        elif isinstance(v, list):
            sanitized[k] = [sanitize_metadata(item) if isinstance(item, dict) else item for item in v]
        else:
            sanitized[k] = v
    return sanitized

sanitize_audit_metadata = sanitize_metadata

ACTION_META_REGISTRY = {
    # Security
    "USER_REGISTERED": ("SECURITY", "User Registration", "New account registered on NexaVault platform"),
    "USER_LOGIN": ("SECURITY", "User Login", "User authenticated into the platform"),
    "USER_LOGIN_SUCCESS": ("SECURITY", "User Login Succeeded", "User authentication successful"),
    "USER_LOGIN_FAILED": ("SECURITY", "User Login Failed", "User failed authentication attempt"),
    "ACCESS_DENIED": ("SECURITY", "Access Denied", "Unauthorized attempt to access protected resource"),
    
    # Access & Permissions
    "MEMBER_JOINED": ("ACCESS", "Member Joined Group", "Student enrolled as a member of the group"),
    "MEMBER_REMOVED": ("ACCESS", "Member Removed", "Group membership revoked"),
    "GROUP_CREATED": ("ACCESS", "Group Created", "New student project group formed"),
    "costaff_added": ("ACCESS", "Co-Staff Added", "Staff permissions granted for workspace"),
    "costaff_removed": ("ACCESS", "Co-Staff Removed", "Staff permissions revoked from workspace"),
    "staff_request_created": ("ACCESS", "Staff Access Requested", "User submitted request for staff workspace access"),
    "staff_request_approved": ("ACCESS", "Staff Access Approved", "Workspace access request approved"),
    "staff_request_rejected": ("ACCESS", "Staff Access Rejected", "Workspace access request rejected"),

    # Workspace
    "workspace_created": ("WORKSPACE", "Workspace Initialized", "New academic workspace created"),
    "workspace_archived": ("WORKSPACE", "Workspace Archived", "Workspace archived and marked read-only"),
    "WORKSPACE_ENROLLED": ("WORKSPACE", "Workspace Enrolled", "Group enrolled into workspace curriculum"),

    # Notices
    "notice_created": ("NOTICE", "Notice Published", "Faculty notice published to workspace notice board"),
    "notice_edited": ("NOTICE", "Notice Updated", "Workspace notice content modified"),
    "notice_pinned": ("NOTICE", "Notice Pinned", "Workspace notice pinned to top of board"),
    "notice_unpinned": ("NOTICE", "Notice Unpinned", "Workspace notice unpinned from top"),
    "notice_deleted": ("NOTICE", "Notice Deleted", "Workspace notice and associated media deleted"),
    "notice_archived": ("NOTICE", "Notice Archived", "Workspace notice archived"),

    # Assessments & Review
    "round_created": ("ASSESSMENT", "Review Round Created", "New evaluation milestone configured"),
    "round_updated": ("ASSESSMENT", "Review Round Updated", "Review round parameters updated"),
    "round_toggled": ("ASSESSMENT", "Round Status Toggled", "Review round active state changed"),
    "round_deleted": ("ASSESSMENT", "Review Round Deleted", "Review round removed from workspace"),
    "submission_created": ("ASSESSMENT", "Deliverable Submitted", "Student group uploaded milestone submission"),
    "submission_claimed": ("ASSESSMENT", "Review Claimed", "Staff claimed student submission for evaluation"),
    "review_submitted": ("ASSESSMENT", "Evaluation Scored", "Staff completed scoring for student submission"),
    "score_awarded": ("ASSESSMENT", "Evaluation Scored", "Staff completed scoring for student submission"),
    "result_released": ("ASSESSMENT", "Results Released", "Evaluation marks released to enrolled students"),
    "result_corrected": ("ASSESSMENT", "Grade Corrected", "Grade correction applied with audit justification"),

    # Projects
    "PROJECT_CREATED": ("PROJECT", "Project Created", "New workspace project initiated"),
    "project_created": ("PROJECT", "Project Created", "New workspace project initiated"),
    "project_updated": ("PROJECT", "Project Updated", "Project details modified"),
    "project_repo_linked": ("PROJECT", "GitHub Linked", "GitHub repository linked to student project"),
}

def resolve_action_meta(action_type: str, category: Optional[str] = None, action_name: Optional[str] = None, description: Optional[str] = None):
    """Infers category, human-readable name, and description if not explicitly provided."""
    reg = ACTION_META_REGISTRY.get(action_type)
    if reg:
        default_cat, default_name, default_desc = reg
        return (category or default_cat, action_name or default_name, description or default_desc)

    # Heuristic inference
    cat = category
    if not cat:
        act_lower = action_type.lower()
        if "login" in act_lower or "auth" in act_lower or "denied" in act_lower:
            cat = "SECURITY"
        elif "staff" in act_lower or "member" in act_lower or "group" in act_lower:
            cat = "ACCESS"
        elif "workspace" in act_lower:
            cat = "WORKSPACE"
        elif "notice" in act_lower:
            cat = "NOTICE"
        elif "round" in act_lower or "review" in act_lower or "score" in act_lower or "result" in act_lower:
            cat = "ASSESSMENT"
        elif "project" in act_lower or "submission" in act_lower:
            cat = "PROJECT"
        else:
            cat = "SYSTEM"

    name = action_name or action_type.replace("_", " ").title()
    desc = description or f"Operation '{name}' performed"
    return cat, name, desc

def log_audit_event(
    db: Session,
    action_type: str,
    category: Optional[str] = None,
    status: str = "SUCCESS",
    actor_id: Optional[int] = None,
    workspace_id: Optional[str] = None,
    action_name: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[int] = None,
    resource_name: Optional[str] = None,
    description: Optional[str] = None,
    error_reason: Optional[str] = None,
    old_value: Optional[Dict[str, Any]] = None,
    new_value: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    request_id: Optional[str] = None,
) -> AuditLog:
    """
    Centralized, append-only administrative audit event logger.
    Automatically categorizes events, scrubs sensitive tokens, and standardizes metadata.
    """
    cat, name, desc = resolve_action_meta(action_type, category, action_name, description)

    entry = AuditLog(
        actor_id=actor_id,
        category=cat.upper(),
        action_type=action_type,
        action_name=name,
        entity_type=resource_type or "SYSTEM",
        entity_id=resource_id,
        resource_type=resource_type,
        resource_name=resource_name,
        workspace_id=workspace_id,
        status=status.upper(),
        description=desc,
        error_reason=error_reason,
        old_value=sanitize_metadata(old_value),
        new_value=sanitize_metadata(new_value),
        ip_address=ip_address,
        request_id=request_id,
    )
    db.add(entry)
    return entry

def log_audit(
    db: Session,
    action_type: str,
    entity_type: str = "SYSTEM",
    actor_id: Optional[int] = None,
    entity_id: Optional[int] = None,
    workspace_id: Optional[str] = None,
    old_value: Optional[Dict[str, Any]] = None,
    new_value: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    status: str = "SUCCESS",
    category: Optional[str] = None,
    resource_name: Optional[str] = None,
    description: Optional[str] = None,
    details: Optional[str] = None,
    error_reason: Optional[str] = None,
    request_id: Optional[str] = None,
    **kwargs,
) -> AuditLog:
    """
    Universal backwards-compatible adapter mapping legacy parameters into log_audit_event.
    """
    final_desc = description or details
    return log_audit_event(
        db=db,
        action_type=action_type,
        category=category,
        status=status,
        actor_id=actor_id,
        workspace_id=workspace_id,
        resource_type=entity_type,
        resource_id=entity_id,
        resource_name=resource_name,
        description=final_desc,
        old_value=old_value,
        new_value=new_value,
        ip_address=ip_address,
        error_reason=error_reason,
        request_id=request_id,
    )
