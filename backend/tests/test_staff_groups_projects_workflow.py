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
def setup_staff_env(db_session: Session):
    cache.clear()
    uid = uuid.uuid4().hex[:8].upper()

    # 1. Primary Staff (Owner)
    staff1 = User(
        email=f"prof1_{uid}@nexavault.edu",
        hashed_password=hash_password("Pass123!"),
        full_name=f"Prof. Primary {uid}",
        role="staff",
        is_active=True,
    )
    db_session.add(staff1)

    # 2. Secondary Staff (Unauthorized to WS1)
    staff2 = User(
        email=f"prof2_{uid}@nexavault.edu",
        hashed_password=hash_password("Pass123!"),
        full_name=f"Prof. Secondary {uid}",
        role="staff",
        is_active=True,
    )
    db_session.add(staff2)

    # 3. Students for Group A (With Project)
    student_a1 = User(
        email=f"alice_{uid}@nexavault.edu",
        hashed_password=hash_password("Pass123!"),
        full_name=f"Alice {uid}",
        roll_number=f"23AID{uid[:4]}A1",
        role="student",
        is_active=True,
    )
    student_a2 = User(
        email=f"bob_{uid}@nexavault.edu",
        hashed_password=hash_password("Pass123!"),
        full_name=f"Bob {uid}",
        roll_number=f"23AID{uid[:4]}A2",
        role="student",
        is_active=True,
    )

    # 4. Students for Group B (Without Project)
    student_b1 = User(
        email=f"charlie_{uid}@nexavault.edu",
        hashed_password=hash_password("Pass123!"),
        full_name=f"Charlie {uid}",
        roll_number=f"23AID{uid[:4]}B1",
        role="student",
        is_active=True,
    )
    student_b2 = User(
        email=f"diana_{uid}@nexavault.edu",
        hashed_password=hash_password("Pass123!"),
        full_name=f"Diana {uid}",
        roll_number=f"23AID{uid[:4]}B2",
        role="student",
        is_active=True,
    )

    db_session.add_all([student_a1, student_a2, student_b1, student_b2])
    db_session.flush()

    # Workspace 1 (Owned by staff1)
    ws1_id = f"WS-GRP-{uid}"
    ws1 = Workspace(
        id=ws1_id,
        name=f"Distributed Systems {uid}",
        term="Fall 2026",
        owner_id=staff1.id,
    )
    db_session.add(ws1)

    # Workspace 2 (Owned by staff2)
    ws2_id = f"WS-OTHER-{uid}"
    ws2 = Workspace(
        id=ws2_id,
        name=f"Isolated Course {uid}",
        term="Fall 2026",
        owner_id=staff2.id,
    )
    db_session.add(ws2)

    # Review Rounds for ws1
    round1 = ReviewRound(
        workspace_id=ws1_id,
        title="Round 1: Architecture Blueprint",
        order_index=1,
        max_score=50.0,
        weight=50.0,
        is_open=True,
        due_date=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db_session.add(round1)
    db_session.flush()

    # Group A: Has 2 members, enrolled in ws1
    group_a = Group(
        name=f"Team Alpha {uid}",
        code=f"GA-{uid[:4]}",
        created_by=student_a1.id,
        is_deleted=False,
    )
    db_session.add(group_a)
    db_session.flush()

    mem_a1 = GroupMembership(group_id=group_a.id, user_id=student_a1.id)
    mem_a2 = GroupMembership(group_id=group_a.id, user_id=student_a2.id)
    enroll_a = WorkspaceGroup(workspace_id=ws1_id, group_id=group_a.id, enrolled_by=student_a1.id)
    db_session.add_all([mem_a1, mem_a2, enroll_a])

    # Project for Group A
    project_a = Project(
        workspace_id=ws1_id,
        group_id=group_a.id,
        name=f"Kubernetes Autoscale Engine {uid}",
        description="High throughput autoscaler for distributed microservices",
        created_by=student_a1.id,
    )
    db_session.add(project_a)
    db_session.flush()

    # Submission for Project A
    sub_a = Submission(
        project_id=project_a.id,
        round_id=round1.id,
    )
    db_session.add(sub_a)
    db_session.flush()

    ver_a = SubmissionVersion(
        submission_id=sub_a.id,
        version_number=1,
        status="SUBMITTED",
        submitted_by=student_a1.id,
        github_commit_sha="c0ffee1234567890abcdef1234567890abcdef12",
        notes="Initial architecture blueprints and docker manifests",
        created_at=datetime.now(timezone.utc),
    )
    db_session.add(ver_a)
    db_session.flush()

    # Review & Grades for Group A (Draft, unreleased)
    rev_a = Review(
        submission_version_id=ver_a.id,
        reviewer_id=staff1.id,
        status="APPROVED",
        feedback="Exceptional modularity and high-availability design.",
        completed_at=datetime.now(timezone.utc),
    )
    db_session.add(rev_a)
    db_session.flush()

    entry_a1 = ResultEntry(
        review_id=rev_a.id,
        round_id=round1.id,
        student_id=student_a1.id,
        score=48.0,
        feedback="Great leadership and architecture docs.",
        is_released=False,
    )
    entry_a2 = ResultEntry(
        review_id=rev_a.id,
        round_id=round1.id,
        student_id=student_a2.id,
        score=46.5,
        feedback="Solid docker setup.",
        is_released=False,
    )
    db_session.add_all([entry_a1, entry_a2])

    # Group B: Has 2 members, enrolled in ws1, but NO project created yet
    group_b = Group(
        name=f"Team Beta {uid}",
        code=f"GB-{uid[:4]}",
        created_by=student_b1.id,
        is_deleted=False,
    )
    db_session.add(group_b)
    db_session.flush()

    mem_b1 = GroupMembership(group_id=group_b.id, user_id=student_b1.id)
    mem_b2 = GroupMembership(group_id=group_b.id, user_id=student_b2.id)
    enroll_b = WorkspaceGroup(workspace_id=ws1_id, group_id=group_b.id, enrolled_by=student_b1.id)
    db_session.add_all([mem_b1, mem_b2, enroll_b])

    db_session.commit()

    return {
        "staff1": staff1,
        "staff2": staff2,
        "student_a1": student_a1,
        "student_a2": student_a2,
        "student_b1": student_b1,
        "student_b2": student_b2,
        "ws1": ws1,
        "ws2": ws2,
        "round1": round1,
        "group_a": group_a,
        "group_b": group_b,
        "project_a": project_a,
        "entry_a1": entry_a1,
        "entry_a2": entry_a2,
    }


def test_staff_groups_oversight_listing(setup_staff_env):
    """Staff can list all groups across authorized workspaces with distinct project associations."""
    env = setup_staff_env
    staff_headers = auth_headers(env["staff1"].email)

    resp = client.get("/api/v1/groups/staff/oversight", headers=staff_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 2

    # Find Group A and Group B
    group_a_item = next((g for g in data if g["id"] == env["group_a"].id), None)
    group_b_item = next((g for g in data if g["id"] == env["group_b"].id), None)

    assert group_a_item is not None
    assert group_a_item["name"] == env["group_a"].name
    assert group_a_item["code"] == env["group_a"].code
    assert group_a_item["workspace_id"] == env["ws1"].id
    assert group_a_item["has_project"] is True
    assert group_a_item["project"] is not None
    assert group_a_item["project"]["id"] == env["project_a"].id
    assert group_a_item["project"]["name"] == env["project_a"].name
    assert len(group_a_item["members"]) == 2
    assert any(m["email"] == env["student_a1"].email for m in group_a_item["members"])

    # Group B has no project
    assert group_b_item is not None
    assert group_b_item["has_project"] is False
    assert group_b_item["project"] is None
    assert len(group_b_item["members"]) == 2


def test_staff_groups_filter_by_workspace(setup_staff_env):
    """Staff can filter groups oversight by specific workspace."""
    env = setup_staff_env
    staff_headers = auth_headers(env["staff1"].email)

    resp = client.get(f"/api/v1/groups/staff/oversight?workspace_id={env['ws1'].id}", headers=staff_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert all(g["workspace_id"] == env["ws1"].id for g in data)


def test_staff_groups_unauthorized_workspace_forbidden(setup_staff_env):
    """Staff attempting to query groups in a workspace they don't have access to gets 403."""
    env = setup_staff_env
    staff2_headers = auth_headers(env["staff2"].email)

    # staff2 does NOT own ws1
    resp = client.get(f"/api/v1/groups/staff/oversight?workspace_id={env['ws1'].id}", headers=staff2_headers)
    assert resp.status_code in [403, 404]


def test_staff_group_detail_oversight(setup_staff_env):
    """Staff retrieves detailed group oversight including submissions history."""
    env = setup_staff_env
    staff_headers = auth_headers(env["staff1"].email)

    resp = client.get(f"/api/v1/groups/{env['group_a'].id}/oversight", headers=staff_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["id"] == env["group_a"].id
    assert data["has_project"] is True
    assert data["project"]["name"] == env["project_a"].name
    assert len(data["members"]) == 2
    assert len(data["submissions"]) >= 1


def test_student_cannot_access_staff_groups(setup_staff_env):
    """Students cannot access staff groups oversight endpoints."""
    env = setup_staff_env
    student_headers = auth_headers(env["student_a1"].email)

    resp1 = client.get("/api/v1/groups/staff/oversight", headers=student_headers)
    assert resp1.status_code == 403

    resp2 = client.get(f"/api/v1/groups/{env['group_a'].id}/oversight", headers=student_headers)
    assert resp2.status_code == 403


def test_staff_projects_oversight_listing(setup_staff_env):
    """Staff can list all projects with group metadata, members, and grading status."""
    env = setup_staff_env
    staff_headers = auth_headers(env["staff1"].email)

    resp = client.get("/api/v1/projects/staff/oversight", headers=staff_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert isinstance(data, list)

    proj_item = next((p for p in data if p["project_id"] == env["project_a"].id), None)
    assert proj_item is not None
    assert proj_item["name"] == env["project_a"].name
    assert proj_item["workspace_id"] == env["ws1"].id
    assert proj_item["group_id"] == env["group_a"].id
    assert proj_item["group_code"] == env["group_a"].code
    assert len(proj_item["members"]) == 2
    assert proj_item["submission_count"] >= 1
    assert proj_item["results_status"] == "DRAFT"  # marks exist but unreleased


def test_staff_project_detail_oversight(setup_staff_env):
    """Staff retrieves comprehensive project oversight: metadata, submissions, results, rounds."""
    env = setup_staff_env
    staff_headers = auth_headers(env["staff1"].email)

    resp = client.get(f"/api/v1/projects/{env['project_a'].id}/oversight", headers=staff_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert "project" in data
    assert data["project"]["id"] == env["project_a"].id
    assert data["project"]["name"] == env["project_a"].name
    assert data["project"]["group_id"] == env["group_a"].id

    assert "submissions" in data
    assert len(data["submissions"]) >= 1
    sub = data["submissions"][0]
    assert sub["version_number"] == 1
    assert sub["round_name"] == env["round1"].title
    assert sub["commit_hash"] is not None

    assert "results" in data
    assert len(data["results"]) == 2
    assert any(r["student_id"] == env["student_a1"].id and r["score"] == 48.0 for r in data["results"])
    assert any(r["student_id"] == env["student_a2"].id and r["score"] == 46.5 for r in data["results"])

    assert "rounds" in data
    assert len(data["rounds"]) >= 1
    assert data["rounds"][0]["round_id"] == env["round1"].id


def test_student_cannot_access_project_oversight(setup_staff_env):
    """Students cannot access project staff oversight endpoint."""
    env = setup_staff_env
    student_headers = auth_headers(env["student_a1"].email)

    resp = client.get(f"/api/v1/projects/{env['project_a'].id}/oversight", headers=student_headers)
    assert resp.status_code == 403


def test_publish_workflow_and_student_visibility(setup_staff_env):
    """Full lifecycle: marks in DRAFT -> Publish via API -> Student sees marks -> Results status PUBLISHED."""
    env = setup_staff_env
    staff_headers = auth_headers(env["staff1"].email)
    student_headers = auth_headers(env["student_a1"].email)

    # 1. Before publish: Student gets 0 results from /results/me
    st_res_before = client.get("/api/v1/results/me", headers=student_headers)
    assert st_res_before.status_code == 200
    assert len(st_res_before.json()["results"]) == 0

    # 2. Staff publishes results for round1
    pub_resp = client.post(
        f"/api/v1/results/workspace/{env['ws1'].id}/rounds/{env['round1'].id}/publish",
        headers=staff_headers,
    )
    assert pub_resp.status_code == 200
    pub_data = pub_resp.json()
    assert pub_data["published_count"] >= 2

    # 3. After publish: Student 1 sees their released marks
    st_res_after = client.get("/api/v1/results/me", headers=student_headers)
    assert st_res_after.status_code == 200
    st_marks = st_res_after.json()["results"]
    assert len(st_marks) >= 1
    my_mark = next((m for m in st_marks if m["round_id"] == env["round1"].id), None)
    assert my_mark is not None
    assert my_mark["score"] == 48.0
    assert my_mark["status"] == "PUBLISHED"

    # 4. Student 1 cannot see Student 2's individual score
    assert not any(m["score"] == 46.5 for m in st_marks)

    # 5. Project oversight reflects PUBLISHED status
    proj_resp = client.get(f"/api/v1/projects/{env['project_a'].id}/oversight", headers=staff_headers)
    assert proj_resp.status_code == 200
    all_res = proj_resp.json()["results"]
    assert all(r["is_released"] is True for r in all_res)
