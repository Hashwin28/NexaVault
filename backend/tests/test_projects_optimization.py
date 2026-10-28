import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.db.session import SessionLocal
from app.core.security import hash_password, create_access_token
from app.core.cache import cache
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceStaff, WorkspaceGroup
from app.models.group import Group, GroupMembership
from app.models.project import Project, ProjectUpdate, UpdateComment
from app.models.review import ReviewRound, Submission, SubmissionVersion, Review, ResultEntry
from app.models.github import GithubLink, GithubCommit

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
def project_test_env(db_session: Session):
    ts = datetime.now().strftime("%Y%m%d%H%M%S%f")

    staff = User(
        email=f"staff_{ts}@nexavault.edu",
        hashed_password=hash_password("Pass123!"),
        full_name="Staff Optimizer",
        role="staff",
        is_active=True,
    )
    db_session.add(staff)

    students = []
    for i in range(2):
        s = User(
            email=f"student_{i}_{ts}@nexavault.edu",
            hashed_password=hash_password("Pass123!"),
            full_name=f"Student Opt {i}",
            role="student",
            is_active=True,
        )
        db_session.add(s)
        students.append(s)

    # Outside student
    outsider = User(
        email=f"outsider_{ts}@nexavault.edu",
        hashed_password=hash_password("Pass123!"),
        full_name="Outsider Student",
        role="student",
        is_active=True,
    )
    db_session.add(outsider)
    db_session.flush()

    ws = Workspace(
        id=f"WS-OPT-{ts[-6:].upper()}",
        name="Workspace Opt",
        term="Fall 2026",
        owner_id=staff.id,
        is_open=True,
        is_archived=False,
    )
    db_session.add(ws)

    ws_staff = WorkspaceStaff(workspace_id=ws.id, user_id=staff.id)
    db_session.add(ws_staff)

    group = Group(
        name=f"Group Opt {ts[-4:]}",
        code=f"GOPT-{ts[-4:]}",
        created_by=students[0].id,
    )
    db_session.add(group)
    db_session.flush()

    for s in students:
        gm = GroupMembership(group_id=group.id, user_id=s.id)
        db_session.add(gm)

    enrollment = WorkspaceGroup(workspace_id=ws.id, group_id=group.id, enrolled_by=staff.id)
    db_session.add(enrollment)

    proj = Project(
        workspace_id=ws.id,
        group_id=group.id,
        name="LSM Engine Core",
        description="High-performance key-value storage engine",
        created_by=students[0].id,
    )
    db_session.add(proj)
    db_session.flush()

    # Review Round
    rr = ReviewRound(
        workspace_id=ws.id,
        title="Round 1 Design",
        order_index=1,
        due_date=datetime.now(timezone.utc) + timedelta(days=7),
        max_score=30.0,
        weight=30.0,
        is_open=True,
    )
    db_session.add(rr)
    db_session.flush()

    # Submission with review feedback
    sub = Submission(project_id=proj.id, round_id=rr.id)
    db_session.add(sub)
    db_session.flush()

    ver = SubmissionVersion(
        submission_id=sub.id,
        version_number=1,
        submitted_by=students[0].id,
        status="APPROVED",
        notes="Complete architecture deliverable",
        link="https://docs.google.com/1",
        roster_snapshot=[{"user_id": s.id, "full_name": s.full_name, "email": s.email} for s in students],
        submitted_at=datetime.now(timezone.utc),
    )
    db_session.add(ver)
    db_session.flush()

    rev = Review(
        submission_version_id=ver.id,
        reviewer_id=staff.id,
        status="APPROVED",
        feedback="Outstanding performance benchmarks and cache design.",
        completed_at=datetime.now(timezone.utc),
    )
    db_session.add(rev)
    db_session.flush()

    for s in students:
        db_session.add(
            ResultEntry(
                review_id=rev.id,
                student_id=s.id,
                round_id=rr.id,
                score=28.5,
                feedback="Strong work.",
                is_released=True,
                released_at=datetime.now(timezone.utc),
            )
        )

    # Updates and comments
    up = ProjectUpdate(
        project_id=proj.id,
        author_id=students[0].id,
        content="Integrated B-tree index.",
    )
    db_session.add(up)
    db_session.flush()

    comm = UpdateComment(
        update_id=up.id,
        author_id=staff.id,
        content="Looks solid, proceed to memtable.",
    )
    db_session.add(comm)

    db_session.commit()

    return {
        "staff_email": staff.email,
        "student_email": students[0].email,
        "outsider_email": outsider.email,
        "project_id": proj.id,
        "workspace_id": ws.id,
        "round_id": rr.id,
        "submission_id": sub.id,
    }

def test_project_progress_endpoint(project_test_env):
    pid = project_test_env["project_id"]
    headers = auth_headers(project_test_env["student_email"])

    resp = client.get(f"/api/v1/projects/{pid}/progress", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["project_id"] == pid
    assert data["approved_marks"] == 30.0
    assert data["total_round_marks"] == 30.0
    assert data["progress_percentage"] == 100.0
    assert len(data["approved_rounds"]) == 1

def test_project_reviews_endpoint(project_test_env):
    pid = project_test_env["project_id"]
    headers = auth_headers(project_test_env["student_email"])

    resp = client.get(f"/api/v1/projects/{pid}/reviews", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["project_id"] == pid
    assert len(data["reviews"]) == 1
    assert "Outstanding performance benchmarks" in data["reviews"][0]["feedback"]
    assert data["reviews"][0]["status"] == "APPROVED"

def test_outsider_denied_access(project_test_env):
    pid = project_test_env["project_id"]
    headers = auth_headers(project_test_env["outsider_email"])

    for subpath in ["", "/updates", "/submissions", "/github", "/progress", "/reviews"]:
        resp = client.get(f"/api/v1/projects/{pid}{subpath}", headers=headers)
        assert resp.status_code == 404, f"Path {subpath} should be 404 for outsider"

def test_cache_and_invalidation(project_test_env):
    pid = project_test_env["project_id"]
    headers = auth_headers(project_test_env["student_email"])

    cache.clear()
    # 1. First fetch: populates cache
    resp1 = client.get(f"/api/v1/projects/{pid}/progress", headers=headers)
    assert resp1.status_code == 200

    # 2. Cached fetch
    resp2 = client.get(f"/api/v1/projects/{pid}/progress", headers=headers)
    assert resp2.status_code == 200
    assert resp1.json() == resp2.json()

    # 3. Post an update: should invalidate project updates but leave progress intact
    post_resp = client.post(
        f"/api/v1/projects/{pid}/updates",
        headers=headers,
        json={"content": "New test update note"}
    )
    assert post_resp.status_code == 201

    # Updates list should reflect new item
    up_resp = client.get(f"/api/v1/projects/{pid}/updates", headers=headers)
    assert len(up_resp.json()) == 2
