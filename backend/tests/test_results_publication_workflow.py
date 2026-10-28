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
def setup_workflow_env(db_session: Session):
    cache.clear()
    uid = uuid.uuid4().hex[:8].upper()

    # 1. Authorized Faculty Staff
    staff = User(
        email=f"prof_{uid}@nexavault.edu",
        hashed_password=hash_password("Pass123!"),
        full_name=f"Prof. Smith {uid}",
        role="staff",
        is_active=True,
    )
    db_session.add(staff)

    # 2. Unauthorized Staff (different faculty member)
    unauthorized_staff = User(
        email=f"other_prof_{uid}@nexavault.edu",
        hashed_password=hash_password("Pass123!"),
        full_name=f"Prof. Other {uid}",
        role="staff",
        is_active=True,
    )
    db_session.add(unauthorized_staff)

    # 3. Eligible Student 1 (Group Alpha)
    student1 = User(
        email=f"student1_{uid}@nexavault.edu",
        hashed_password=hash_password("Pass123!"),
        full_name=f"Student One {uid}",
        roll_number=f"23AID{uid[:4]}1",
        role="student",
        is_active=True,
    )
    db_session.add(student1)

    # 4. Peer Student 2 (Same Group Alpha)
    student2 = User(
        email=f"student2_{uid}@nexavault.edu",
        hashed_password=hash_password("Pass123!"),
        full_name=f"Student Two {uid}",
        roll_number=f"23AID{uid[:4]}2",
        role="student",
        is_active=True,
    )
    db_session.add(student2)

    # 5. Outsider Student 3 (Different Group Beta)
    student3 = User(
        email=f"student3_{uid}@nexavault.edu",
        hashed_password=hash_password("Pass123!"),
        full_name=f"Student Three {uid}",
        roll_number=f"23AID{uid[:4]}3",
        role="student",
        is_active=True,
    )
    db_session.add(student3)

    db_session.flush()

    # Workspace
    ws_id = f"WS-PUB-{uid}"
    ws = Workspace(
        id=ws_id,
        name=f"Cloud Architecture {uid}",
        term="Fall 2026",
        owner_id=staff.id,
    )
    db_session.add(ws)

    # Review Rounds
    round1 = ReviewRound(
        workspace_id=ws_id,
        title="Round 1: Architecture Blueprint",
        order_index=1,
        max_score=40.0,
        weight=40.0,
        is_open=True,
        due_date=datetime.now(timezone.utc) + timedelta(days=7),
    )
    round2 = ReviewRound(
        workspace_id=ws_id,
        title="Round 2: Prototype Implementation",
        order_index=2,
        max_score=60.0,
        weight=60.0,
        is_open=True,
        due_date=datetime.now(timezone.utc) + timedelta(days=14),
    )
    db_session.add_all([round1, round2])
    db_session.flush()

    # Group Alpha
    group_alpha = Group(
        name=f"Group Alpha {uid}",
        code=f"GA-{uid}",
        created_by=student1.id,
    )
    db_session.add(group_alpha)
    db_session.flush()

    # Group Beta
    group_beta = Group(
        name=f"Group Beta {uid}",
        code=f"GB-{uid}",
        created_by=student3.id,
    )
    db_session.add(group_beta)
    db_session.flush()

    # Enroll groups in workspace
    wg_alpha = WorkspaceGroup(workspace_id=ws_id, group_id=group_alpha.id, enrolled_by=staff.id)
    wg_beta = WorkspaceGroup(workspace_id=ws_id, group_id=group_beta.id, enrolled_by=staff.id)
    db_session.add_all([wg_alpha, wg_beta])

    # Memberships
    m1 = GroupMembership(group_id=group_alpha.id, user_id=student1.id)
    m2 = GroupMembership(group_id=group_alpha.id, user_id=student2.id)
    m3 = GroupMembership(group_id=group_beta.id, user_id=student3.id)
    db_session.add_all([m1, m2, m3])

    # Projects
    proj_alpha = Project(
        workspace_id=ws_id,
        group_id=group_alpha.id,
        name=f"Microservices Platform {uid}",
        description="Scalable Kubernetes-backed microservices platform",
        created_by=student1.id,
    )
    proj_beta = Project(
        workspace_id=ws_id,
        group_id=group_beta.id,
        name=f"Data Pipeline {uid}",
        description="Streaming data platform",
        created_by=student3.id,
    )
    db_session.add_all([proj_alpha, proj_beta])
    db_session.flush()

    # Submissions for Alpha in Round 1
    sub1 = Submission(
        project_id=proj_alpha.id,
        round_id=round1.id,
    )
    db_session.add(sub1)
    db_session.flush()

    sub_ver1 = SubmissionVersion(
        submission_id=sub1.id,
        version_number=1,
        status="SUBMITTED",
        submitted_by=student1.id,
        submitted_at=datetime.now(timezone.utc) - timedelta(hours=2),
        roster_snapshot=[
            {"id": student1.id, "name": student1.full_name, "email": student1.email},
            {"id": student2.id, "name": student2.full_name, "email": student2.email},
        ],
    )
    db_session.add(sub_ver1)
    db_session.commit()

    return {
        "uid": uid,
        "staff": staff,
        "unauthorized_staff": unauthorized_staff,
        "student1": student1,
        "student2": student2,
        "student3": student3,
        "ws": ws,
        "round1": round1,
        "round2": round2,
        "group_alpha": group_alpha,
        "group_beta": group_beta,
        "proj_alpha": proj_alpha,
        "proj_beta": proj_beta,
        "sub_ver1": sub_ver1,
    }


def test_complete_results_publication_and_visibility_workflow(setup_workflow_env, db_session):
    env = setup_workflow_env
    staff_headers = auth_headers(env["staff"].email)
    unauthorized_staff_headers = auth_headers(env["unauthorized_staff"].email)
    student1_headers = auth_headers(env["student1"].email)
    student2_headers = auth_headers(env["student2"].email)
    student3_headers = auth_headers(env["student3"].email)

    version_id = env["sub_ver1"].id
    round1_id = env["round1"].id
    ws_id = env["ws"].id

    # -------------------------------------------------------------
    # 1. Staff Claims and Evaluates (Saves Marks into PostgreSQL)
    # -------------------------------------------------------------
    # Claim
    claim_resp = client.post(f"/api/v1/reviews/{version_id}/claim", headers=staff_headers)
    assert claim_resp.status_code == 200

    # Evaluate with individual student scores and feedback
    eval_payload = {
        "verdict": "APPROVED",
        "feedback": "Outstanding architecture diagram with modular component boundaries.",
        "student_scores": [
            {"user_id": env["student1"].id, "score": 38.0, "feedback": "Exceptional leadership and system design."},
            {"user_id": env["student2"].id, "score": 35.5, "feedback": "Great API specifications and schemas."},
        ],
    }
    eval_resp = client.post(f"/api/v1/reviews/{version_id}/evaluate", json=eval_payload, headers=staff_headers)
    assert eval_resp.status_code == 200
    assert eval_resp.json()["verdict"] == "APPROVED"

    # Verify marks persisted to PostgreSQL as is_released == False
    entries = db_session.query(ResultEntry).filter(ResultEntry.round_id == round1_id).all()
    assert len(entries) == 2
    for entry in entries:
        assert entry.is_released is False
        assert entry.released_at is None
        assert float(entry.score) in [38.0, 35.5]

    # -------------------------------------------------------------
    # 2. Saved but Unpublished Marks MUST Remain Hidden From Students
    # -------------------------------------------------------------
    # Student 1 checks released results
    res1 = client.get("/api/v1/results/me", headers=student1_headers)
    assert res1.status_code == 200
    assert res1.json()["results"] == []
    assert res1.json()["total_earned"] == 0.0

    # Student 2 checks released results
    res2 = client.get("/api/v1/results/me", headers=student2_headers)
    assert res2.status_code == 200
    assert res2.json()["results"] == []

    # Check Staff Results Ledger shows status is "GRADED" (Draft), not "PUBLISHED"
    ws_res = client.get(f"/api/v1/results/workspace/{ws_id}", headers=staff_headers)
    assert ws_res.status_code == 200
    ws_data = ws_res.json()
    r1_header = next(r for r in ws_data["rounds"] if r["id"] == round1_id)
    assert r1_header["is_released"] is False
    assert r1_header["graded_count"] == 2
    assert r1_header["released_count"] == 0

    s1_item = next(s for s in ws_data["students"] if s["student_id"] == env["student1"].id)
    assert s1_item["rounds"][str(round1_id)]["status"] == "GRADED"
    assert s1_item["rounds"][str(round1_id)]["is_released"] is False

    # -------------------------------------------------------------
    # 3. Unauthenticated and Unauthorized Staff CANNOT Publish Results
    # -------------------------------------------------------------
    # Unauthenticated
    unauth_resp = client.post(f"/api/v1/results/workspace/{ws_id}/rounds/{round1_id}/publish")
    assert unauth_resp.status_code == 401

    # Unauthorized staff (no access to workspace)
    forbidden_resp = client.post(
        f"/api/v1/results/workspace/{ws_id}/rounds/{round1_id}/publish",
        headers=unauthorized_staff_headers
    )
    assert forbidden_resp.status_code == 404

    # -------------------------------------------------------------
    # 4. Authorized Staff Publishes Results Successfully
    # -------------------------------------------------------------
    pub_resp = client.post(
        f"/api/v1/results/workspace/{ws_id}/rounds/{round1_id}/publish",
        headers=staff_headers
    )
    assert pub_resp.status_code == 200
    pub_data = pub_resp.json()
    assert pub_data["published_count"] == 2
    assert pub_data["round_id"] == round1_id
    assert pub_data["already_published"] is False

    # Verify PostgreSQL state
    db_session.expire_all()
    for entry in db_session.query(ResultEntry).filter(ResultEntry.round_id == round1_id).all():
        assert entry.is_released is True
        assert entry.released_at is not None

    # Verify Staff Ledger reflects "PUBLISHED" status and counts
    ws_res_after = client.get(f"/api/v1/results/workspace/{ws_id}", headers=staff_headers)
    assert ws_res_after.status_code == 200
    ws_data_after = ws_res_after.json()
    r1_header_after = next(r for r in ws_data_after["rounds"] if r["id"] == round1_id)
    assert r1_header_after["is_released"] is True
    assert r1_header_after["released_count"] == 2
    s1_item_after = next(s for s in ws_data_after["students"] if s["student_id"] == env["student1"].id)
    assert s1_item_after["rounds"][str(round1_id)]["is_released"] is True

    # -------------------------------------------------------------
    # 5. Eligible Student 1 Retrieves Published Marks & Authorized Feedback
    # -------------------------------------------------------------
    s1_res = client.get("/api/v1/results/me", headers=student1_headers)
    assert s1_res.status_code == 200
    s1_data = s1_res.json()
    assert len(s1_data["results"]) == 1
    r_item = s1_data["results"][0]
    assert r_item["round_id"] == round1_id
    assert r_item["score"] == 38.0
    assert r_item["max_score"] == 40.0
    assert r_item["percentage"] == 95.0
    assert r_item["feedback"] == "Exceptional leadership and system design."
    assert r_item["status"] == "PUBLISHED"
    assert r_item["released_at"] is not None
    assert r_item["workspace_id"] == ws_id

    # -------------------------------------------------------------
    # 6. Eligible Student 2 Retrieves Their Own Private Marks
    # -------------------------------------------------------------
    s2_res = client.get("/api/v1/results/me", headers=student2_headers)
    assert s2_res.status_code == 200
    s2_data = s2_res.json()
    assert len(s2_data["results"]) == 1
    assert s2_data["results"][0]["score"] == 35.5
    assert s2_data["results"][0]["feedback"] == "Great API specifications and schemas."
    # Make sure Student 2 does NOT see Student 1's score (38.0)
    assert s2_data["results"][0]["score"] != 38.0

    # -------------------------------------------------------------
    # 7. Outsider Student 3 CANNOT See Group Alpha's Results
    # -------------------------------------------------------------
    s3_res = client.get("/api/v1/results/me", headers=student3_headers)
    assert s3_res.status_code == 200
    assert s3_res.json()["results"] == []
    assert s3_res.json()["total_earned"] == 0.0

    # -------------------------------------------------------------
    # 8. Results Remain Visible on Fresh Login (Persistence & Session Reload)
    # -------------------------------------------------------------
    fresh_token = create_access_token(subject=env["student1"].email)
    fresh_headers = {"Authorization": f"Bearer {fresh_token}"}
    fresh_res = client.get("/api/v1/results/me", headers=fresh_headers)
    assert fresh_res.status_code == 200
    assert len(fresh_res.json()["results"]) == 1
    assert fresh_res.json()["results"][0]["score"] == 38.0

    # -------------------------------------------------------------
    # 9. Duplicate Publication is Safe & Idempotent
    # -------------------------------------------------------------
    dup_pub_resp = client.post(
        f"/api/v1/results/workspace/{ws_id}/rounds/{round1_id}/publish",
        headers=staff_headers
    )
    assert dup_pub_resp.status_code == 200
    dup_data = dup_pub_resp.json()
    assert dup_data["already_published"] is True
    assert dup_data["published_count"] == 2

    # -------------------------------------------------------------
    # 10. Publication on Empty / Incomplete Round Rejects Cleanly
    # -------------------------------------------------------------
    # Round 2 has no evaluated marks
    empty_round_resp = client.post(
        f"/api/v1/results/workspace/{ws_id}/rounds/{env['round2'].id}/publish",
        headers=staff_headers
    )
    assert empty_round_resp.status_code == 400
    assert "No evaluated grades exist" in empty_round_resp.json()["detail"]
