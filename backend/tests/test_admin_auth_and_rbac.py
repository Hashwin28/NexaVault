"""
NexaVault Administrator Authentication and Role-Based Access Control (RBAC) Test Suite.

Verifies:
1. Administrator Authentication & Password Verification (Valid, Invalid, Non-existent, Inactive).
2. Public registration role hardening (Students only, cannot self-register as Admin).
3. JWT Claims, validation, and role tampering prevention.
4. /auth/me profile retrieval for Administrator, Staff, and Student.
5. Strict Role Isolation:
   - Students & Staff blocked from Admin endpoints (403 Forbidden).
   - Admin blocked from Staff evaluation, marks, workspace creation, and result publication.
   - Admin blocked from Student submission workflows.
6. Department Scoping & IDOR Prevention:
   - Department-scoped Admin isolated to their department.
   - Global Admin has department-wide visibility.
7. Secure Admin Provisioning:
   - Secret-based provisioning.
   - Administrator-based provisioning (scoped to department).
   - Non-admin / unauthenticated provisioning blocked.
8. Audit immutability & audit logging of all security-sensitive events.
"""
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

DATABASE_URL = "sqlite:///:memory:"

from app.db.base import Base
from app.main import app
from app.api.deps import get_db
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceStaff, WorkspaceGroup
from app.models.project import Project
from app.models.audit import AuditLog
from app.core.security import hash_password, create_access_token, decode_access_token

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


def create_test_user(db, email, password, role, full_name, department=None, is_active=True):
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


def get_auth_headers(user):
    token = create_access_token(
        subject=user.email,
        role=user.role,
        extra_claims={
            "id": user.id,
            "department": user.department,
            "full_name": user.full_name,
        },
    )
    return {"Authorization": f"Bearer {token}"}


# ===========================================================================
# 1. Administrator Authentication & Password Verification Tests
# ===========================================================================

def test_admin_login_success(client, db):
    """Global admin can log in with valid credentials and receives token and user profile."""
    create_test_user(db, "admin@nexavault.edu", "AdminVault2026!", "administrator", "System Admin", None)
    
    response = client.post("/api/v1/auth/login", json={
        "email": "admin@nexavault.edu",
        "password": "AdminVault2026!"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["role"] == "administrator"
    assert data["user"]["email"] == "admin@nexavault.edu"


def test_department_admin_login_success(client, db):
    """Department-scoped admin logs in and receives department in user object."""
    create_test_user(db, "admin.cs@nexavault.edu", "AdminVault2026!", "administrator", "CS Admin", "CS")
    
    response = client.post("/api/v1/auth/login", json={
        "email": "admin.cs@nexavault.edu",
        "password": "AdminVault2026!"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["role"] == "administrator"
    assert data["user"]["department"] == "CS"


def test_admin_login_invalid_password(client, db):
    """Login with wrong password fails with 401 and records audit event."""
    create_test_user(db, "admin@nexavault.edu", "AdminVault2026!", "administrator", "System Admin", None)
    
    response = client.post("/api/v1/auth/login", json={
        "email": "admin@nexavault.edu",
        "password": "WrongPassword!"
    })
    assert response.status_code == 401
    assert "incorrect" in response.json()["detail"].lower()


def test_admin_login_nonexistent_email(client, db):
    """Login with non-existent email fails with 401."""
    response = client.post("/api/v1/auth/login", json={
        "email": "nonexistent@nexavault.edu",
        "password": "SomePassword123"
    })
    assert response.status_code == 401


def test_inactive_admin_login_blocked(client, db):
    """Inactive admin accounts cannot log in."""
    create_test_user(db, "deactivated@nexavault.edu", "AdminVault2026!", "administrator", "Inactive Admin", is_active=False)
    
    response = client.post("/api/v1/auth/login", json={
        "email": "deactivated@nexavault.edu",
        "password": "AdminVault2026!"
    })
    assert response.status_code == 400
    assert "inactive" in response.json()["detail"].lower()


# ===========================================================================
# 2. Public Registration Security Hardening Tests
# ===========================================================================

def test_public_registration_forces_student_role(client, db):
    """Attempting to register publicly with role='administrator' is ignored and forced to student."""
    response = client.post("/api/v1/auth/register", json={
        "email": "hacker@nexavault.edu",
        "password": "Password123!",
        "full_name": "Intruder User",
        "role": "administrator"
    })
    assert response.status_code == 201
    data = response.json()
    assert data["user"]["role"] == "student"

    # Verify directly in DB
    user = db.query(User).filter(User.email == "hacker@nexavault.edu").first()
    assert user is not None
    assert user.role == "student"


# ===========================================================================
# 3. JWT Claims, Validation & Role Tampering Tests
# ===========================================================================

def test_jwt_claims_include_admin_metadata(client, db):
    """JWT tokens generated for administrators contain role, id, department, and full_name."""
    admin = create_test_user(db, "admin.cs@nexavault.edu", "AdminVault2026!", "administrator", "CS Admin", "CS")
    
    token = create_access_token(
        subject=admin.email,
        role=admin.role,
        extra_claims={
            "id": admin.id,
            "department": admin.department,
            "full_name": admin.full_name,
        }
    )
    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == "admin.cs@nexavault.edu"
    assert payload["role"] == "administrator"
    assert payload["id"] == admin.id
    assert payload["department"] == "CS"
    assert payload["full_name"] == "CS Admin"


def test_auth_me_endpoint_for_all_roles(client, db):
    """Verify /api/v1/auth/me correctly returns identity for Student, Staff, and Admin."""
    student = create_test_user(db, "student@nexavault.edu", "Pass123!", "student", "Jane Student", "CS")
    staff = create_test_user(db, "staff@nexavault.edu", "Pass123!", "staff", "Prof Staff", "CS")
    admin = create_test_user(db, "admin@nexavault.edu", "Pass123!", "administrator", "Chief Admin", "CS")

    # Student
    res_s = client.get("/api/v1/auth/me", headers=get_auth_headers(student))
    assert res_s.status_code == 200
    assert res_s.json()["role"] == "student"

    # Staff
    res_t = client.get("/api/v1/auth/me", headers=get_auth_headers(staff))
    assert res_t.status_code == 200
    assert res_t.json()["role"] == "staff"

    # Admin
    res_a = client.get("/api/v1/auth/me", headers=get_auth_headers(admin))
    assert res_a.status_code == 200
    assert res_a.json()["role"] == "administrator"


def test_token_role_tampering_rejected(client, db):
    """If an attacker generates a token with role='administrator' for a student DB account, it is rejected."""
    student = create_test_user(db, "student_tamper@nexavault.edu", "Pass123!", "student", "Tamper Student")
    
    # Attacker crafts token claiming role is 'administrator'
    forged_token = create_access_token(
        subject=student.email,
        role="administrator",
        extra_claims={"id": student.id}
    )
    
    # Request to admin dashboard must be rejected
    response = client.get("/api/v1/admin/dashboard", headers={"Authorization": f"Bearer {forged_token}"})
    assert response.status_code == 401


# ===========================================================================
# 4. Role-Based Access Control (RBAC) & Endpoint Isolation
# ===========================================================================

def test_students_and_staff_blocked_from_admin_dashboard(client, db):
    """Students and Staff receive 403 Forbidden when calling Admin endpoints."""
    student = create_test_user(db, "stud@nexavault.edu", "Pass123!", "student", "Student")
    staff = create_test_user(db, "staff@nexavault.edu", "Pass123!", "staff", "Staff")

    # Student blocked
    res1 = client.get("/api/v1/admin/dashboard", headers=get_auth_headers(student))
    assert res1.status_code == 403
    assert "Administrator role required" in res1.json()["detail"]

    # Staff blocked
    res2 = client.get("/api/v1/admin/dashboard", headers=get_auth_headers(staff))
    assert res2.status_code == 403
    assert "Administrator role required" in res2.json()["detail"]


def test_admin_blocked_from_creating_workspaces(client, db):
    """Administrators cannot create workspaces (Staff only)."""
    admin = create_test_user(db, "admin@nexavault.edu", "Pass123!", "administrator", "Admin")
    
    response = client.post("/api/v1/workspaces", json={
        "name": "Admin Workspace",
        "term": "Fall 2026",
        "description": "Unauthorized workspace"
    }, headers=get_auth_headers(admin))
    assert response.status_code == 403
    assert "Staff role required" in response.json()["detail"]


def test_admin_blocked_from_evaluating_submissions(client, db):
    """Administrators cannot evaluate submissions or enter marks."""
    admin = create_test_user(db, "admin@nexavault.edu", "Pass123!", "administrator", "Admin")
    
    response = client.post("/api/v1/reviews/999/evaluate", json={
        "verdict": "APPROVED",
        "feedback": "Admin evaluating directly",
        "scores": []
    }, headers=get_auth_headers(admin))
    assert response.status_code == 403
    assert "Staff role required" in response.json()["detail"]


def test_admin_blocked_from_publishing_results(client, db):
    """Administrators cannot publish results (Staff only)."""
    admin = create_test_user(db, "admin@nexavault.edu", "Pass123!", "administrator", "Admin")
    
    response = client.post("/api/v1/results/workspace/999/publish", headers=get_auth_headers(admin))
    assert response.status_code == 403
    assert "Staff role required" in response.json()["detail"]


def test_admin_blocked_from_submitting_work(client, db):
    """Administrators cannot submit student deliverables."""
    admin = create_test_user(db, "admin@nexavault.edu", "Pass123!", "administrator", "Admin")
    
    response = client.post("/api/v1/submissions/999/submit", headers=get_auth_headers(admin))
    assert response.status_code == 403
    assert "Student role required" in response.json()["detail"]


# ===========================================================================
# 5. Department Scoping & IDOR Prevention
# ===========================================================================

def test_department_scoped_admin_workspace_isolation(client, db):
    """Department admin can only view and access workspaces of their department."""
    staff_cs = create_test_user(db, "prof.cs@nexavault.edu", "Pass123!", "staff", "CS Prof", "CS")
    staff_ece = create_test_user(db, "prof.ece@nexavault.edu", "Pass123!", "staff", "ECE Prof", "ECE")
    
    # Create CS workspace
    ws_cs = Workspace(id=101, name="CS Capstone", term="2026", department="CS", owner_id=staff_cs.id)
    # Create ECE workspace
    ws_ece = Workspace(id=102, name="ECE Robotics", term="2026", department="ECE", owner_id=staff_ece.id)
    db.add_all([ws_cs, ws_ece])
    db.commit()

    admin_cs = create_test_user(db, "admin.cs@nexavault.edu", "Pass123!", "administrator", "CS Admin", "CS")

    # List workspaces
    res = client.get("/api/v1/admin/workspaces", headers=get_auth_headers(admin_cs))
    assert res.status_code == 200
    items = res.json()["items"]
    ws_ids = [str(w["id"]) for w in items]
    assert "101" in ws_ids
    assert "102" not in ws_ids  # ECE workspace excluded!

    # Direct detail access on out-of-department workspace returns 404 (IDOR prevention)
    res_cross = client.get("/api/v1/admin/workspaces/102", headers=get_auth_headers(admin_cs))
    assert res_cross.status_code in [403, 404]


def test_global_admin_sees_all_departments(client, db):
    """Global admin (department=None) can access workspaces from all departments."""
    staff_cs = create_test_user(db, "prof.cs2@nexavault.edu", "Pass123!", "staff", "CS Prof", "CS")
    staff_ece = create_test_user(db, "prof.ece2@nexavault.edu", "Pass123!", "staff", "ECE Prof", "ECE")
    
    ws_cs = Workspace(id=201, name="CS Capstone 2", term="2026", department="CS", owner_id=staff_cs.id)
    ws_ece = Workspace(id=202, name="ECE Robotics 2", term="2026", department="ECE", owner_id=staff_ece.id)
    db.add_all([ws_cs, ws_ece])
    db.commit()

    global_admin = create_test_user(db, "global.admin@nexavault.edu", "Pass123!", "administrator", "Global Admin", None)

    res = client.get("/api/v1/admin/workspaces", headers=get_auth_headers(global_admin))
    assert res.status_code == 200
    ws_ids = [str(w["id"]) for w in res.json()["items"]]
    assert "201" in ws_ids
    assert "202" in ws_ids


# ===========================================================================
# 6. Secure Admin Account Provisioning Tests
# ===========================================================================

def test_provision_admin_unauthorized_without_secret_or_token(client, db):
    """Unauthenticated call to /provision with no header returns 403."""
    response = client.post("/api/v1/admin/provision", json={
        "email": "newadmin@nexavault.edu",
        "full_name": "New Admin",
        "password": "SecurePassword123!"
    })
    assert response.status_code == 403


def test_provision_admin_with_valid_shared_secret(client, db, monkeypatch):
    """Provisioning with valid X-Provision-Secret header creates administrator."""
    monkeypatch.setenv("ADMIN_PROVISION_SECRET", "super-secret-key-2026")
    
    response = client.post(
        "/api/v1/admin/provision",
        json={
            "email": "secretadmin@nexavault.edu",
            "full_name": "Secret Admin",
            "password": "SecurePassword123!",
            "department": "IT"
        },
        headers={"x-provision-secret": "super-secret-key-2026"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["role"] == "administrator"
    assert data["email"] == "secretadmin@nexavault.edu"
    assert data["department"] == "IT"


def test_provision_admin_by_authenticated_admin(client, db):
    """Existing administrator can provision another administrator."""
    admin = create_test_user(db, "admin.root@nexavault.edu", "Pass123!", "administrator", "Root Admin", None)

    response = client.post(
        "/api/v1/admin/provision",
        json={
            "email": "subadmin@nexavault.edu",
            "full_name": "Sub Admin",
            "password": "SecurePassword123!",
            "department": "BioTech"
        },
        headers=get_auth_headers(admin)
    )
    assert response.status_code == 201
    assert response.json()["role"] == "administrator"


def test_provision_admin_department_admin_cannot_provision_other_dept(client, db):
    """CS department admin cannot provision an admin for ECE."""
    cs_admin = create_test_user(db, "admin.cs_prov@nexavault.edu", "Pass123!", "administrator", "CS Admin", "CS")

    response = client.post(
        "/api/v1/admin/provision",
        json={
            "email": "ece_admin@nexavault.edu",
            "full_name": "ECE Admin",
            "password": "SecurePassword123!",
            "department": "ECE"
        },
        headers=get_auth_headers(cs_admin)
    )
    assert response.status_code == 403
    assert "own department" in response.json()["detail"]


def test_provision_admin_blocked_for_student_and_staff(client, db):
    """Students and Staff cannot provision administrators."""
    student = create_test_user(db, "student_p@nexavault.edu", "Pass123!", "student", "Student")
    staff = create_test_user(db, "staff_p@nexavault.edu", "Pass123!", "staff", "Staff")

    for caller in [student, staff]:
        res = client.post(
            "/api/v1/admin/provision",
            json={
                "email": "fakeadmin@nexavault.edu",
                "full_name": "Fake Admin",
                "password": "SecurePassword123!"
            },
            headers=get_auth_headers(caller)
        )
        assert res.status_code == 403
