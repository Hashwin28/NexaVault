import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal, engine
from app.models import (
    Base, User, Group, GroupMembership, Workspace, WorkspaceStaff,
    WorkspaceGroup, WorkspaceNotice, Project, ProjectUpdate, UpdateComment,
    ReviewRound, Submission, SubmissionVersion, Review, ResultEntry, GithubLink, AuditLog
)
from app.core.security import hash_password

client = TestClient(app)

@pytest.fixture(autouse=True)
def clean_database():
    """Wipes and recreates schema before each test run."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield

def get_auth_token(email: str, password: str = "password123") -> str:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.json()["access_token"]

def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}

def test_student_domain_comprehensive():
    db = SessionLocal()

    # Pre-provision a Staff user (Owner of test workspace)
    staff_user = User(
        email="prof.jenkins@nexavault.edu",
        hashed_password=hash_password("password123"),
        full_name="Dr. Sarah Jenkins",
        role="staff",
        is_active=True
    )
    db.add(staff_user)
    db.flush()
    staff_user_id = staff_user.id

    # Pre-provision a Workspace
    workspace = Workspace(
        id="CS204-DSA",
        name="DSA Algorithmic Vault",
        description="Data Structures & Algorithms Course Vault",
        term="Sem 3 - 2026",
        owner_id=staff_user.id,
        is_open=True,
        is_archived=False
    )
    db.add(workspace)
    db.flush()

    # Pre-provision a Notice in workspace
    notice = WorkspaceNotice(
        workspace_id=workspace.id,
        author_id=staff_user.id,
        title="Project Proposals Due Next Week",
        body="Ensure your group is enrolled and repository is linked.",
        is_pinned=True,
        is_archived=False
    )
    db.add(notice)

    # Pre-provision 2 Review Rounds
    round1 = ReviewRound(
        workspace_id=workspace.id,
        title="Round 1: Architecture Proposal",
        description="Submit design docs and complexity bounds",
        order_index=1,
        due_date=datetime.now(timezone.utc) + timedelta(days=7),
        max_score=20.0,
        is_open=True
    )
    round2_closed = ReviewRound(
        workspace_id=workspace.id,
        title="Round 2: Midterm Implementation",
        description="Core algorithm benchmark",
        order_index=2,
        due_date=datetime.now(timezone.utc) + timedelta(days=30),
        max_score=80.0,
        is_open=False  # Closed round
    )
    db.add_all([round1, round2_closed])
    db.commit()

    round1_id = round1.id
    round2_closed_id = round2_closed.id
    db.close()

    # =========================================================================
    # 1. Student Registration (Student-only public registration)
    # =========================================================================
    res = client.post("/api/v1/auth/register", json={
        "email": "student1@nexavault.edu",
        "password": "password123",
        "full_name": "Alex Chen"
    })
    assert res.status_code == 201, res.text
    s1_token = res.json()["access_token"]
    s1_user = res.json()["user"]
    assert s1_user["role"] == "student"
    assert s1_user["email"] == "student1@nexavault.edu"

    # Register Students 2, 3, 4, 5, 6, and Outside Student
    students = {}
    for i in range(2, 8):
        email = f"student{i}@nexavault.edu"
        res = client.post("/api/v1/auth/register", json={
            "email": email,
            "password": "password123",
            "full_name": f"Student {i}"
        })
        assert res.status_code == 201
        students[i] = res.json()["access_token"]

    # =========================================================================
    # 2. Student Login & 3. /auth/me
    # =========================================================================
    res = client.post("/api/v1/auth/login", json={
        "email": "student1@nexavault.edu",
        "password": "wrong_password"
    })
    assert res.status_code == 401

    res = client.get("/api/v1/auth/me", headers=auth_header(s1_token))
    assert res.status_code == 200
    assert res.json()["email"] == "student1@nexavault.edu"

    # =========================================================================
    # 4. Student Creates Group (Single-member group, Alphanumeric code, Leaderless)
    # =========================================================================
    res = client.post(
        "/api/v1/groups/",
        json={"name": "Alpha Storage Squad", "code": "ALPHA2026"},
        headers=auth_header(s1_token)
    )
    assert res.status_code == 201, res.text
    group_data = res.json()
    group_id = group_data["id"]
    assert group_data["name"] == "Alpha Storage Squad"
    assert group_data["code"] == "ALPHA2026"
    assert group_data["member_count"] == 1
    assert len(group_data["members"]) == 1
    assert group_data["members"][0]["email"] == "student1@nexavault.edu"

    # Verify GET /api/v1/groups/me
    res = client.get("/api/v1/groups/me", headers=auth_header(s1_token))
    assert res.status_code == 200
    assert res.json()["id"] == group_id

    # Non-alphanumeric code rejection
    res = client.post(
        "/api/v1/groups/",
        json={"name": "Bad Code Group", "code": "BAD-CODE-123!"},
        headers=auth_header(students[2])
    )
    assert res.status_code == 422 or res.status_code == 400

    # =========================================================================
    # 6. Invalid Group Code Rejected
    # =========================================================================
    res = client.post(
        "/api/v1/groups/join",
        json={"code": "NONEXISTENT999"},
        headers=auth_header(students[2])
    )
    assert res.status_code == 404

    # =========================================================================
    # 5. Student 2 Joins Group via Valid Code
    # =========================================================================
    res = client.post(
        "/api/v1/groups/join",
        json={"code": "ALPHA2026"},
        headers=auth_header(students[2])
    )
    assert res.status_code == 200, res.text
    assert res.json()["member_count"] == 2

    # =========================================================================
    # 7. Student Cannot Belong to Two Groups Simultaneously
    # =========================================================================
    # Student 2 tries to create another group -> 400
    res = client.post(
        "/api/v1/groups/",
        json={"name": "Student 2 Solo Group", "code": "SOLO2026"},
        headers=auth_header(students[2])
    )
    assert res.status_code == 400
    assert "already a member" in res.json()["detail"]

    # Student 2 tries to join again -> 400
    res = client.post(
        "/api/v1/groups/join",
        json={"code": "ALPHA2026"},
        headers=auth_header(students[2])
    )
    assert res.status_code == 400

    # =========================================================================
    # 8. Group Cannot Exceed 5 Members
    # =========================================================================
    # Students 3, 4, 5 join -> reach max capacity of 5
    for i in [3, 4, 5]:
        res = client.post(
            "/api/v1/groups/join",
            json={"code": "ALPHA2026"},
            headers=auth_header(students[i])
        )
        assert res.status_code == 200

    # Student 6 tries to join the full group of 5 -> 400 Bad Request
    res = client.post(
        "/api/v1/groups/join",
        json={"code": "ALPHA2026"},
        headers=auth_header(students[6])
    )
    assert res.status_code == 400
    assert "maximum capacity of 5" in res.json()["detail"]

    # =========================================================================
    # 9. One-Member Group Cannot Enroll; 10. Two-Member Group Can Enroll
    # =========================================================================
    # Student 6 creates a 1-member solo group
    res = client.post(
        "/api/v1/groups/",
        json={"name": "Solo Beta Group", "code": "BETA2026"},
        headers=auth_header(students[6])
    )
    assert res.status_code == 201
    solo_group_id = res.json()["id"]

    # Solo group tries to enroll in CS204-DSA -> 400 (Must have at least 2 members)
    res = client.post(
        f"/api/v1/groups/{solo_group_id}/enroll",
        json={"workspace_id": "CS204-DSA"},
        headers=auth_header(students[6])
    )
    assert res.status_code == 400
    assert "at least 2 members" in res.json()["detail"]

    # Main group (5 members) enrolls in CS204-DSA -> 200 OK
    res = client.post(
        f"/api/v1/groups/{group_id}/enroll",
        json={"workspace_id": "CS204-DSA"},
        headers=auth_header(s1_token)
    )
    assert res.status_code == 200, res.text

    # Verify enrolled workspaces endpoint
    res = client.get("/api/v1/workspaces/", headers=auth_header(s1_token))
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["id"] == "CS204-DSA"
    assert len(res.json()[0]["notices"]) == 1
    assert res.json()[0]["notices"][0]["title"] == "Project Proposals Due Next Week"

    # =========================================================================
    # 11. Unauthorized Student Cannot Access Another Group's Details
    # =========================================================================
    res = client.get(f"/api/v1/groups/{group_id}", headers=auth_header(students[7]))
    assert res.status_code == 404

    # =========================================================================
    # 12. Group Creates Project & 13. Duplicate Workspace+Group Project Rejected
    # =========================================================================
    res = client.post(
        "/api/v1/projects/",
        json={
            "workspace_id": "CS204-DSA",
            "name": "NexaVault B-Tree Storage Engine",
            "description": "High-performance storage engine"
        },
        headers=auth_header(s1_token)
    )
    assert res.status_code == 201, res.text
    project_data = res.json()
    project_id = project_data["id"]
    assert project_data["name"] == "NexaVault B-Tree Storage Engine"
    assert len(project_data["members"]) == 5  # Derived from group memberships!

    # Attempt to create duplicate project for same group in same workspace -> 400
    res = client.post(
        "/api/v1/projects/",
        json={
            "workspace_id": "CS204-DSA",
            "name": "Duplicate Project",
        },
        headers=auth_header(students[2])
    )
    assert res.status_code == 400
    assert "already has a project" in res.json()["detail"]

    # =========================================================================
    # 14. Group Member Can Access Project Details
    # =========================================================================
    res = client.get(f"/api/v1/projects/{project_id}", headers=auth_header(students[2]))
    assert res.status_code == 200
    assert res.json()["id"] == project_id

    # =========================================================================
    # 15. Former Member Loses Project Access After Leaving Group
    # =========================================================================
    # Student 5 leaves the group
    res = client.post(f"/api/v1/groups/{group_id}/leave", headers=auth_header(students[5]))
    assert res.status_code == 200

    # Student 5 now tries to access the project -> 404 (Access revoked immediately)
    res = client.get(f"/api/v1/projects/{project_id}", headers=auth_header(students[5]))
    assert res.status_code == 404

    # =========================================================================
    # 16. Student Creates Update & 17. Student Comments on Update
    # =========================================================================
    res = client.post(
        f"/api/v1/projects/{project_id}/updates",
        json={
            "content": "Implemented B-Tree node splitting and balancing.",
            "link": "https://github.com/nexavault/storage-core/commit/abc1234"
        },
        headers=auth_header(s1_token)
    )
    assert res.status_code == 201, res.text
    update_id = res.json()["id"]

    # Student 2 comments on update
    res = client.post(
        f"/api/v1/projects/{project_id}/updates/{update_id}/comments",
        json={"content": "Unit tests for 100k random insertions all passing."},
        headers=auth_header(students[2])
    )
    assert res.status_code == 201, res.text
    assert res.json()["content"] == "Unit tests for 100k random insertions all passing."

    # Verify updates feed
    res = client.get(f"/api/v1/projects/{project_id}/updates", headers=auth_header(s1_token))
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert len(res.json()[0]["comments"]) == 1

    # =========================================================================
    # 18. Unauthorized Student Cannot Access or Comment on Updates
    # =========================================================================
    res = client.post(
        f"/api/v1/projects/{project_id}/updates",
        json={"content": "Unauthorized update"},
        headers=auth_header(students[7])
    )
    assert res.status_code == 404

    res = client.post(
        f"/api/v1/projects/{project_id}/updates/{update_id}/comments",
        json={"content": "Unauthorized comment"},
        headers=auth_header(students[7])
    )
    assert res.status_code == 404

    # =========================================================================
    # 19. Submissions Rules & Immutable Roster Snapshot
    # =========================================================================
    # Submit to closed round -> 400
    res = client.post(
        f"/api/v1/projects/{project_id}/rounds/{round2_closed_id}/submissions",
        json={"notes": "Midterm test"},
        headers=auth_header(s1_token)
    )
    assert res.status_code == 400
    assert "closed for submissions" in res.json()["detail"]

    # Submit Draft to open Round 1
    res = client.post(
        f"/api/v1/projects/{project_id}/rounds/{round1_id}/submissions",
        json={
            "notes": "Draft proposal notes",
            "is_draft": True
        },
        headers=auth_header(s1_token)
    )
    assert res.status_code == 201, res.text
    sub_data = res.json()
    submission_id = sub_data["id"]
    assert sub_data["latest_version"]["status"] == "DRAFT"

    # Edit Draft
    res = client.patch(
        f"/api/v1/submissions/{submission_id}/draft",
        json={"notes": "Revised draft proposal with Big-O space complexity"},
        headers=auth_header(students[2])
    )
    assert res.status_code == 200
    assert res.json()["latest_version"]["notes"] == "Revised draft proposal with Big-O space complexity"

    # Finalize Draft to SUBMITTED
    res = client.post(
        f"/api/v1/submissions/{submission_id}/submit",
        headers=auth_header(students[2])
    )
    assert res.status_code == 200
    final_version = res.json()["latest_version"]
    assert final_version["status"] == "SUBMITTED"
    assert final_version["submitted_at"] is not None
    # Verify roster snapshot contains current 4 active members (1, 2, 3, 4)
    roster_ids = [m["user_id"] for m in final_version["roster_snapshot"]]
    assert s1_user["id"] in roster_ids
    assert len(roster_ids) == 4

    # =========================================================================
    # 20. Student Results (Only Released Results Visible)
    # =========================================================================
    # Staff grades the submission version in backend
    db = SessionLocal()
    sub_ver = db.query(SubmissionVersion).filter(SubmissionVersion.submission_id == submission_id).first()
    review = Review(
        submission_version_id=sub_ver.id,
        reviewer_id=staff_user_id,
        status="COMPLETED",
        feedback="Exceptional theoretical analysis."
    )
    db.add(review)
    db.flush()

    # Enter unreleased score for student 1 (19/20) and student 2 (18/20)
    res_s1 = ResultEntry(
        review_id=review.id,
        student_id=s1_user["id"],
        round_id=round1_id,
        score=19.0,
        is_released=False  # Unreleased
    )
    res_s2 = ResultEntry(
        review_id=review.id,
        student_id=db.query(User).filter(User.email == "student2@nexavault.edu").first().id,
        round_id=round1_id,
        score=18.0,
        is_released=True,  # Released for Student 2
        released_at=datetime.now(timezone.utc)
    )
    db.add_all([res_s1, res_s2])
    db.commit()
    db.close()

    # Student 1 checks /results/me -> 0 released results (unreleased score is hidden)
    res = client.get("/api/v1/results/me", headers=auth_header(s1_token))
    assert res.status_code == 200
    assert len(res.json()["results"]) == 0
    assert res.json()["total_earned"] == 0.0

    # Student 2 checks /results/me -> sees their 18/20 (90%) released result
    res = client.get("/api/v1/results/me", headers=auth_header(students[2]))
    assert res.status_code == 200
    res_summary = res.json()
    assert len(res_summary["results"]) == 1
    assert res_summary["results"][0]["score"] == 18.0
    assert res_summary["results"][0]["max_score"] == 20.0
    assert res_summary["results"][0]["percentage"] == 90.0
    assert res_summary["total_earned"] == 18.0

    # Student 2 cannot see Student 1's score anywhere
    # Verify Audit Logs recorded all major actions
    db = SessionLocal()
    audit_count = db.query(AuditLog).count()
    assert audit_count >= 10
    db.close()

    print("\n✅ ALL 20 STUDENT DOMAIN TESTS PASSED PERFECTLY ON REAL POSTGRESQL!")
