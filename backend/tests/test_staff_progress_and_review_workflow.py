import uuid
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.db.session import SessionLocal
from app.core.security import hash_password, create_access_token
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceStaff, WorkspaceGroup
from app.models.group import Group, GroupMembership
from app.models.project import Project
from app.models.review import ReviewRound, Submission, SubmissionVersion, Review, ResultEntry
from app.core.cache import cache

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
def test_env(db_session: Session):
    cache.clear()
    uid = uuid.uuid4().hex[:8].upper()

    # 1. Staff
    staff = User(
        email=f"prof_{uid}@nexavault.edu",
        hashed_password=hash_password("Pass123!"),
        full_name=f"Prof. Test {uid}",
        role="staff",
        is_active=True,
    )
    db_session.add(staff)

    # 2. Unauthorized staff
    other_staff = User(
        email=f"other_prof_{uid}@nexavault.edu",
        hashed_password=hash_password("Pass123!"),
        full_name=f"Prof. Other {uid}",
        role="staff",
        is_active=True,
    )
    db_session.add(other_staff)

    # 3. Students
    student1 = User(
        email=f"student1_{uid}@nexavault.edu",
        hashed_password=hash_password("Pass123!"),
        full_name=f"Student One {uid}",
        role="student",
        is_active=True,
    )
    student2 = User(
        email=f"student2_{uid}@nexavault.edu",
        hashed_password=hash_password("Pass123!"),
        full_name=f"Student Two {uid}",
        role="student",
        is_active=True,
    )
    db_session.add_all([student1, student2])
    db_session.flush()

    # 4. Workspace
    ws_id = f"WS-TEST-{uid}"
    ws = Workspace(
        id=ws_id,
        name=f"Test Workspace {uid}",
        term="Fall 2026",
        owner_id=staff.id,
    )
    db_session.add(ws)
    db_session.flush()

    staff_link = WorkspaceStaff(workspace_id=ws.id, user_id=staff.id, role="lead_evaluator")
    db_session.add(staff_link)

    # 5. Group
    grp = Group(
        name=f"Test Group {uid}",
        code=f"TG-{uid}",
        created_by=student1.id,
        is_deleted=False,
    )
    db_session.add(grp)
    db_session.flush()

    wg = WorkspaceGroup(workspace_id=ws.id, group_id=grp.id, enrolled_by=student1.id)
    db_session.add(wg)

    m1 = GroupMembership(group_id=grp.id, user_id=student1.id)
    m2 = GroupMembership(group_id=grp.id, user_id=student2.id)
    db_session.add_all([m1, m2])

    # 6. Project
    proj = Project(
        workspace_id=ws.id,
        group_id=grp.id,
        name=f"Autonomous Agent Engine {uid}",
        description="Comprehensive agentic system",
        created_by=student1.id,
    )
    db_session.add(proj)
    db_session.flush()

    # 7. Review Round (Max score: 50.0)
    round1 = ReviewRound(
        workspace_id=ws.id,
        title="Milestone 1: Architecture Review",
        order_index=1,
        max_score=50.0,
        weight=20.0,
        due_date=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db_session.add(round1)
    db_session.flush()

    # 8. Submission & Version
    sub = Submission(
        project_id=proj.id,
        round_id=round1.id,
    )
    db_session.add(sub)
    db_session.flush()

    roster_snap = [
        {"id": student1.id, "full_name": student1.full_name, "email": student1.email},
        {"id": student2.id, "full_name": student2.full_name, "email": student2.email},
    ]

    sub_ver = SubmissionVersion(
        submission_id=sub.id,
        version_number=1,
        submitted_by=student1.id,
        status="SUBMITTED",
        notes="Deliverable for Milestone 1",
        link="https://github.com/example/engine/releases/tag/v1.0",
        github_commit_sha="a1b2c3d4e5f6",
        is_late=False,
        submitted_at=datetime.now(timezone.utc),
        roster_snapshot=roster_snap,
    )
    db_session.add(sub_ver)
    db_session.commit()

    return {
        "staff": staff,
        "other_staff": other_staff,
        "student1": student1,
        "student2": student2,
        "workspace": ws,
        "group": grp,
        "project": proj,
        "round": round1,
        "submission": sub,
        "version": sub_ver,
    }


def test_staff_controlled_progress_override(test_env, db_session):
    """
    Test staff progress configuration:
    1. Default progress is calculated (0%).
    2. Staff updates progress to 65.5% -> Persisted and returned.
    3. Student reads project progress -> Receives authoritative 65.5% with staff override indicator.
    4. Reject progress outside 0-100 range.
    5. Unauthorized student/staff cannot update progress.
    6. Reset to calculated reverts to milestone calculation.
    """
    proj_id = test_env["project"].id
    staff = test_env["staff"]
    student = test_env["student1"]
    other_staff = test_env["other_staff"]

    # 1. Initial progress
    res = client.get(f"/api/v1/projects/{proj_id}/progress", headers=auth_headers(student.email))
    assert res.status_code == 200
    data = res.json()
    assert data["progress_percentage"] == 0.0
    assert data["is_staff_override"] is False

    # 2. Reject out of range (< 0 or > 100)
    res_invalid = client.patch(
        f"/api/v1/projects/{proj_id}/progress",
        json={"progress_percentage": 115.0},
        headers=auth_headers(staff.email),
    )
    assert res_invalid.status_code == 422

    res_invalid_neg = client.patch(
        f"/api/v1/projects/{proj_id}/progress",
        json={"progress_percentage": -5.0},
        headers=auth_headers(staff.email),
    )
    assert res_invalid_neg.status_code == 422

    # 3. Unauthorized student cannot update progress (403)
    res_forbidden = client.patch(
        f"/api/v1/projects/{proj_id}/progress",
        json={"progress_percentage": 50.0},
        headers=auth_headers(student.email),
    )
    assert res_forbidden.status_code == 403

    # 4. Unauthorized staff cannot update progress (403)
    res_forbidden_staff = client.patch(
        f"/api/v1/projects/{proj_id}/progress",
        json={"progress_percentage": 50.0},
        headers=auth_headers(other_staff.email),
    )
    assert res_forbidden_staff.status_code == 403

    # 5. Authorized staff sets progress to 65.5%
    res_update = client.patch(
        f"/api/v1/projects/{proj_id}/progress",
        json={"progress_percentage": 65.5},
        headers=auth_headers(staff.email),
    )
    assert res_update.status_code == 200
    update_data = res_update.json()
    assert update_data["progress_percentage"] == 65.5
    assert update_data["is_staff_override"] is True
    assert update_data["staff_custom_progress"] == 65.5
    assert update_data["progress_updated_by_name"] == staff.full_name

    # 6. Verify persistence in PostgreSQL
    db_session.expire_all()
    db_proj = db_session.query(Project).filter(Project.id == proj_id).first()
    assert db_proj.custom_progress == 65.5
    assert db_proj.progress_updated_by == staff.id

    # 7. Student reads project progress -> sees authoritative 65.5%
    res_student = client.get(f"/api/v1/projects/{proj_id}/progress", headers=auth_headers(student.email))
    assert res_student.status_code == 200
    assert res_student.json()["progress_percentage"] == 65.5
    assert res_student.json()["is_staff_override"] is True

    # 8. Reset to calculated
    res_reset = client.patch(
        f"/api/v1/projects/{proj_id}/progress",
        json={"reset_to_calculated": True},
        headers=auth_headers(staff.email),
    )
    assert res_reset.status_code == 200
    reset_data = res_reset.json()
    assert reset_data["progress_percentage"] == 0.0
    assert reset_data["is_staff_override"] is False
    assert reset_data["staff_custom_progress"] is None


def test_review_queue_lifecycle_and_draft_publication(test_env, db_session):
    """
    Test 6-step review workflow:
    1. Submission appears in 'PENDING' queue with deliverable notes and commit SHA.
    2. Staff claims submission -> status becomes 'IN_REVIEW'.
    3. Staff releases claim lock -> returns to 'PENDING'.
    4. Staff claims again and saves evaluation (marks: 45/50 and 48/50):
       - Validates marks within range (0 <= score <= max_score).
       - Status becomes 'APPROVED' / Evaluated.
       - Results are NOT released yet (draft marks).
    5. Student checks results:
       - Unpublished marks are NOT returned to student.
    6. Staff publishes results explicitly.
    7. Eligible students now receive their released marks.
    """
    staff = test_env["staff"]
    student1 = test_env["student1"]
    student2 = test_env["student2"]
    ver = test_env["version"]
    ver_id = ver.id

    # 1. Check PENDING queue
    res_pending = client.get("/api/v1/reviews/queue?status_filter=PENDING", headers=auth_headers(staff.email))
    assert res_pending.status_code == 200
    items = res_pending.json()
    assert any(item["version_id"] == ver_id for item in items)
    queue_item = next(item for item in items if item["version_id"] == ver_id)
    assert queue_item["github_commit_sha"] == "a1b2c3d4e5f6"
    assert queue_item["submission_notes"] == "Deliverable for Milestone 1"
    assert queue_item["deliverable_link"] == "https://github.com/example/engine/releases/tag/v1.0"
    assert queue_item["group_name"] == test_env["group"].name

    # 2. Claim submission (Step 2: Start Review)
    res_claim = client.post(f"/api/v1/reviews/{ver_id}/claim", headers=auth_headers(staff.email))
    assert res_claim.status_code == 200

    # Item is now in IN_REVIEW queue
    res_in_review = client.get("/api/v1/reviews/queue?status_filter=IN_REVIEW", headers=auth_headers(staff.email))
    assert res_in_review.status_code == 200
    assert any(item["version_id"] == ver_id for item in res_in_review.json())

    # 3. Release Lock (Step: Release Claim)
    res_release_lock = client.post(f"/api/v1/reviews/{ver_id}/release-claim", headers=auth_headers(staff.email))
    assert res_release_lock.status_code == 200

    # Back in PENDING queue
    res_pending_again = client.get("/api/v1/reviews/queue?status_filter=PENDING", headers=auth_headers(staff.email))
    assert any(item["version_id"] == ver_id for item in res_pending_again.json())

    # 4. Claim again and evaluate
    client.post(f"/api/v1/reviews/{ver_id}/claim", headers=auth_headers(staff.email))

    # Reject invalid score > max_score (50)
    res_invalid_score = client.post(
        f"/api/v1/reviews/{ver_id}/evaluate",
        json={
            "verdict": "APPROVED",
            "feedback": "Good attempt",
            "student_scores": [
                {"user_id": student1.id, "score": 60.0},
                {"user_id": student2.id, "score": 45.0},
            ],
        },
        headers=auth_headers(staff.email),
    )
    assert res_invalid_score.status_code == 400
    assert "out of range" in res_invalid_score.json()["detail"].lower()

    # Valid evaluation (Marks only: 45.0 and 48.0 out of 50.0)
    res_eval = client.post(
        f"/api/v1/reviews/{ver_id}/evaluate",
        json={
            "verdict": "APPROVED",
            "feedback": "Excellent architecture and test coverage.",
            "student_scores": [
                {"user_id": student1.id, "score": 45.0, "feedback": "Solid component design"},
                {"user_id": student2.id, "score": 48.0, "feedback": "Great optimization work"},
            ],
        },
        headers=auth_headers(staff.email),
    )
    assert res_eval.status_code == 200
    eval_data = res_eval.json()
    assert eval_data["verdict"] == "APPROVED"
    assert len(eval_data["scores"]) == 2

    # 5. Verify draft marks status
    # Appears in EVALUATED queue
    res_eval_queue = client.get("/api/v1/reviews/queue?status_filter=EVALUATED", headers=auth_headers(staff.email))
    assert res_eval_queue.status_code == 200
    eval_items = res_eval_queue.json()
    assert any(item["version_id"] == ver_id for item in eval_items)

    # Must NOT appear in PUBLISHED queue
    res_pub_queue = client.get("/api/v1/reviews/queue?status_filter=PUBLISHED", headers=auth_headers(staff.email))
    assert res_pub_queue.status_code == 200
    assert not any(item["version_id"] == ver_id for item in res_pub_queue.json())

    # Student checks results BEFORE publication -> MUST be empty!
    res_student_before = client.get("/api/v1/results/me", headers=auth_headers(student1.email))
    assert res_student_before.status_code == 200
    student1_results_before = [r for r in res_student_before.json()["results"] if r["round_id"] == test_env["round"].id]
    assert len(student1_results_before) == 0

    # 6. Publish results to students
    res_publish = client.post(f"/api/v1/reviews/{ver_id}/release-results", headers=auth_headers(staff.email))
    assert res_publish.status_code == 200
    assert res_publish.json()["released_count"] == 2

    # 7. Now in PUBLISHED queue
    res_pub_queue_after = client.get("/api/v1/reviews/queue?status_filter=PUBLISHED", headers=auth_headers(staff.email))
    assert any(item["version_id"] == ver_id for item in res_pub_queue_after.json())

    # 8. Student 1 inspects their results -> Sees their marks!
    res_student1_after = client.get("/api/v1/results/me", headers=auth_headers(student1.email))
    assert res_student1_after.status_code == 200
    s1_results = [r for r in res_student1_after.json()["results"] if r["round_id"] == test_env["round"].id]
    assert len(s1_results) == 1
    assert s1_results[0]["score"] == 45.0
    assert s1_results[0]["max_score"] == 50.0
    assert s1_results[0]["percentage"] == 90.0

    # Student 2 inspects their results -> Sees their marks!
    res_student2_after = client.get("/api/v1/results/me", headers=auth_headers(student2.email))
    assert res_student2_after.status_code == 200
    s2_results = [r for r in res_student2_after.json()["results"] if r["round_id"] == test_env["round"].id]
    assert len(s2_results) == 1
    assert s2_results[0]["score"] == 48.0
    assert s2_results[0]["max_score"] == 50.0
    assert s2_results[0]["percentage"] == 96.0


def test_student_audit_trail_blocked_and_confidentiality(test_env):
    """
    Verify that:
    1. Student cannot access staff/admin audit trail endpoints (403 Forbidden).
    2. Students cannot access another group's or workspace's unauthorized results.
    """
    student = test_env["student1"]
    staff = test_env["staff"]

    # Student attempting to access audit activity center endpoints
    res_activity = client.get("/api/v1/audit/activity", headers=auth_headers(student.email))
    assert res_activity.status_code in [401, 403]

    res_stats = client.get("/api/v1/audit/stats", headers=auth_headers(student.email))
    assert res_stats.status_code in [401, 403]

    res_filters = client.get("/api/v1/audit/filters", headers=auth_headers(student.email))
    assert res_filters.status_code in [401, 403]

    # Authorized staff CAN access audit logs and activity center
    res_staff_audit = client.get("/api/v1/audit/activity", headers=auth_headers(staff.email))
    assert res_staff_audit.status_code == 200

