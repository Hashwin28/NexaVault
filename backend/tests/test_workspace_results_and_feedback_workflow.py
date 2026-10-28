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
def multi_workspace_env(db_session: Session):
    cache.clear()
    uid = uuid.uuid4().hex[:8].upper()

    # Staff
    staff = User(
        email=f"prof_{uid}@nexavault.edu",
        hashed_password=hash_password("Pass123!"),
        full_name=f"Prof. Reynolds {uid}",
        role="staff",
        is_active=True,
    )
    db_session.add(staff)

    # Student A (Alice)
    student_a = User(
        email=f"student_a_{uid}@nexavault.edu",
        hashed_password=hash_password("Pass123!"),
        full_name=f"Alice Student {uid}",
        role="student",
        is_active=True,
    )
    # Student B (Bob, teammate in Group 1)
    student_b = User(
        email=f"student_b_{uid}@nexavault.edu",
        hashed_password=hash_password("Pass123!"),
        full_name=f"Bob Teammate {uid}",
        role="student",
        is_active=True,
    )
    # Student C (Charlie, outsider)
    student_c = User(
        email=f"student_c_{uid}@nexavault.edu",
        hashed_password=hash_password("Pass123!"),
        full_name=f"Charlie Outsider {uid}",
        role="student",
        is_active=True,
    )
    db_session.add_all([student_a, student_b, student_c])
    db_session.flush()

    # Workspace 1: CS204 Advanced DSA
    ws1 = Workspace(
        id=f"CS204_{uid}",
        name=f"CS204: Advanced DSA {uid}",
        term="Fall 2026",
        owner_id=staff.id,
        is_open=True,
    )
    # Workspace 2: AI301 Machine Learning
    ws2 = Workspace(
        id=f"AI301_{uid}",
        name=f"AI301: Machine Learning {uid}",
        term="Fall 2026",
        owner_id=staff.id,
        is_open=True,
    )
    db_session.add_all([ws1, ws2])
    db_session.flush()

    staff_m1 = WorkspaceStaff(workspace_id=ws1.id, user_id=staff.id, role="owner")
    staff_m2 = WorkspaceStaff(workspace_id=ws2.id, user_id=staff.id, role="owner")
    db_session.add_all([staff_m1, staff_m2])

    # Review Rounds for WS1
    round_ws1_r1 = ReviewRound(
        workspace_id=ws1.id,
        title="Round 1: System Architecture",
        order_index=1,
        max_score=40.0,
        weight=20.0,
        due_date=datetime.now(timezone.utc) + timedelta(days=7),
        is_open=True,
    )
    round_ws1_r2 = ReviewRound(
        workspace_id=ws1.id,
        title="Round 2: Implementation",
        order_index=2,
        max_score=60.0,
        weight=30.0,
        due_date=datetime.now(timezone.utc) + timedelta(days=14),
        is_open=True,
    )
    # Review Round for WS2
    round_ws2_r1 = ReviewRound(
        workspace_id=ws2.id,
        title="Round 1: Exploratory Data Analysis",
        order_index=1,
        max_score=50.0,
        weight=25.0,
        due_date=datetime.now(timezone.utc) + timedelta(days=10),
        is_open=True,
    )
    db_session.add_all([round_ws1_r1, round_ws1_r2, round_ws2_r1])
    db_session.flush()

    # Group 1 (Alice & Bob) enrolled in both WS1 and WS2
    group1 = Group(name=f"Team Algo {uid}", code=f"ALG{uid[:3]}", created_by=student_a.id, is_deleted=False)
    db_session.add(group1)
    db_session.flush()
    db_session.add_all([
        GroupMembership(group_id=group1.id, user_id=student_a.id),
        GroupMembership(group_id=group1.id, user_id=student_b.id),
        WorkspaceGroup(workspace_id=ws1.id, group_id=group1.id, enrolled_by=staff.id),
        WorkspaceGroup(workspace_id=ws2.id, group_id=group1.id, enrolled_by=staff.id),
    ])

    # Projects: Proj 1 in WS1, Proj 2 in WS2
    proj1 = Project(
        name=f"NexaVault Core {uid}",
        workspace_id=ws1.id,
        group_id=group1.id,
        created_by=student_a.id,
    )
    proj2 = Project(
        name=f"VisionNet Classifier {uid}",
        workspace_id=ws2.id,
        group_id=group1.id,
        created_by=student_a.id,
    )
    db_session.add_all([proj1, proj2])
    db_session.commit()

    return {
        "staff": staff,
        "student_a": student_a,
        "student_b": student_b,
        "student_c": student_c,
        "ws1": ws1,
        "ws2": ws2,
        "round_ws1_r1": round_ws1_r1,
        "round_ws1_r2": round_ws1_r2,
        "round_ws2_r1": round_ws2_r1,
        "group1": group1,
        "proj1": proj1,
        "proj2": proj2,
    }

def test_multi_workspace_results_and_feedback(multi_workspace_env, db_session: Session):
    env = multi_workspace_env
    staff_headers = auth_headers(env["staff"].email)
    student_a_headers = auth_headers(env["student_a"].email)
    student_b_headers = auth_headers(env["student_b"].email)
    student_c_headers = auth_headers(env["student_c"].email)

    # 1. Initially, Alice checks results: both workspaces are present, with 0 published marks
    res = client.get("/api/v1/results/me", headers=student_a_headers)
    assert res.status_code == 200
    data = res.json()
    assert "workspaces" in data
    assert len(data["workspaces"]) == 2
    ws1_data = next(w for w in data["workspaces"] if w["workspace_id"] == env["ws1"].id)
    ws2_data = next(w for w in data["workspaces"] if w["workspace_id"] == env["ws2"].id)
    assert ws1_data["total_earned"] == 0.0
    assert ws1_data["project_name"] == env["proj1"].name
    assert ws2_data["total_earned"] == 0.0
    assert ws2_data["project_name"] == env["proj2"].name
    assert data["results"] == []

    # 2. Alice submits Round 1 deliverable for WS1 (NexaVault Core)
    sub1_resp = client.post(
        f"/api/v1/projects/{env['proj1'].id}/rounds/{env['round_ws1_r1'].id}/submissions",
        json={
            "notes": "Completed high-level system architecture and API schemas.",
            "link": "https://github.com/Hashwin28/NexaVault/pull/1",
            "github_commit_sha": "a1b2c3d4",
            "is_draft": False,
        },
        headers=student_a_headers,
    )
    assert sub1_resp.status_code == 201
    sub1_data = sub1_resp.json()
    v1_id = sub1_data["latest_version"]["id"]

    # 3. Staff claims and evaluates WS1 Round 1 with feedback and individual marks
    claim_resp = client.post(f"/api/v1/reviews/{v1_id}/claim", headers=staff_headers)
    assert claim_resp.status_code == 200

    eval_payload = {
        "verdict": "APPROVED",
        "feedback": "Outstanding architectural specifications. Clean modular decoupling.",
        "student_scores": [
            {"user_id": env["student_a"].id, "score": 38.0, "feedback": "Great diagrams and leadership."},
            {"user_id": env["student_b"].id, "score": 36.0, "feedback": "Solid database schema definition."},
        ],
    }
    eval_resp = client.post(f"/api/v1/reviews/{v1_id}/evaluate", json=eval_payload, headers=staff_headers)
    assert eval_resp.status_code == 200
    assert eval_resp.json()["verdict"] == "APPROVED"

    # 4. Before publication, marks remain HIDDEN from Alice and Bob
    res_draft_a = client.get("/api/v1/results/me", headers=student_a_headers)
    assert res_draft_a.status_code == 200
    assert res_draft_a.json()["results"] == []
    ws1_draft = next(w for w in res_draft_a.json()["workspaces"] if w["workspace_id"] == env["ws1"].id)
    assert ws1_draft["total_earned"] == 0.0
    assert ws1_draft["results"] == []

    # 5. Staff publishes results for WS1 Round 1
    pub_resp = client.post(
        f"/api/v1/results/workspace/{env['ws1'].id}/rounds/{env['round_ws1_r1'].id}/publish",
        headers=staff_headers,
    )
    assert pub_resp.status_code == 200
    assert pub_resp.json()["published_count"] == 2

    # 6. Now Alice checks /results/me:
    # - WS1 shows 38.0 / 40.0 marks (95.0%) with Round 1 results
    # - WS2 shows 0.0 / 0.0 marks (empty state, NO contamination from WS1)
    # - Marks from WS1 and WS2 are strictly separated!
    res_pub_a = client.get("/api/v1/results/me", headers=student_a_headers)
    assert res_pub_a.status_code == 200
    pub_data = res_pub_a.json()
    assert len(pub_data["results"]) == 1

    ws1_after = next(w for w in pub_data["workspaces"] if w["workspace_id"] == env["ws1"].id)
    ws2_after = next(w for w in pub_data["workspaces"] if w["workspace_id"] == env["ws2"].id)

    assert ws1_after["total_earned"] == 38.0
    assert ws1_after["total_possible"] == 40.0
    assert ws1_after["percentage"] == 95.0
    assert ws1_after["published_rounds_count"] == 1
    assert len(ws1_after["results"]) == 1
    assert ws1_after["results"][0]["score"] == 38.0
    assert ws1_after["results"][0]["feedback"] == "Great diagrams and leadership."
    assert ws1_after["results"][0]["reviewer_name"] == env["staff"].full_name

    # WS2 must NOT be contaminated by WS1 marks!
    assert ws2_after["total_earned"] == 0.0
    assert ws2_after["total_possible"] == 0.0
    assert ws2_after["results"] == []

    # 7. Bob checks /results/me: sees HIS marks (36.0), not Alice's (38.0)
    res_pub_b = client.get("/api/v1/results/me", headers=student_b_headers)
    assert res_pub_b.status_code == 200
    ws1_b = next(w for w in res_pub_b.json()["workspaces"] if w["workspace_id"] == env["ws1"].id)
    assert ws1_b["total_earned"] == 36.0
    assert ws1_b["results"][0]["score"] == 36.0

    # 8. Outsider Charlie checks /results/me: sees zero results
    res_c = client.get("/api/v1/results/me", headers=student_c_headers)
    assert res_c.status_code == 200
    assert res_c.json()["results"] == []

    # 9. Revision requested workflow on WS2:
    # Alice submits deliverable for WS2
    sub2_resp = client.post(
        f"/api/v1/projects/{env['proj2'].id}/rounds/{env['round_ws2_r1'].id}/submissions",
        json={
            "notes": "Initial EDA notebook.",
            "link": "https://github.com/Hashwin28/VisionNet/pull/1",
            "is_draft": False,
        },
        headers=student_a_headers,
    )
    assert sub2_resp.status_code == 201
    v2_id = sub2_resp.json()["latest_version"]["id"]

    # Staff requests revision on WS2
    claim_resp2 = client.post(f"/api/v1/reviews/{v2_id}/claim", headers=staff_headers)
    assert claim_resp2.status_code == 200

    rev_payload = {
        "verdict": "REVISION_REQUESTED",
        "feedback": "Please include correlation heatmaps and handle missing values before grading.",
    }
    eval_resp2 = client.post(f"/api/v1/reviews/{v2_id}/evaluate", json=rev_payload, headers=staff_headers)
    assert eval_resp2.status_code == 200
    assert eval_resp2.json()["verdict"] == "REVISION_REQUESTED"

    # Alice queries submissions for WS2 project and sees faculty feedback and revision notice
    subs_list_resp = client.get(f"/api/v1/projects/{env['proj2'].id}/submissions", headers=student_a_headers)
    assert subs_list_resp.status_code == 200
    sub_items = subs_list_resp.json()
    assert len(sub_items) == 1
    latest_v = sub_items[0]["latest_version"]
    assert latest_v["status"] == "REVISION_REQUESTED"
    assert latest_v["feedback"] == "Please include correlation heatmaps and handle missing values before grading."
    assert latest_v["reviewer_name"] == env["staff"].full_name

    # 10. Persistence verification on fresh login
    fresh_token = create_access_token(subject=env["student_a"].email)
    fresh_headers = {"Authorization": f"Bearer {fresh_token}"}
    fresh_res = client.get("/api/v1/results/me", headers=fresh_headers)
    assert fresh_res.status_code == 200
    fresh_ws1 = next(w for w in fresh_res.json()["workspaces"] if w["workspace_id"] == env["ws1"].id)
    assert fresh_ws1["total_earned"] == 38.0
    assert len(fresh_ws1["results"]) == 1
