import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.db.session import SessionLocal
from app.core.security import hash_password, create_access_token
from app.core.config import Settings
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceStaff, WorkspaceGroup
from app.models.group import Group, GroupMembership
from app.models.project import Project
from app.models.review import ReviewRound, Submission, SubmissionVersion, Review, ResultEntry
from app.models.audit import AuditLog

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

def test_cors_origins_parsing():
    """Verify CORS_ORIGINS parser supports JSON strings, comma lists, and python lists."""
    # Test JSON string (Render env format)
    s1 = Settings(CORS_ORIGINS='["https://nexa-vault-chi.vercel.app", "http://localhost:5173/"]')
    assert "https://nexa-vault-chi.vercel.app" in s1.CORS_ORIGINS
    assert "http://localhost:5173" in s1.CORS_ORIGINS

    # Test comma-separated string
    s2 = Settings(CORS_ORIGINS="https://nexa-vault-chi.vercel.app, http://localhost:3000")
    assert "https://nexa-vault-chi.vercel.app" in s2.CORS_ORIGINS
    assert "http://localhost:3000" in s2.CORS_ORIGINS

    # Test list format
    s3 = Settings(CORS_ORIGINS=["https://nexa-vault-chi.vercel.app"])
    assert "https://nexa-vault-chi.vercel.app" in s3.CORS_ORIGINS

def test_search_and_audit_role_isolation(db_session: Session):
    timestamp_str = datetime.now().strftime("%Y%m%d%H%M%S")

    # 1. Create Staff & Student users
    staff_email = f"staff_audit_{timestamp_str}@nexavault.edu"
    staff = User(email=staff_email, hashed_password=hash_password("password123"), full_name="Auditing Staff", role="staff")
    db_session.add(staff)

    student1_email = f"student1_audit_{timestamp_str}@nexavault.edu"
    s1 = User(email=student1_email, hashed_password=hash_password("password123"), full_name="Student Alpha", role="student")
    db_session.add(s1)

    student2_email = f"student2_audit_{timestamp_str}@nexavault.edu"
    s2 = User(email=student2_email, hashed_password=hash_password("password123"), full_name="Student Beta", role="student")
    db_session.add(s2)

    db_session.commit()
    db_session.refresh(staff)
    db_session.refresh(s1)
    db_session.refresh(s2)

    # 2. Staff creates workspace
    ws_id = f"WS-AUDIT-{timestamp_str}"
    ws = Workspace(id=ws_id, name=f"Audit Test WS {timestamp_str}", term="Fall 2026", owner_id=staff.id, is_open=True, is_archived=False)
    db_session.add(ws)
    db_session.commit()

    # 3. Student 1 creates group and student 2 joins
    group_code = f"AUD{timestamp_str[-4:]}"
    grp = Group(name=f"Alpha Group {timestamp_str}", code=group_code, created_by=s1.id, is_deleted=False)
    db_session.add(grp)
    db_session.flush()

    m1 = GroupMembership(group_id=grp.id, user_id=s1.id)
    m2 = GroupMembership(group_id=grp.id, user_id=s2.id)
    db_session.add_all([m1, m2])
    db_session.commit()

    # 4. Enroll group in workspace
    enr = WorkspaceGroup(workspace_id=ws.id, group_id=grp.id, enrolled_by=s1.id)
    db_session.add(enr)
    db_session.commit()

    # 5. Create project and submission
    proj = Project(workspace_id=ws.id, group_id=grp.id, name=f"Cryptographic Ledger {timestamp_str}", created_by=s1.id)
    db_session.add(proj)
    db_session.commit()

    round_obj = ReviewRound(
        workspace_id=ws.id,
        title="Audit Round 1",
        order_index=1,
        due_date=datetime.now(timezone.utc) + timedelta(days=7),
        max_score=100.0,
        is_open=True
    )
    db_session.add(round_obj)
    db_session.commit()

    # Student submits deliverable
    sub_resp = client.post(
        f"/api/v1/projects/{proj.id}/rounds/{round_obj.id}/submissions",
        json={"notes": "Final Audit Deliverable v1", "link": "https://github.com/org/repo", "is_draft": False},
        headers=auth_headers(s1.email)
    )
    assert sub_resp.status_code == 201

    # 6. Test Smart Search for Staff
    staff_search_resp = client.get(
        f"/api/v1/search?q={timestamp_str}",
        headers=auth_headers(staff.email)
    )
    assert staff_search_resp.status_code == 200
    staff_data = staff_search_resp.json()
    assert len(staff_data["workspaces"]) >= 1
    assert len(staff_data["groups"]) >= 1
    assert len(staff_data["projects"]) >= 1
    # Ensure Group Code is NOT exposed in search response
    for g in staff_data["groups"]:
        assert "code" not in g or g.get("code") is None

    # 7. Test Smart Search for Student
    student_search_resp = client.get(
        f"/api/v1/search?q={timestamp_str}",
        headers=auth_headers(s1.email)
    )
    assert student_search_resp.status_code == 200
    student_data = student_search_resp.json()
    assert len(student_data["workspaces"]) >= 1
    assert len(student_data["projects"]) >= 1
    assert len(student_data["students"]) == 0  # Students cannot search student directory

    # 8. Test Audit Trail for Student and Staff
    student_audit_resp = client.get(
        "/api/v1/audit/logs",
        headers=auth_headers(s1.email)
    )
    assert student_audit_resp.status_code == 200
    assert len(student_audit_resp.json()) >= 1

    staff_audit_resp = client.get(
        "/api/v1/audit/logs",
        headers=auth_headers(staff.email)
    )
    assert staff_audit_resp.status_code == 200
    assert len(staff_audit_resp.json()) >= 1
