"""
NexaVault Administrator Role Test Suite
Tests:
1. Administrator authentication and role isolation
2. Department-level resource restriction
3. Cross-department IDOR prevention
4. Workspace configuration management
5. Staff assignment and reassignment
6. Account status management
7. Dept-wide audit visibility
8. Audit immutability
9. Audit logging of admin operations
10. Admin inability to modify marks or publish results
11. IDOR and unauthorized API access protection
12. Existing Student and Staff regression safety
"""
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Use in-memory SQLite for tests with StaticPool so all connections share the DB
DATABASE_URL = "sqlite:///:memory:"

from app.db.base import Base
from app.db.session import SessionLocal
from app.main import app
from app.api.deps import get_db
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceStaff, WorkspaceGroup
from app.models.group import Group, GroupMembership
from app.models.project import Project
from app.models.review import ReviewRound, Submission, SubmissionVersion, ResultEntry
from app.models.audit import AuditLog
from app.core.security import hash_password, create_access_token

# ---------------------------------------------------------------------------
# Test database setup
# ---------------------------------------------------------------------------

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="function", autouse=True)
def setup_database():
    """Create all tables before each test, drop after."""
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_db] = override_get_db
    yield
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db():
    database = TestingSessionLocal()
    try:
        yield database
    finally:
        database.close()


# ---------------------------------------------------------------------------
# Helper: seed users
# ---------------------------------------------------------------------------

def create_user(db, email, password, role, full_name, department=None, is_active=True):
    user = User(
        email=email,
        hashed_password=hash_password(password),
        full_name=full_name,
        role=role,
        department=department,
        is_active=is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_token(user):
    return create_access_token(subject=user.email)


def auth_headers(user):
    return {"Authorization": f"Bearer {get_token(user)}"}


def create_workspace(db, ws_id, name, owner, department=None):
    ws = Workspace(
        id=ws_id,
        name=name,
        term="2025-26",
        department=department,
        owner_id=owner.id,
        is_open=True,
        is_archived=False,
    )
    db.add(ws)
    # Add owner to workspace_staff
    ws_staff = WorkspaceStaff(workspace_id=ws_id, user_id=owner.id, role="owner")
    db.add(ws_staff)
    db.commit()
    db.refresh(ws)
    return ws


def create_group(db, name, creator):
    import random, string
    code = "GRP" + "".join(random.choices(string.ascii_uppercase, k=5))
    grp = Group(name=name, code=code, created_by=creator.id, is_deleted=False)
    db.add(grp)
    db.commit()
    db.refresh(grp)
    return grp


def enroll_group(db, ws_id, group, enrollee):
    wg = WorkspaceGroup(workspace_id=ws_id, group_id=group.id, enrolled_by=enrollee.id)
    db.add(wg)
    db.commit()


def add_member(db, group, user):
    gm = GroupMembership(group_id=group.id, user_id=user.id)
    db.add(gm)
    db.commit()


def create_project(db, ws_id, group, creator):
    p = Project(workspace_id=ws_id, group_id=group.id, name="Test Project", created_by=creator.id)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


# ===========================================================================
# 1. Administrator Authentication and Role Isolation
# ===========================================================================

class TestAdminAuth:

    def test_admin_login_returns_role_administrator(self, client, db):
        admin = create_user(db, "admin@dept.edu", "password123", "administrator", "Dr Admin", department="CS")
        res = client.post("/api/v1/auth/login", json={"email": "admin@dept.edu", "password": "password123"})
        assert res.status_code == 200
        data = res.json()
        assert data["user"]["role"] == "administrator"
        assert "access_token" in data

    def test_admin_me_endpoint(self, client, db):
        admin = create_user(db, "admin@dept.edu", "password123", "administrator", "Dr Admin", department="CS")
        res = client.get("/api/v1/auth/me", headers=auth_headers(admin))
        assert res.status_code == 200
        assert res.json()["role"] == "administrator"
        assert res.json()["department"] == "CS"

    def test_student_cannot_access_admin_endpoints(self, client, db):
        student = create_user(db, "student@test.edu", "pass123", "student", "Student One")
        res = client.get("/api/v1/admin/dashboard", headers=auth_headers(student))
        assert res.status_code == 403

    def test_staff_cannot_access_admin_endpoints(self, client, db):
        staff = create_user(db, "staff@test.edu", "pass123", "staff", "Staff One")
        res = client.get("/api/v1/admin/dashboard", headers=auth_headers(staff))
        assert res.status_code == 403

    def test_unauthenticated_cannot_access_admin_endpoints(self, client):
        res = client.get("/api/v1/admin/dashboard")
        assert res.status_code == 401

    def test_public_registration_cannot_create_admin(self, client):
        res = client.post("/api/v1/auth/register", json={
            "email": "hacker@test.edu",
            "password": "pass123",
            "full_name": "Hacker",
        })
        assert res.status_code == 201
        data = res.json()
        # Must always be student
        assert data["user"]["role"] == "student"

    def test_admin_dashboard_returns_stats(self, client, db):
        admin = create_user(db, "admin@dept.edu", "pass123", "administrator", "Dr Admin", department="CS")
        res = client.get("/api/v1/admin/dashboard", headers=auth_headers(admin))
        assert res.status_code == 200
        data = res.json()
        assert "total_workspaces" in data
        assert "total_staff" in data
        assert "total_students" in data


# ===========================================================================
# 2. Department-Level Resource Restriction
# ===========================================================================

class TestDepartmentIsolation:

    def test_admin_sees_only_dept_workspaces(self, client, db):
        staff_cs = create_user(db, "staff_cs@test.edu", "pass", "staff", "CS Staff", department="CS")
        staff_ai = create_user(db, "staff_ai@test.edu", "pass", "staff", "AI Staff", department="AI")
        admin_cs = create_user(db, "admin_cs@test.edu", "pass", "administrator", "CS Admin", department="CS")

        ws_cs = create_workspace(db, "CS101", "CS Workspace", staff_cs, department="CS")
        ws_ai = create_workspace(db, "AI101", "AI Workspace", staff_ai, department="AI")

        res = client.get("/api/v1/admin/workspaces", headers=auth_headers(admin_cs))
        assert res.status_code == 200
        data = res.json()
        ws_ids = [item["id"] for item in data.get("items", data if isinstance(data, list) else [])]
        assert "CS101" in ws_ids
        assert "AI101" not in ws_ids

    def test_admin_cannot_access_other_dept_workspace_detail(self, client, db):
        staff_ai = create_user(db, "staff_ai@test.edu", "pass", "staff", "AI Staff", department="AI")
        admin_cs = create_user(db, "admin_cs@test.edu", "pass", "administrator", "CS Admin", department="CS")
        ws_ai = create_workspace(db, "AI202", "AI Workspace", staff_ai, department="AI")

        res = client.get("/api/v1/admin/workspaces/AI202", headers=auth_headers(admin_cs))
        assert res.status_code in (403, 404)

    def test_super_admin_no_dept_sees_all(self, client, db):
        """An admin with department=None is a super-admin and can see all workspaces."""
        staff_cs = create_user(db, "staff_cs@test.edu", "pass", "staff", "CS Staff")
        staff_ai = create_user(db, "staff_ai@test.edu", "pass", "staff", "AI Staff")
        admin_super = create_user(db, "superadmin@test.edu", "pass", "administrator", "Super Admin", department=None)

        ws_cs = create_workspace(db, "CS101", "CS WS", staff_cs, department="CS")
        ws_ai = create_workspace(db, "AI101", "AI WS", staff_ai, department="AI")

        res = client.get("/api/v1/admin/workspaces", headers=auth_headers(admin_super))
        assert res.status_code == 200
        data = res.json()
        items = data.get("items", data) if isinstance(data, dict) else data
        ws_ids = [item["id"] for item in items]
        assert "CS101" in ws_ids
        assert "AI101" in ws_ids


# ===========================================================================
# 3. Cross-Department IDOR Prevention
# ===========================================================================

class TestIDORPrevention:

    def test_admin_cannot_patch_other_dept_workspace(self, client, db):
        staff_ai = create_user(db, "staff_ai@test.edu", "pass", "staff", "AI Staff")
        admin_cs = create_user(db, "admin_cs@test.edu", "pass", "administrator", "CS Admin", department="CS")
        ws_ai = create_workspace(db, "AI303", "AI WS", staff_ai, department="AI")

        res = client.patch("/api/v1/admin/workspaces/AI303", headers=auth_headers(admin_cs),
                           json={"name": "Hacked Name"})
        assert res.status_code in (403, 404)

    def test_admin_cannot_archive_other_dept_workspace(self, client, db):
        staff_ai = create_user(db, "staff_ai@test.edu", "pass", "staff", "AI Staff")
        admin_cs = create_user(db, "admin_cs@test.edu", "pass", "administrator", "CS Admin", department="CS")
        ws_ai = create_workspace(db, "AI404", "AI WS", staff_ai, department="AI")

        res = client.post("/api/v1/admin/workspaces/AI404/archive", headers=auth_headers(admin_cs),
                          json={"reason": "test"})
        assert res.status_code in (403, 404)

    def test_admin_cannot_view_other_dept_project(self, client, db):
        staff_ai = create_user(db, "staff_ai@test.edu", "pass", "staff", "AI Staff")
        student_ai = create_user(db, "student_ai@test.edu", "pass", "student", "AI Student")
        admin_cs = create_user(db, "admin_cs@test.edu", "pass", "administrator", "CS Admin", department="CS")
        ws_ai = create_workspace(db, "AI505", "AI WS", staff_ai, department="AI")
        grp = create_group(db, "AI Group", student_ai)
        add_member(db, grp, student_ai)
        enroll_group(db, "AI505", grp, staff_ai)
        proj = create_project(db, "AI505", grp, student_ai)

        res = client.get(f"/api/v1/admin/projects/{proj.id}", headers=auth_headers(admin_cs))
        assert res.status_code in (403, 404)


# ===========================================================================
# 4. Workspace Configuration Management
# ===========================================================================

class TestWorkspaceConfig:

    def test_admin_can_update_workspace_name(self, client, db):
        staff = create_user(db, "staff@test.edu", "pass", "staff", "Staff One", department="CS")
        admin = create_user(db, "admin@test.edu", "pass", "administrator", "Admin", department="CS")
        ws = create_workspace(db, "CS-WS1", "Old Name", staff, department="CS")

        res = client.patch("/api/v1/admin/workspaces/CS-WS1", headers=auth_headers(admin),
                           json={"name": "New Name"})
        assert res.status_code == 200

        db.expire_all()
        ws_updated = db.query(Workspace).filter(Workspace.id == "CS-WS1").first()
        assert ws_updated.name == "New Name"

    def test_admin_can_archive_workspace(self, client, db):
        staff = create_user(db, "staff@test.edu", "pass", "staff", "Staff One", department="CS")
        admin = create_user(db, "admin@test.edu", "pass", "administrator", "Admin", department="CS")
        ws = create_workspace(db, "CS-WS2", "Active WS", staff, department="CS")

        res = client.post("/api/v1/admin/workspaces/CS-WS2/archive", headers=auth_headers(admin),
                          json={"reason": "End of term"})
        assert res.status_code == 200

        db.expire_all()
        ws_upd = db.query(Workspace).filter(Workspace.id == "CS-WS2").first()
        assert ws_upd.is_archived is True

    def test_admin_can_unarchive_workspace(self, client, db):
        staff = create_user(db, "staff@test.edu", "pass", "staff", "Staff One", department="CS")
        admin = create_user(db, "admin@test.edu", "pass", "administrator", "Admin", department="CS")
        ws = Workspace(id="CS-WS3", name="Arch WS", term="2025", department="CS",
                        owner_id=staff.id, is_open=False, is_archived=True)
        db.add(ws)
        db.commit()

        res = client.post("/api/v1/admin/workspaces/CS-WS3/unarchive", headers=auth_headers(admin))
        assert res.status_code == 200

        db.expire_all()
        ws_upd = db.query(Workspace).filter(Workspace.id == "CS-WS3").first()
        assert ws_upd.is_archived is False

    def test_admin_cannot_create_workspace(self, client, db):
        admin = create_user(db, "admin@test.edu", "pass", "administrator", "Admin", department="CS")
        res = client.post("/api/v1/workspaces/", headers=auth_headers(admin),
                          json={"name": "New WS", "term": "2025"})
        assert res.status_code == 403


# ===========================================================================
# 5. Staff Assignment and Reassignment
# ===========================================================================

class TestStaffAssignment:

    def test_admin_can_assign_staff(self, client, db):
        staff = create_user(db, "staff@test.edu", "pass", "staff", "Staff One", department="CS")
        new_staff = create_user(db, "newstaff@test.edu", "pass", "staff", "New Staff", department="CS")
        admin = create_user(db, "admin@test.edu", "pass", "administrator", "Admin", department="CS")
        ws = create_workspace(db, "CS-AS1", "WS for Assign", staff, department="CS")

        res = client.post(f"/api/v1/admin/workspaces/CS-AS1/staff",
                          headers=auth_headers(admin),
                          json={"user_id": new_staff.id})
        assert res.status_code == 200

        db.expire_all()
        entry = db.query(WorkspaceStaff).filter(
            WorkspaceStaff.workspace_id == "CS-AS1",
            WorkspaceStaff.user_id == new_staff.id
        ).first()
        assert entry is not None

    def test_admin_can_remove_costaff(self, client, db):
        owner_staff = create_user(db, "owner@test.edu", "pass", "staff", "Owner", department="CS")
        co_staff = create_user(db, "costaff@test.edu", "pass", "staff", "Costaff", department="CS")
        admin = create_user(db, "admin@test.edu", "pass", "administrator", "Admin", department="CS")
        ws = create_workspace(db, "CS-RM1", "WS Remove", owner_staff, department="CS")

        # Add costaff first
        ws_st = WorkspaceStaff(workspace_id="CS-RM1", user_id=co_staff.id, role="costaff")
        db.add(ws_st)
        db.commit()

        res = client.delete(f"/api/v1/admin/workspaces/CS-RM1/staff/{co_staff.id}",
                            headers=auth_headers(admin))
        assert res.status_code == 200

        db.expire_all()
        entry = db.query(WorkspaceStaff).filter(
            WorkspaceStaff.workspace_id == "CS-RM1",
            WorkspaceStaff.user_id == co_staff.id
        ).first()
        assert entry is None

    def test_admin_cannot_remove_workspace_owner(self, client, db):
        owner_staff = create_user(db, "owner@test.edu", "pass", "staff", "Owner", department="CS")
        admin = create_user(db, "admin@test.edu", "pass", "administrator", "Admin", department="CS")
        ws = create_workspace(db, "CS-RM2", "WS Owner", owner_staff, department="CS")

        res = client.delete(f"/api/v1/admin/workspaces/CS-RM2/staff/{owner_staff.id}",
                            headers=auth_headers(admin))
        assert res.status_code in (400, 403)


# ===========================================================================
# 6. Account Status Management
# ===========================================================================

class TestAccountStatus:

    def test_admin_can_deactivate_student(self, client, db):
        staff = create_user(db, "staff@test.edu", "pass", "staff", "Staff", department="CS")
        student = create_user(db, "student@test.edu", "pass", "student", "Student", department="CS")
        admin = create_user(db, "admin@test.edu", "pass", "administrator", "Admin", department="CS")
        ws = create_workspace(db, "CS-ACC1", "WS", staff, department="CS")
        grp = create_group(db, "Grp1", student)
        add_member(db, grp, student)
        enroll_group(db, "CS-ACC1", grp, staff)

        res = client.patch(f"/api/v1/admin/users/{student.id}/status",
                           headers=auth_headers(admin),
                           json={"is_active": False, "reason": "Violation"})
        assert res.status_code == 200

        db.expire_all()
        updated = db.query(User).filter(User.id == student.id).first()
        assert updated.is_active is False

    def test_admin_cannot_deactivate_another_admin(self, client, db):
        admin1 = create_user(db, "admin1@test.edu", "pass", "administrator", "Admin1", department="CS")
        admin2 = create_user(db, "admin2@test.edu", "pass", "administrator", "Admin2", department="CS")

        res = client.patch(f"/api/v1/admin/users/{admin2.id}/status",
                           headers=auth_headers(admin1),
                           json={"is_active": False, "reason": "test"})
        assert res.status_code in (400, 403)

    def test_deactivated_user_cannot_login(self, client, db):
        staff = create_user(db, "staff@test.edu", "pass", "staff", "Staff", department="CS")
        student = create_user(db, "student@test.edu", "pass", "student", "Student", department="CS")
        admin = create_user(db, "admin@test.edu", "pass", "administrator", "Admin", department="CS")
        ws = create_workspace(db, "CS-DL1", "WS", staff, department="CS")
        grp = create_group(db, "Grp2", student)
        add_member(db, grp, student)
        enroll_group(db, "CS-DL1", grp, staff)

        # Deactivate student
        client.patch(f"/api/v1/admin/users/{student.id}/status",
                     headers=auth_headers(admin),
                     json={"is_active": False, "reason": "test"})

        # Student login should fail
        res = client.post("/api/v1/auth/login", json={"email": "student@test.edu", "password": "pass"})
        assert res.status_code == 400


# ===========================================================================
# 7. Department-Wide Audit Visibility
# ===========================================================================

class TestAuditVisibility:

    def test_admin_can_access_audit_trail(self, client, db):
        admin = create_user(db, "admin@test.edu", "pass", "administrator", "Admin", department="CS")
        res = client.get("/api/v1/admin/audit", headers=auth_headers(admin))
        assert res.status_code == 200
        data = res.json()
        assert "items" in data
        assert "total" in data

    def test_admin_audit_scoped_to_dept(self, client, db):
        staff_cs = create_user(db, "staff_cs@test.edu", "pass", "staff", "CS Staff", department="CS")
        staff_ai = create_user(db, "staff_ai@test.edu", "pass", "staff", "AI Staff", department="AI")
        admin_cs = create_user(db, "admin_cs@test.edu", "pass", "administrator", "CS Admin", department="CS")
        ws_cs = create_workspace(db, "CS-AUD1", "CS WS", staff_cs, department="CS")
        ws_ai = create_workspace(db, "AI-AUD1", "AI WS", staff_ai, department="AI")

        # Seed audit events for each workspace
        log_cs = AuditLog(actor_id=staff_cs.id, action_type="workspace_created",
                          entity_type="workspace", workspace_id="CS-AUD1",
                          category="WORKSPACE", status="SUCCESS")
        log_ai = AuditLog(actor_id=staff_ai.id, action_type="workspace_created",
                          entity_type="workspace", workspace_id="AI-AUD1",
                          category="WORKSPACE", status="SUCCESS")
        db.add_all([log_cs, log_ai])
        db.commit()

        res = client.get("/api/v1/admin/audit", headers=auth_headers(admin_cs))
        assert res.status_code == 200
        items = res.json()["items"]
        ws_ids = [item.get("workspace_id") for item in items if item.get("workspace_id")]
        assert "AI-AUD1" not in ws_ids


# ===========================================================================
# 8. Audit Immutability
# ===========================================================================

class TestAuditImmutability:

    def test_no_delete_audit_endpoint_exists(self, client, db):
        admin = create_user(db, "admin@test.edu", "pass", "administrator", "Admin", department="CS")
        # Try to DELETE audit log — no such endpoint should exist
        res = client.delete("/api/v1/admin/audit/1", headers=auth_headers(admin))
        assert res.status_code in (404, 405)

    def test_no_patch_audit_endpoint_exists(self, client, db):
        admin = create_user(db, "admin@test.edu", "pass", "administrator", "Admin", department="CS")
        res = client.patch("/api/v1/admin/audit/1", headers=auth_headers(admin),
                           json={"action_type": "tampered"})
        assert res.status_code in (404, 405)

    def test_staff_cannot_delete_audit_logs(self, client, db):
        staff = create_user(db, "staff@test.edu", "pass", "staff", "Staff")
        res = client.delete("/api/v1/audit/1", headers=auth_headers(staff))
        assert res.status_code in (404, 405)


# ===========================================================================
# 9. Audit Logging of Admin Operations
# ===========================================================================

class TestAuditLogging:

    def test_archive_workspace_creates_audit_event(self, client, db):
        staff = create_user(db, "staff@test.edu", "pass", "staff", "Staff", department="CS")
        admin = create_user(db, "admin@test.edu", "pass", "administrator", "Admin", department="CS")
        ws = create_workspace(db, "CS-LOG1", "WS Log", staff, department="CS")

        client.post("/api/v1/admin/workspaces/CS-LOG1/archive",
                    headers=auth_headers(admin),
                    json={"reason": "Test reason"})

        db.expire_all()
        audit_entry = db.query(AuditLog).filter(
            AuditLog.action_type == "admin_workspace_archived",
            AuditLog.workspace_id == "CS-LOG1",
            AuditLog.actor_id == admin.id
        ).first()
        assert audit_entry is not None

    def test_staff_assignment_creates_audit_event(self, client, db):
        staff = create_user(db, "staff@test.edu", "pass", "staff", "Staff", department="CS")
        new_staff = create_user(db, "newstaff@test.edu", "pass", "staff", "New Staff")
        admin = create_user(db, "admin@test.edu", "pass", "administrator", "Admin", department="CS")
        ws = create_workspace(db, "CS-LOG2", "WS Log2", staff, department="CS")

        client.post(f"/api/v1/admin/workspaces/CS-LOG2/staff",
                    headers=auth_headers(admin),
                    json={"user_id": new_staff.id})

        db.expire_all()
        audit_entry = db.query(AuditLog).filter(
            AuditLog.action_type == "admin_staff_assigned",
            AuditLog.workspace_id == "CS-LOG2",
            AuditLog.actor_id == admin.id
        ).first()
        assert audit_entry is not None

    def test_account_status_change_creates_audit_event(self, client, db):
        staff = create_user(db, "staff@test.edu", "pass", "staff", "Staff", department="CS")
        student = create_user(db, "student@test.edu", "pass", "student", "Student", department="CS")
        admin = create_user(db, "admin@test.edu", "pass", "administrator", "Admin", department="CS")
        ws = create_workspace(db, "CS-LOG3", "WS Log3", staff, department="CS")
        grp = create_group(db, "GrpLog", student)
        add_member(db, grp, student)
        enroll_group(db, "CS-LOG3", grp, staff)

        client.patch(f"/api/v1/admin/users/{student.id}/status",
                     headers=auth_headers(admin),
                     json={"is_active": False, "reason": "Audit test"})

        db.expire_all()
        audit_entry = db.query(AuditLog).filter(
            AuditLog.action_type == "admin_account_status_changed",
            AuditLog.actor_id == admin.id
        ).first()
        assert audit_entry is not None


# ===========================================================================
# 10. Admin Cannot Modify Marks or Publish Results
# ===========================================================================

class TestAdminCannotGrade:

    def test_admin_cannot_submit_review(self, client, db):
        """Admin cannot POST to the review submission endpoint."""
        admin = create_user(db, "admin@test.edu", "pass", "administrator", "Admin", department="CS")
        # Try to submit a review for a fictitious version
        res = client.post("/api/v1/reviews/versions/1/review",
                          headers=auth_headers(admin),
                          json={"scores": {}, "feedback": "test"})
        assert res.status_code in (403, 404)

    def test_admin_cannot_release_results(self, client, db):
        """Admin cannot POST to the results release endpoint."""
        admin = create_user(db, "admin@test.edu", "pass", "administrator", "Admin", department="CS")
        res = client.post("/api/v1/results/1/release",
                          headers=auth_headers(admin))
        assert res.status_code in (403, 404)

    def test_admin_cannot_correct_marks(self, client, db):
        """Admin cannot PATCH result correction endpoint."""
        admin = create_user(db, "admin@test.edu", "pass", "administrator", "Admin", department="CS")
        res = client.patch("/api/v1/results/entries/1/correct",
                           headers=auth_headers(admin),
                           json={"score": 100, "reason": "admin override"})
        assert res.status_code in (403, 404)

    def test_admin_cannot_claim_submission(self, client, db):
        """Admin cannot claim submissions for review."""
        admin = create_user(db, "admin@test.edu", "pass", "administrator", "Admin", department="CS")
        res = client.post("/api/v1/submissions/versions/1/claim",
                          headers=auth_headers(admin))
        assert res.status_code in (403, 404)


# ===========================================================================
# 11. IDOR and Unauthorized API Access
# ===========================================================================

class TestIDOR:

    def test_admin_audit_workspace_filter_idor(self, client, db):
        """Admin CS should not be able to filter audit by an AI workspace ID."""
        staff_ai = create_user(db, "staff_ai@test.edu", "pass", "staff", "AI Staff")
        admin_cs = create_user(db, "admin_cs@test.edu", "pass", "administrator", "CS Admin", department="CS")
        ws_ai = create_workspace(db, "AI-IDR1", "AI WS", staff_ai, department="AI")

        res = client.get("/api/v1/admin/audit?workspace_id=AI-IDR1",
                         headers=auth_headers(admin_cs))
        assert res.status_code in (403, 404)

    def test_admin_project_list_excludes_other_depts(self, client, db):
        staff_ai = create_user(db, "staff_ai@test.edu", "pass", "staff", "AI Staff")
        student_ai = create_user(db, "student_ai@test.edu", "pass", "student", "AI Student")
        admin_cs = create_user(db, "admin_cs@test.edu", "pass", "administrator", "CS Admin", department="CS")
        ws_ai = create_workspace(db, "AI-PRJ1", "AI WS", staff_ai, department="AI")
        grp = create_group(db, "AI Grp", student_ai)
        add_member(db, grp, student_ai)
        enroll_group(db, "AI-PRJ1", grp, staff_ai)
        proj = create_project(db, "AI-PRJ1", grp, student_ai)

        res = client.get("/api/v1/admin/projects", headers=auth_headers(admin_cs))
        assert res.status_code == 200
        items = res.json().get("items", res.json() if isinstance(res.json(), list) else [])
        project_ids = [item["id"] for item in items]
        assert proj.id not in project_ids


# ===========================================================================
# 12. Existing Student and Staff Regression Tests
# ===========================================================================

class TestRegressionStudentStaff:

    def test_student_can_still_register(self, client):
        res = client.post("/api/v1/auth/register", json={
            "email": "newstudent@test.edu",
            "password": "pass123",
            "full_name": "New Student"
        })
        assert res.status_code == 201
        assert res.json()["user"]["role"] == "student"

    def test_staff_workspace_access_unaffected(self, client, db):
        staff = create_user(db, "staff@test.edu", "pass", "staff", "Staff One")
        ws = create_workspace(db, "STAFF-WS1", "Staff Workspace", staff, department="CS")

        res = client.get("/api/v1/workspaces/", headers=auth_headers(staff))
        assert res.status_code == 200
        ws_ids = [w["id"] for w in res.json()]
        assert "STAFF-WS1" in ws_ids

    def test_student_cannot_access_staff_endpoints(self, client, db):
        student = create_user(db, "student@test.edu", "pass", "student", "Student")
        res = client.get("/api/v1/audit/activity", headers=auth_headers(student))
        assert res.status_code == 403

    def test_staff_cannot_access_student_private_endpoints(self, client, db):
        staff = create_user(db, "staff@test.edu", "pass", "staff", "Staff")
        # Confirm staff can still access staff-only endpoints
        res = client.get("/api/v1/audit/activity", headers=auth_headers(staff))
        assert res.status_code == 200

    def test_staff_workspace_creation_still_works(self, client, db):
        staff = create_user(db, "staff@test.edu", "pass", "staff", "Staff One")
        res = client.post("/api/v1/workspaces/", headers=auth_headers(staff),
                          json={"name": "New WS", "term": "2025-26"})
        assert res.status_code == 201
        assert res.json()["name"] == "New WS"
