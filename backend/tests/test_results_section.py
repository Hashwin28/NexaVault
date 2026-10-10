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
def setup_results_env(db_session: Session):
    uid = uuid.uuid4().hex[:8].upper()

    # 1. Staff Owner
    staff_email = f"prof_{uid}@nexavault.edu"
    staff = User(
        email=staff_email,
        hashed_password=hash_password("StaffPass123!"),
        full_name=f"Prof. Henderson {uid}",
        role="staff",
        is_active=True,
    )
    db_session.add(staff)

    # 2. Unauthorized Staff (different teacher)
    other_staff_email = f"other_{uid}@nexavault.edu"
    other_staff = User(
        email=other_staff_email,
        hashed_password=hash_password("OtherPass123!"),
        full_name=f"Dr. Unassigned {uid}",
        role="staff",
        is_active=True,
    )
    db_session.add(other_staff)

    # 3. Students in Group Alpha
    student_a_email = f"student_a_{uid}@nexavault.edu"
    student_a = User(
        email=student_a_email,
        hashed_password=hash_password("Pass123!"),
        full_name=f"Alice Adams {uid}",
        roll_number=f"23AID{uid[:4]}A",
        role="student",
        is_active=True,
    )
    db_session.add(student_a)

    student_b_email = f"student_b_{uid}@nexavault.edu"
    student_b = User(
        email=student_b_email,
        hashed_password=hash_password("Pass123!"),
        full_name=f"Bob Baker {uid}",
        roll_number=f"23AID{uid[:4]}B",
        role="student",
        is_active=True,
    )
    db_session.add(student_b)

    # 4. Student in Group Beta (has a zero mark and a missing round)
    student_c_email = f"student_c_{uid}@nexavault.edu"
    student_c = User(
        email=student_c_email,
        hashed_password=hash_password("Pass123!"),
        full_name=f"Charlie Clark {uid}",
        roll_number=f"23AID{uid[:4]}C",
        role="student",
        is_active=True,
    )
    db_session.add(student_c)

    db_session.flush()

    # 5. Workspace
    ws_id = f"WS-RES-{uid}"
    ws = Workspace(
        id=ws_id,
        name=f"Advanced Algorithms {uid}",
        owner_id=staff.id,
        term="Fall 2026",
    )
    db_session.add(ws)
    db_session.flush()

    staff_link = WorkspaceStaff(workspace_id=ws.id, user_id=staff.id, role="owner")
    db_session.add(staff_link)

    # 6. Variable Review Rounds (2 rounds with different max scores)
    round1 = ReviewRound(
        workspace_id=ws.id,
        title="Milestone 1: Design & Architecture",
        order_index=1,
        due_date=datetime.now(timezone.utc) - timedelta(days=5),
        max_score=40.0,
        is_open=True,
    )
    round2 = ReviewRound(
        workspace_id=ws.id,
        title="Milestone 2: Final Implementation",
        order_index=2,
        due_date=datetime.now(timezone.utc) + timedelta(days=10),
        max_score=60.0,
        is_open=True,
    )
    db_session.add(round1)
    db_session.add(round2)
    db_session.flush()

    # 7. Groups
    group_alpha = Group(
        name="Alpha Devs",
        code=f"GRP-ALP-{uid[:4]}",
        created_by=student_a.id,
    )
    group_beta = Group(
        name="Beta Innovators",
        code=f"GRP-BET-{uid[:4]}",
        created_by=student_c.id,
    )
    db_session.add(group_alpha)
    db_session.add(group_beta)
    db_session.flush()

    # Enroll groups in workspace
    db_session.add(WorkspaceGroup(workspace_id=ws.id, group_id=group_alpha.id, enrolled_by=staff.id))
    db_session.add(WorkspaceGroup(workspace_id=ws.id, group_id=group_beta.id, enrolled_by=staff.id))

    # Add memberships
    db_session.add(GroupMembership(group_id=group_alpha.id, user_id=student_a.id))
    db_session.add(GroupMembership(group_id=group_alpha.id, user_id=student_b.id))
    db_session.add(GroupMembership(group_id=group_beta.id, user_id=student_c.id))

    # 8. Projects
    project_alpha = Project(
        workspace_id=ws.id,
        group_id=group_alpha.id,
        name="Distributed Consensus Engine",
        description="High-performance raft implementation",
        created_by=student_a.id,
    )
    project_beta = Project(
        workspace_id=ws.id,
        group_id=group_beta.id,
        name="Quantum Cryptography Simulator",
        description="Simulates BB84 protocol",
        created_by=student_c.id,
    )
    db_session.add(project_alpha)
    db_session.add(project_beta)
    db_session.flush()

    # 9. Submissions & Individual Grading for Group Alpha in Round 1
    sub_a1 = Submission(project_id=project_alpha.id, round_id=round1.id)
    db_session.add(sub_a1)
    db_session.flush()

    sub_ver_a1 = SubmissionVersion(
        submission_id=sub_a1.id,
        version_number=1,
        submitted_by=student_a.id,
        status="APPROVED",
    )
    db_session.add(sub_ver_a1)
    db_session.flush()

    rev_a1 = Review(
        submission_version_id=sub_ver_a1.id,
        reviewer_id=staff.id,
        status="APPROVED",
        feedback="Overall solid architectural submission, but individual code quality varied.",
        completed_at=datetime.now(timezone.utc) - timedelta(days=2),
    )
    db_session.add(rev_a1)
    db_session.flush()

    # Individual grading: Alice gets 38.0 with specific feedback, Bob gets 28.5 with specific feedback!
    alice_feedback = "Exceptional concurrency model design, thoroughly tested with zero deadlocks."
    bob_feedback = "Good module diagrams, but missed edge-case handling for partitioned networks."
    db_session.add(ResultEntry(
        review_id=rev_a1.id,
        student_id=student_a.id,
        round_id=round1.id,
        score=38.0,
        feedback=alice_feedback,
        is_released=True,
    ))
    db_session.add(ResultEntry(
        review_id=rev_a1.id,
        student_id=student_b.id,
        round_id=round1.id,
        score=28.5,
        feedback=bob_feedback,
        is_released=True,
    ))

    # Round 2 for Group Alpha:
    sub_a2 = Submission(project_id=project_alpha.id, round_id=round2.id)
    db_session.add(sub_a2)
    db_session.flush()
    sub_ver_a2 = SubmissionVersion(
        submission_id=sub_a2.id,
        version_number=1,
        submitted_by=student_a.id,
        status="APPROVED",
    )
    db_session.add(sub_ver_a2)
    db_session.flush()
    rev_a2 = Review(
        submission_version_id=sub_ver_a2.id,
        reviewer_id=staff.id,
        status="APPROVED",
        completed_at=datetime.now(timezone.utc) - timedelta(days=1),
    )
    db_session.add(rev_a2)
    db_session.flush()
    db_session.add(ResultEntry(
        review_id=rev_a2.id,
        student_id=student_a.id,
        round_id=round2.id,
        score=58.0,
        feedback="Flawless final benchmark and deployment setup.",
        is_released=True,
    ))
    db_session.add(ResultEntry(
        review_id=rev_a2.id,
        student_id=student_b.id,
        round_id=round2.id,
        score=52.0,
        feedback="Clean implementation.",
        is_released=True,
    ))

    # 10. Group Beta - Student Charlie:
    # Round 1: Charlie submitted, got an ACTUAL 0.0 score!
    sub_b1 = Submission(project_id=project_beta.id, round_id=round1.id)
    db_session.add(sub_b1)
    db_session.flush()
    sub_ver_b1 = SubmissionVersion(
        submission_id=sub_b1.id,
        version_number=1,
        submitted_by=student_c.id,
        status="APPROVED",
    )
    db_session.add(sub_ver_b1)
    db_session.flush()
    rev_b1 = Review(
        submission_version_id=sub_ver_b1.id,
        reviewer_id=staff.id,
        status="APPROVED",
        feedback="Empty submission repository provided.",
        completed_at=datetime.now(timezone.utc) - timedelta(days=2),
    )
    db_session.add(rev_b1)
    db_session.flush()
    db_session.add(ResultEntry(
        review_id=rev_b1.id,
        student_id=student_c.id,
        round_id=round1.id,
        score=0.0,
        feedback="Zero credit: empty repository and missing documentation.",
        is_released=True,
    ))
    # Round 2: Charlie has NO submission / not evaluated (MISSING mark).

    db_session.commit()

    return {
        "staff": staff,
        "staff_headers": auth_headers(staff_email),
        "other_staff": other_staff,
        "other_staff_headers": auth_headers(other_staff_email),
        "student_a": student_a,
        "student_a_headers": auth_headers(student_a_email),
        "student_b": student_b,
        "student_c": student_c,
        "workspace": ws,
        "round1": round1,
        "round2": round2,
        "group_alpha": group_alpha,
        "group_beta": group_beta,
        "project_alpha": project_alpha,
        "project_beta": project_beta,
    }

def test_individual_score_and_feedback_attribution(setup_results_env):
    """
    Verify that multiple students in the same group receive distinct individual scores
    and distinct teacher feedbacks without being conflated or shared at group level.
    """
    env = setup_results_env
    ws = env["workspace"]
    r1 = env["round1"]

    resp = client.get(
        f"/api/v1/results/workspace/{ws.id}",
        headers=env["staff_headers"],
    )
    assert resp.status_code == 200
    data = resp.json()

    students = data["students"]
    # Group Alpha has 2 students: Alice and Bob
    alice = next(s for s in students if s["student_id"] == env["student_a"].id)
    bob = next(s for s in students if s["student_id"] == env["student_b"].id)

    # Both share the same group and project topic
    assert alice["group_name"] == bob["group_name"] == "Alpha Devs"
    assert alice["project_topic"] == bob["project_topic"] == "Distributed Consensus Engine"

    # Distinct roll numbers
    assert alice["roll_number"] != bob["roll_number"]

    # Distinct Round 1 marks and individual feedback
    alice_r1 = alice["rounds"][str(r1.id)]
    bob_r1 = bob["rounds"][str(r1.id)]

    assert alice_r1["score"] == 38.0
    assert bob_r1["score"] == 28.5
    assert alice_r1["score"] != bob_r1["score"]

    assert "deadlocks" in alice_r1["feedback"]
    assert "partitioned networks" in bob_r1["feedback"]
    assert alice_r1["feedback"] != bob_r1["feedback"]

def test_variable_review_rounds_dynamic_generation(setup_results_env):
    """
    Verify that review rounds are dynamically generated from workspace configuration
    rather than hardcoded.
    """
    env = setup_results_env
    ws = env["workspace"]

    resp = client.get(
        f"/api/v1/results/workspace/{ws.id}",
        headers=env["staff_headers"],
    )
    assert resp.status_code == 200
    data = resp.json()

    rounds = data["rounds"]
    assert len(rounds) == 2
    assert rounds[0]["title"] == "Milestone 1: Design & Architecture"
    assert rounds[0]["max_score"] == 40.0
    assert rounds[1]["title"] == "Milestone 2: Final Implementation"
    assert rounds[1]["max_score"] == 60.0

def test_missing_marks_distinguished_from_actual_zero(setup_results_env):
    """
    Verify that an actual 0.0 grade is strictly distinguished from missing/unevaluated marks.
    """
    env = setup_results_env
    ws = env["workspace"]
    r1 = env["round1"]
    r2 = env["round2"]

    resp = client.get(
        f"/api/v1/results/workspace/{ws.id}",
        headers=env["staff_headers"],
    )
    assert resp.status_code == 200
    data = resp.json()

    charlie = next(s for s in data["students"] if s["student_id"] == env["student_c"].id)

    # Round 1 was graded with an actual 0.0
    charlie_r1 = charlie["rounds"][str(r1.id)]
    assert charlie_r1["score"] == 0.0
    assert charlie_r1["status"] == "GRADED"
    assert "Zero credit" in charlie_r1["feedback"]

    # Round 2 has NOT been graded (missing mark)
    charlie_r2 = charlie["rounds"][str(r2.id)]
    assert charlie_r2["score"] is None
    assert charlie_r2["status"] in ["NOT_SUBMITTED", "MISSING"]

def test_totals_percentages_and_completion_status(setup_results_env):
    """
    Verify calculation of individual total marks, maximum possible marks,
    percentages, completion statuses, and pass/fail verdicts.
    """
    env = setup_results_env
    ws = env["workspace"]

    resp = client.get(
        f"/api/v1/results/workspace/{ws.id}",
        headers=env["staff_headers"],
    )
    assert resp.status_code == 200
    data = resp.json()

    alice = next(s for s in data["students"] if s["student_id"] == env["student_a"].id)
    bob = next(s for s in data["students"] if s["student_id"] == env["student_b"].id)
    charlie = next(s for s in data["students"] if s["student_id"] == env["student_c"].id)

    # Alice: 38 + 58 = 96 / 100 = 96.0% -> COMPLETED, PASSED
    assert alice["total_marks"] == 96.0
    assert alice["max_marks"] == 100.0
    assert alice["percentage"] == 96.0
    assert alice["review_completion_status"] == "COMPLETED"
    assert alice["final_result_status"] == "PASSED"

    # Bob: 28.5 + 52.0 = 80.5 / 100 = 80.5% -> COMPLETED, PASSED
    assert bob["total_marks"] == 80.5
    assert bob["max_marks"] == 100.0
    assert bob["percentage"] == 80.5
    assert bob["review_completion_status"] == "COMPLETED"
    assert bob["final_result_status"] == "PASSED"

    # Charlie: 0 / 100 -> IN_PROGRESS, INCOMPLETE
    assert charlie["total_marks"] == 0.0
    assert charlie["max_marks"] == 100.0
    assert charlie["percentage"] == 0.0
    assert charlie["review_completion_status"] == "IN_PROGRESS"
    assert charlie["final_result_status"] == "INCOMPLETE"

    # Summary statistics
    summary = data["summary"]
    assert summary["total_students"] == 3
    assert summary["total_groups"] == 2
    assert summary["completed_students"] == 2

def test_csv_export_formatting_and_escaping(setup_results_env):
    """
    Verify /api/v1/results/workspace/{workspace_id}/export-csv generates an RFC 4180
    compliant UTF-8 CSV with BOM, descriptive filename, and proper escaping.
    """
    env = setup_results_env
    ws = env["workspace"]

    resp = client.get(
        f"/api/v1/results/workspace/{ws.id}/export-csv",
        headers=env["staff_headers"],
    )
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "attachment" in resp.headers["content-disposition"]
    assert ws.id in resp.headers["content-disposition"]

    # Verify UTF-8 BOM
    raw_content = resp.content
    assert raw_content.startswith(b"\xef\xbb\xbf")

    # Parse CSV content using Python standard csv module
    decoded_text = raw_content.decode("utf-8")
    # Strip BOM for reader
    cleaned_text = decoded_text.lstrip("\ufeff")
    reader = list(csv.reader(io.StringIO(cleaned_text)))

    header_row = reader[0]
    assert "Group Number" in header_row
    assert "Student Name" in header_row
    assert "Roll Number" in header_row
    assert "Milestone 1: Design & Architecture Marks" in header_row
    assert "Milestone 1: Design & Architecture Teacher Feedback" in header_row
    assert "Milestone 2: Final Implementation Marks" in header_row
    assert "Individual Total Marks" in header_row
    assert "Final Result Status" in header_row

    # 3 student data rows
    data_rows = reader[1:]
    assert len(data_rows) == 3

    # Find Alice's row
    alice_row = next(r for r in data_rows if env["student_a"].full_name in r[3])
    # Alice's Round 1 score = 38.00, Round 2 score = 58.00, Total = 96.00
    assert "38.00" in alice_row
    assert "58.00" in alice_row
    assert "96.00" in alice_row
    assert "PASSED" in alice_row

    # Find Charlie's row
    charlie_row = next(r for r in data_rows if env["student_c"].full_name in r[3])
    # Round 1 is graded 0.00
    r1_score_idx = header_row.index("Milestone 1: Design & Architecture Marks")
    r2_score_idx = header_row.index("Milestone 2: Final Implementation Marks")

    assert charlie_row[r1_score_idx] == "0.00"
    # Round 2 is MISSING, strictly an empty string, NOT "0.00"
    assert charlie_row[r2_score_idx] == ""

def test_workspace_isolation_and_unauthorized_access(setup_results_env):
    """
    Verify students cannot access results endpoint (403),
    and unassigned staff cannot access other workspaces (404).
    """
    env = setup_results_env
    ws = env["workspace"]

    # 1. Student blocked from results dashboard (403 Forbidden)
    stud_resp = client.get(
        f"/api/v1/results/workspace/{ws.id}",
        headers=env["student_a_headers"],
    )
    assert stud_resp.status_code == 403

    # 2. Student blocked from CSV export (403 Forbidden)
    stud_csv_resp = client.get(
        f"/api/v1/results/workspace/{ws.id}/export-csv",
        headers=env["student_a_headers"],
    )
    assert stud_csv_resp.status_code == 403

    # 3. Unassigned staff blocked with 404 (Workspace isolation)
    other_resp = client.get(
        f"/api/v1/results/workspace/{ws.id}",
        headers=env["other_staff_headers"],
    )
    assert other_resp.status_code == 404

    other_csv_resp = client.get(
        f"/api/v1/results/workspace/{ws.id}/export-csv",
        headers=env["other_staff_headers"],
    )
    assert other_csv_resp.status_code == 404
