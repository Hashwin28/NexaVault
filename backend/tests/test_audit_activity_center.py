import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.db.session import SessionLocal
from app.core.security import hash_password, create_access_token
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceStaff
from app.models.audit import AuditLog
from app.services.audit_service import log_audit_event, sanitize_audit_metadata

client = TestClient(app)

@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def auth_headers(email: str) -> dict:
    token = create_access_token(subject=email)
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def setup_audit_env(db_session: Session):
    ts = datetime.now().strftime("%Y%m%d%H%M%S%f")

    # Staff user
    staff_email = f"staff_audit_{ts}@nexavault.edu"
    staff = User(
        email=staff_email,
        hashed_password=hash_password("AuditSecret123!"),
        full_name="Audit Staff Admin",
        role="staff",
        is_active=True,
    )
    db_session.add(staff)

    # Student user
    student_email = f"student_audit_{ts}@nexavault.edu"
    student = User(
        email=student_email,
        hashed_password=hash_password("StudentPass123!"),
        full_name="Audit Student User",
        role="student",
        is_active=True,
    )
    db_session.add(student)
    db_session.flush()

    import uuid
    ws_id = f"WS-AUDIT-{uuid.uuid4().hex[:8].upper()}"
    ws = Workspace(
        id=ws_id,
        name=f"Audit Center Workspace {uuid.uuid4().hex[:6].upper()}",
        owner_id=staff.id,
        term="Fall 2026",
    )
    db_session.add(ws)
    db_session.flush()

    staff_link = WorkspaceStaff(workspace_id=ws.id, user_id=staff.id, role="owner")
    db_session.add(staff_link)
    db_session.commit()

    return {
        "staff": staff,
        "staff_headers": auth_headers(staff_email),
        "student": student,
        "student_headers": auth_headers(student_email),
        "workspace": ws,
    }

def test_sensitive_metadata_sanitization():
    """Verify passwords, tokens, and secrets are strictly redacted before audit persistence."""
    raw_payload = {
        "user_email": "admin@nexavault.edu",
        "password": "SuperSecretPassword123",
        "hashed_password": "$2b$12$somehashhere",
        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
        "refresh_token": "refresh_token_abc",
        "secret_key": "raw_secret",
        "nested": {
            "api_key": "api_secret_12345",
            "safe_field": "valid_value",
        },
    }

    sanitized = sanitize_audit_metadata(raw_payload)
    assert sanitized["password"] == "[REDACTED]"
    assert sanitized["hashed_password"] == "[REDACTED]"
    assert sanitized["access_token"] == "[REDACTED]"
    assert sanitized["refresh_token"] == "[REDACTED]"
    assert sanitized["secret_key"] == "[REDACTED]"
    assert sanitized["nested"]["api_key"] == "[REDACTED]"
    assert sanitized["nested"]["safe_field"] == "valid_value"
    assert sanitized["user_email"] == "admin@nexavault.edu"

def test_activity_stats_aggregation(setup_audit_env, db_session: Session):
    """Verify /api/v1/audit/stats calculates accurate real database counts across categories."""
    env = setup_audit_env
    staff = env["staff"]
    ws = env["workspace"]

    # Insert test audit events
    log_audit_event(
        db=db_session,
        action_type="WORKSPACE_CREATE",
        category="WORKSPACE",
        status="SUCCESS",
        actor_id=staff.id,
        workspace_id=ws.id,
        resource_type="workspace",
        resource_name=ws.name,
        description=f"Created workspace {ws.name}",
    )
    log_audit_event(
        db=db_session,
        action_type="MEMBER_ADDED",
        category="ACCESS",
        status="SUCCESS",
        actor_id=staff.id,
        workspace_id=ws.id,
        resource_type="group_membership",
        description="Added member to workspace group",
    )
    log_audit_event(
        db=db_session,
        action_type="ACCESS_DENIED",
        category="SECURITY",
        status="FAILURE",
        actor_id=env["student"].id,
        resource_type="endpoint",
        description="Unauthorized access attempt",
        error_reason="Access forbidden: Staff role required.",
    )
    db_session.commit()

    # Query stats endpoint
    resp = client.get(
        f"/api/v1/audit/stats?workspace_id={ws.id}&time_range=24h",
        headers=env["staff_headers"],
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["total_events"] >= 2
    assert data["workspace_changes"] >= 1
    assert data["access_changes"] >= 1
    assert data["time_range"] == "24h"

def test_activity_feed_filtering_and_pagination(setup_audit_env, db_session: Session):
    """Verify /api/v1/audit/activity supports filtering by category, status, search, and pagination."""
    env = setup_audit_env
    staff = env["staff"]
    ws = env["workspace"]

    unique_keyword = f"KWD_{datetime.now().strftime('%f')}"
    # Log unique searchable event
    log_audit_event(
        db=db_session,
        action_type="SCORE_CORRECTION",
        category="ASSESSMENT",
        status="SUCCESS",
        actor_id=staff.id,
        workspace_id=ws.id,
        resource_type="review",
        resource_name=f"Review_{unique_keyword}",
        description=f"Adjusted evaluation score with tag {unique_keyword}",
        old_value={"score": 80},
        new_value={"score": 95},
    )
    db_session.commit()

    # 1. Search filter
    search_resp = client.get(
        f"/api/v1/audit/activity?search={unique_keyword}&limit=25&offset=0",
        headers=env["staff_headers"],
    )
    assert search_resp.status_code == 200
    data = search_resp.json()
    assert data["total"] >= 1
    matched = [item for item in data["items"] if unique_keyword in (item["description"] or "")]
    assert len(matched) >= 1
    event = matched[0]
    assert event["category"] == "ASSESSMENT"
    assert event["outcome"] == "SUCCESS"
    assert event["old_value"]["score"] == 80
    assert event["new_value"]["score"] == 95

    # 2. Category filter
    cat_resp = client.get(
        "/api/v1/audit/activity?category=ASSESSMENT&limit=10&offset=0",
        headers=env["staff_headers"],
    )
    assert cat_resp.status_code == 200
    cat_data = cat_resp.json()
    for item in cat_data["items"]:
        assert item["category"] == "ASSESSMENT"

    # 3. Status filter
    status_resp = client.get(
        "/api/v1/audit/activity?status=FAILURE&limit=10&offset=0",
        headers=env["staff_headers"],
    )
    assert status_resp.status_code == 200
    status_data = status_resp.json()
    for item in status_data["items"]:
        assert item["status"] == "FAILURE"

def test_dynamic_filters_endpoint(setup_audit_env):
    """Verify /api/v1/audit/filters returns options for workspaces, categories, action types, actors."""
    env = setup_audit_env
    resp = client.get("/api/v1/audit/filters", headers=env["staff_headers"])
    assert resp.status_code == 200
    data = resp.json()
    assert "workspaces" in data
    assert "categories" in data
    assert "action_types" in data
    assert "actors" in data
    assert "ALL" in data["categories"]
    assert "WORKSPACE" in data["categories"]
    assert "SECURITY" in data["categories"]

def test_failed_login_creates_security_audit_event(db_session: Session):
    """Verify failed login attempts log a SECURITY FAILURE audit event."""
    fake_email = f"attacker_{datetime.now().strftime('%f')}@campus.edu"
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": fake_email, "password": "WrongPassword123!"},
    )
    assert login_resp.status_code == 401

    # Check database for logged audit event
    audit_entry = (
        db_session.query(AuditLog)
        .filter(AuditLog.action_type == "USER_LOGIN_FAILED")
        .order_by(AuditLog.created_at.desc())
        .first()
    )
    assert audit_entry is not None
    assert audit_entry.category == "SECURITY"
    assert audit_entry.status == "FAILURE"
    assert fake_email in audit_entry.description
    assert audit_entry.error_reason is not None

def test_student_cannot_access_audit_activity_center(setup_audit_env):
    """Verify students are strictly blocked with 403 Forbidden from accessing administrative activity feed."""
    env = setup_audit_env

    # Activity feed blocked
    resp = client.get("/api/v1/audit/activity", headers=env["student_headers"])
    assert resp.status_code == 403

    # Stats blocked
    stats_resp = client.get("/api/v1/audit/stats", headers=env["student_headers"])
    assert stats_resp.status_code == 403

    # Filters blocked
    filters_resp = client.get("/api/v1/audit/filters", headers=env["student_headers"])
    assert filters_resp.status_code == 403
