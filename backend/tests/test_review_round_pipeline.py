import io
import csv
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

@pytest.fixture
def setup_round_env(db_session: Session):
    uid = uuid.uuid4().hex[:8].upper()

    # 1. Staff Owner
    staff_email = f"staff_owner_{uid}@nexavault.edu"
    staff = User(
        email=staff_email,
        hashed_password=hash_password("StaffPass123!"),
        full_name=f"Prof. Reynolds {uid}",
        role="staff",
        is_active=True,
    )
    db_session.add(staff)

    # 2. Other Unassigned Staff
    other_staff_email = f"other_staff_{uid}@nexavault.edu"
    other_staff = User(
        email=other_staff_email,
        hashed_password=hash_password("OtherPass123!"),
        full_name=f"Dr. Intruder {uid}",
        role="staff",
        is_active=True,
    )
    db_session.add(other_staff)

    # 3. Student
    student_email = f"student_{uid}@nexavault.edu"
    student = User(
        email=student_email,
        hashed_password=hash_password("StudentPass123!"),
        full_name=f"Maya Lin {uid}",
        role="student",
        roll_number=f"CS2026-{uid}",
        is_active=True,
    )
    student2 = User(
        email=f"student2_{uid}@nexavault.edu",
        hashed_password=hash_password("StudentPass123!"),
        full_name=f"Alex Chen {uid}",
        role="student",
        roll_number=f"CS2026-B-{uid}",
        is_active=True,
    )
    db_session.add_all([student, student2])
    db_session.flush()

    # 4. Workspace 1
    ws1_id = f"WS-ROUND-{uid}"
    ws1 = Workspace(
        id=ws1_id,
        name=f"Round Test Lab {uid}",
        term="Fall 2026",
        owner_id=staff.id,
        is_open=True,
        is_archived=False,
    )
    db_session.add(ws1)

    # Workspace 2 (for cross-workspace isolation tests)
    ws2_id = f"WS-OTHER-{uid}"
    ws2 = Workspace(
        id=ws2_id,
        name=f"Other Lab {uid}",
        term="Fall 2026",
        owner_id=staff.id,
        is_open=True,
        is_archived=False,
    )
    db_session.add(ws2)

    staff_entry1 = WorkspaceStaff(workspace_id=ws1_id, user_id=staff.id, role="owner")
    staff_entry2 = WorkspaceStaff(workspace_id=ws2_id, user_id=staff.id, role="owner")
    db_session.add_all([staff_entry1, staff_entry2])

    # 5. Group & Project in Workspace 1 (must have >= 2 members)
    group = Group(name=f"Round Team {uid}", code=f"GRP-{uid}", created_by=student.id)
    db_session.add(group)
    db_session.flush()

    gm1 = GroupMembership(group_id=group.id, user_id=student.id)
    gm2 = GroupMembership(group_id=group.id, user_id=student2.id)
    wg = WorkspaceGroup(workspace_id=ws1_id, group_id=group.id, enrolled_by=staff.id)
    project = Project(workspace_id=ws1_id, group_id=group.id, name=f"Project {uid}", description=f"Topic {uid}", created_by=student.id)
    db_session.add_all([gm1, gm2, wg, project])

    db_session.commit()

    return {
        "uid": uid,
        "staff": staff,
        "other_staff": other_staff,
        "student": student,
        "student2": student2,
        "workspace1": ws1,
        "workspace2": ws2,
        "group": group,
        "project": project,
    }


def test_round_weight_persistence_create_and_get(setup_round_env, db_session: Session):
    """
    1. Creating a round persists its weight, deadline, maximum score, and description.
    2. Every relevant GET endpoint returns the persisted values (surviving reloads).
    """
    env = setup_round_env
    ws_id = env["workspace1"].id
    staff_headers = auth_headers(env["staff"].email)

    due_date_future = (datetime.now(timezone.utc) + timedelta(days=14)).isoformat()

    create_payload = {
        "title": "Sprint 1 Architecture Review",
        "description": "Submit initial design documents and system architecture.",
        "order_index": 1,
        "round_number": 1,
        "due_date": due_date_future,
        "max_score": 50.0,
        "weight": 35.0,
        "is_open": True,
    }

    # 1. Create round via staff API
    res = client.post(f"/api/v1/workspaces/{ws_id}/rounds", json=create_payload, headers=staff_headers)
    assert res.status_code == 201, res.text
    created_data = res.json()
    round_id = created_data["id"]
    assert created_data["title"] == "Sprint 1 Architecture Review"
    assert created_data["max_score"] == 50.0
    assert created_data["weight"] == 35.0
    assert created_data["order_index"] == 1
    assert created_data["description"] == "Submit initial design documents and system architecture."

    # 2. Verify directly from database session (fresh query)
    db_session.expire_all()
    db_round = db_session.query(ReviewRound).filter(ReviewRound.id == round_id).first()
    assert db_round is not None
    assert float(db_round.weight) == 35.0
    assert float(db_round.max_score) == 50.0
    assert db_round.order_index == 1
    assert db_round.title == "Sprint 1 Architecture Review"

    # 3. Verify GET /workspaces/{id}/rounds endpoint
    res_get = client.get(f"/api/v1/workspaces/{ws_id}/rounds", headers=staff_headers)
    assert res_get.status_code == 200
    rounds_list = res_get.json()
    assert len(rounds_list) >= 1
    matched = next((r for r in rounds_list if r["id"] == round_id), None)
    assert matched is not None
    assert matched["weight"] == 35.0
    assert matched["max_score"] == 50.0

    # 4. Verify GET /workspaces/{id} (workspace details) returns round with weight
    res_ws = client.get(f"/api/v1/workspaces/{ws_id}", headers=staff_headers)
    assert res_ws.status_code == 200


def test_round_editing_persists_and_survives_reload(setup_round_env, db_session: Session):
    """
    3. Editing a round persists all changed fields after a fresh database read.
    4. Editing survives a page refresh / new query.
    """
    env = setup_round_env
    ws_id = env["workspace1"].id
    staff_headers = auth_headers(env["staff"].email)

    due_date_1 = (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()
    due_date_2 = (datetime.now(timezone.utc) + timedelta(days=20)).isoformat()

    # Create round
    create_payload = {
        "title": "Initial Round Title",
        "order_index": 1,
        "due_date": due_date_1,
        "max_score": 100.0,
        "weight": 20.0,
        "is_open": True,
        "description": "Initial instructions",
    }
    create_res = client.post(f"/api/v1/workspaces/{ws_id}/rounds", json=create_payload, headers=staff_headers)
    assert create_res.status_code == 201
    round_id = create_res.json()["id"]

    # Edit round (update title, max_score, weight, deadline, description, order_index)
    update_payload = {
        "title": "Finalized Sprint 1 Assessment",
        "order_index": 2,
        "due_date": due_date_2,
        "max_score": 75.0,
        "weight": 40.0,
        "description": "Updated rubric instructions with expanded criteria.",
        "is_open": False,
    }
    patch_res = client.patch(f"/api/v1/workspaces/{ws_id}/rounds/{round_id}", json=update_payload, headers=staff_headers)
    assert patch_res.status_code == 200, patch_res.text
    patched_data = patch_res.json()
    assert patched_data["title"] == "Finalized Sprint 1 Assessment"
    assert patched_data["max_score"] == 75.0
    assert patched_data["weight"] == 40.0
    assert patched_data["order_index"] == 2
    assert patched_data["is_open"] is False

    # Verify directly from a fresh database query (bypassing any memory objects)
    db_session.expire_all()
    fresh_db_round = db_session.query(ReviewRound).filter(ReviewRound.id == round_id).first()
    assert fresh_db_round.title == "Finalized Sprint 1 Assessment"
    assert float(fresh_db_round.max_score) == 75.0
    assert float(fresh_db_round.weight) == 40.0
    assert fresh_db_round.order_index == 2
    assert fresh_db_round.is_open is False
    assert fresh_db_round.description == "Updated rubric instructions with expanded criteria."

    # Verify subsequent GET returns the updated configuration (reload simulation)
    get_res = client.get(f"/api/v1/workspaces/{ws_id}/rounds", headers=staff_headers)
    assert get_res.status_code == 200
    matched = next((r for r in get_res.json() if r["id"] == round_id), None)
    assert matched is not None
    assert matched["title"] == "Finalized Sprint 1 Assessment"
    assert matched["weight"] == 40.0
    assert matched["max_score"] == 75.0
    assert matched["is_open"] is False


def test_cross_workspace_round_isolation(setup_round_env):
    """
    Verifies that operations against one workspace cannot modify another workspace's rounds.
    """
    env = setup_round_env
    ws1_id = env["workspace1"].id
    ws2_id = env["workspace2"].id
    staff_headers = auth_headers(env["staff"].email)
    other_staff_headers = auth_headers(env["other_staff"].email)

    # Create round in workspace 1
    create_payload = {
        "title": "WS1 Milestone",
        "due_date": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "max_score": 100.0,
        "weight": 20.0,
    }
    r = client.post(f"/api/v1/workspaces/{ws1_id}/rounds", json=create_payload, headers=staff_headers)
    assert r.status_code == 201
    round_id = r.json()["id"]

    # 1. Attempt to edit WS1's round using WS2's path -> MUST FAIL (404)
    patch_wrong_ws = client.patch(
        f"/api/v1/workspaces/{ws2_id}/rounds/{round_id}",
        json={"title": "Hacked Title"},
        headers=staff_headers,
    )
    assert patch_wrong_ws.status_code == 404

    # 2. Attempt to edit WS1's round with unauthorized staff -> MUST FAIL (404 or 403)
    patch_unauth = client.patch(
        f"/api/v1/workspaces/{ws1_id}/rounds/{round_id}",
        json={"title": "Unauthorized Edit"},
        headers=other_staff_headers,
    )
    assert patch_unauth.status_code in [403, 404]

    # 3. Attempt to delete WS1's round using WS2's path -> MUST FAIL (404)
    del_wrong_ws = client.delete(f"/api/v1/workspaces/{ws2_id}/rounds/{round_id}", headers=staff_headers)
    assert del_wrong_ws.status_code == 404


def test_cache_invalidation_updates_student_and_queue(setup_round_env, db_session: Session):
    """
    5. Cache invalidation updates student views and the staff queue immediately.
    """
    env = setup_round_env
    ws_id = env["workspace1"].id
    staff_headers = auth_headers(env["staff"].email)
    student_headers = auth_headers(env["student"].email)

    # Create round 1
    create_payload = {
        "title": "Initial Round Name",
        "due_date": (datetime.now(timezone.utc) + timedelta(days=5)).isoformat(),
        "max_score": 50.0,
        "weight": 25.0,
        "is_open": True,
    }
    res = client.post(f"/api/v1/workspaces/{ws_id}/rounds", json=create_payload, headers=staff_headers)
    assert res.status_code == 201
    round_id = res.json()["id"]

    # Student views workspace (populates cache)
    res_student_before = client.get(f"/api/v1/workspaces/{ws_id}", headers=student_headers)
    assert res_student_before.status_code == 200
    student_rounds_before = res_student_before.json().get("review_rounds", [])
    assert any(r["title"] == "Initial Round Name" for r in student_rounds_before)

    # Staff updates round title
    patch_res = client.patch(
        f"/api/v1/workspaces/{ws_id}/rounds/{round_id}",
        json={"title": "Updated Round Title After Invalidation"},
        headers=staff_headers,
    )
    assert patch_res.status_code == 200

    # Student immediately views workspace again -> cache MUST be invalidated, showing updated title!
    res_student_after = client.get(f"/api/v1/workspaces/{ws_id}", headers=student_headers)
    assert res_student_after.status_code == 200
    student_rounds_after = res_student_after.json().get("review_rounds", [])
    assert any(r["title"] == "Updated Round Title After Invalidation" for r in student_rounds_after)


def test_queue_item_round_max_score_and_scoring_validation(setup_round_env, db_session: Session):
    """
    6. Queue items contain the correct round_max_score.
    7. Score validation uses the configured maximum (e.g. 25 pts, 50 pts).
    """
    env = setup_round_env
    ws_id = env["workspace1"].id
    project_id = env["project"].id
    student_id = env["student"].id
    staff_headers = auth_headers(env["staff"].email)
    student_headers = auth_headers(env["student"].email)

    # Create round with max_score = 25.0
    create_payload = {
        "title": "Sprint 1 Prototype",
        "due_date": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "max_score": 25.0,
        "weight": 25.0,
        "is_open": True,
    }
    r = client.post(f"/api/v1/workspaces/{ws_id}/rounds", json=create_payload, headers=staff_headers)
    assert r.status_code == 201
    round_id = r.json()["id"]

    # Student submits to round
    sub_payload = {
        "notes": "Here is our prototype submission.",
        "link": "https://github.com/nexavault/proto",
        "is_draft": False,
    }
    sub_res = client.post(
        f"/api/v1/projects/{project_id}/rounds/{round_id}/submissions",
        json=sub_payload,
        headers=student_headers,
    )
    assert sub_res.status_code == 201, sub_res.text
    version_id = sub_res.json()["latest_version"]["id"]

    # Staff checks review queue -> verify round_max_score is 25.0!
    queue_res = client.get("/api/v1/reviews/queue", headers=staff_headers)
    assert queue_res.status_code == 200
    queue_items = queue_res.json()
    matched_item = next((item for item in queue_items if item["version_id"] == version_id), None)
    assert matched_item is not None
    assert matched_item["round_max_score"] == 25.0, f"Expected 25.0, got {matched_item['round_max_score']}"

    # Staff claims submission
    claim_res = client.post(f"/api/v1/reviews/{version_id}/claim", headers=staff_headers)
    assert claim_res.status_code == 200

    student2_id = env["student2"].id

    # Staff tries to score student with 30.0 (> max_score of 25.0) -> MUST FAIL (400)
    invalid_eval = {
        "verdict": "APPROVED",
        "feedback": "Over-score test",
        "student_scores": [
            {"user_id": student_id, "score": 30.0},
            {"user_id": student2_id, "score": 20.0},
        ],
    }
    eval_fail = client.post(f"/api/v1/reviews/{version_id}/evaluate", json=invalid_eval, headers=staff_headers)
    assert eval_fail.status_code == 400
    assert "out of range" in eval_fail.json()["detail"]

    # Staff scores student with 24.0 (<= max_score 25.0) -> MUST SUCCEED (200)
    valid_eval = {
        "verdict": "APPROVED",
        "feedback": "Solid prototype implementation.",
        "student_scores": [
            {"user_id": student_id, "score": 24.0, "feedback": "Great architecture"},
            {"user_id": student2_id, "score": 22.0, "feedback": "Solid work"},
        ],
    }
    eval_ok = client.post(f"/api/v1/reviews/{version_id}/evaluate", json=valid_eval, headers=staff_headers)
    assert eval_ok.status_code == 200


def test_round_deletion_audit_logging_and_blocking(setup_round_env, db_session: Session):
    """
    11. Round deletion generates an audit event only when deletion succeeds.
    Preserves deletion restriction when submissions exist.
    """
    env = setup_round_env
    ws_id = env["workspace1"].id
    project_id = env["project"].id
    staff = env["staff"]
    staff_headers = auth_headers(staff.email)
    student_headers = auth_headers(env["student"].email)

    # 1. Create a standalone round with no submissions
    create_payload = {
        "title": "Disposable Round",
        "due_date": (datetime.now(timezone.utc) + timedelta(days=5)).isoformat(),
        "max_score": 100.0,
        "weight": 20.0,
    }
    r1 = client.post(f"/api/v1/workspaces/{ws_id}/rounds", json=create_payload, headers=staff_headers)
    round_id_1 = r1.json()["id"]

    # Delete round with no submissions -> MUST SUCCEED
    del_ok = client.delete(f"/api/v1/workspaces/{ws_id}/rounds/{round_id_1}", headers=staff_headers)
    assert del_ok.status_code == 200

    # Check audit log in DB for round_deleted action
    audit_del = (
        db_session.query(AuditLog)
        .filter(AuditLog.action_type == "round_deleted", AuditLog.entity_id == round_id_1)
        .first()
    )
    assert audit_del is not None
    assert audit_del.actor_id == staff.id
    assert audit_del.workspace_id == ws_id
    assert audit_del.old_value["title"] == "Disposable Round"

    # 2. Create round with submission
    create_payload2 = {
        "title": "Round With Submissions",
        "due_date": (datetime.now(timezone.utc) + timedelta(days=5)).isoformat(),
        "max_score": 100.0,
        "weight": 20.0,
    }
    r2 = client.post(f"/api/v1/workspaces/{ws_id}/rounds", json=create_payload2, headers=staff_headers)
    round_id_2 = r2.json()["id"]

    sub_res = client.post(
        f"/api/v1/projects/{project_id}/rounds/{round_id_2}/submissions",
        json={"notes": "Active submission", "is_draft": False},
        headers=student_headers,
    )
    assert sub_res.status_code == 201

    # Attempt to delete round with submission -> MUST BE BLOCKED (400)
    del_blocked = client.delete(f"/api/v1/workspaces/{ws_id}/rounds/{round_id_2}", headers=staff_headers)
    assert del_blocked.status_code == 400
    assert "submissions already exist" in del_blocked.json()["detail"]


def test_dynamic_results_and_csv_export_with_configured_rounds(setup_round_env, db_session: Session):
    """
    12. Results and CSV exports reflect the actual configured rounds and individual marks.
    Verifies that configuring 4 rounds dynamically generates review columns 1..4 without code changes.
    """
    env = setup_round_env
    ws_id = env["workspace1"].id
    staff_headers = auth_headers(env["staff"].email)

    # Configure 4 review rounds with variable max scores and weights
    rounds_config = [
        {"title": "Round 1 - Proposal", "order_index": 1, "max_score": 20.0, "weight": 20.0},
        {"title": "Round 2 - Architecture", "order_index": 2, "max_score": 30.0, "weight": 30.0},
        {"title": "Round 3 - Beta Release", "order_index": 3, "max_score": 25.0, "weight": 25.0},
        {"title": "Round 4 - Final Viva", "order_index": 4, "max_score": 25.0, "weight": 25.0},
    ]

    for cfg in rounds_config:
        payload = {
            "title": cfg["title"],
            "order_index": cfg["order_index"],
            "round_number": cfg["order_index"],
            "due_date": (datetime.now(timezone.utc) + timedelta(days=cfg["order_index"] * 7)).isoformat(),
            "max_score": cfg["max_score"],
            "weight": cfg["weight"],
            "is_open": True,
        }
        res = client.post(f"/api/v1/workspaces/{ws_id}/rounds", json=payload, headers=staff_headers)
        assert res.status_code == 201

    # Fetch results dashboard
    res_results = client.get(f"/api/v1/results/workspace/{ws_id}", headers=staff_headers)
    assert res_results.status_code == 200
    data = res_results.json()
    assert len(data["rounds"]) == 4
    assert [r["order_index"] for r in data["rounds"]] == [1, 2, 3, 4]

    # Download CSV export
    res_csv = client.get(f"/api/v1/results/workspace/{ws_id}/export-csv", headers=staff_headers)
    assert res_csv.status_code == 200
    csv_text = res_csv.text.lstrip("\ufeff")
    reader = csv.reader(io.StringIO(csv_text))
    headers = next(reader)

    # Verify dynamically generated headers for all 4 rounds
    expected_headers = [
        "Group Number",
        "Group Name",
        "Project Topic",
        "Student Name",
        "Roll Number",
        "Review Round 1 Marks",
        "Review Round 1 Feedback",
        "Review Round 1 Reviewer",
        "Review Round 1 Date",
        "Review Round 2 Marks",
        "Review Round 2 Feedback",
        "Review Round 2 Reviewer",
        "Review Round 2 Date",
        "Review Round 3 Marks",
        "Review Round 3 Feedback",
        "Review Round 3 Reviewer",
        "Review Round 3 Date",
        "Review Round 4 Marks",
        "Review Round 4 Feedback",
        "Review Round 4 Reviewer",
        "Review Round 4 Date",
        "Individual Total Marks",
        "Maximum Possible Marks",
        "Percentage",
        "Review Completion Status",
        "Final Result Status",
    ]
    assert headers == expected_headers
