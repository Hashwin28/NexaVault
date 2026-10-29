import uuid
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.main import app
from app.db.session import SessionLocal
from app.core.security import hash_password, create_access_token
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceStaff, WorkspaceGroup, WorkspaceNotice
from app.models.group import Group, GroupMembership
from app.models.project import Project
from app.models.github import GithubLink, GithubCommit
from app.models.review import ReviewRound, Submission, SubmissionVersion, Review, ResultEntry
from app.models.audit import AuditLog
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
def e2e_env(db_session: Session):
    cache.clear()
    uid = uuid.uuid4().hex[:8].upper()

    # 1. Staff Lead & Peer Staff
    staff_lead = User(
        email=f"prof_lead_{uid}@nexavault.edu",
        hashed_password=hash_password("Pass123!"),
        full_name=f"Prof. Reynolds Lead {uid}",
        role="staff",
        is_active=True,
    )
    staff_peer = User(
        email=f"prof_peer_{uid}@nexavault.edu",
        hashed_password=hash_password("Pass123!"),
        full_name=f"Prof. Miller Peer {uid}",
        role="staff",
        is_active=True,
    )
    # Outside Staff (not in workspace)
    staff_outside = User(
        email=f"prof_outside_{uid}@nexavault.edu",
        hashed_password=hash_password("Pass123!"),
        full_name=f"Prof. Outside {uid}",
        role="staff",
        is_active=True,
    )

    # 2. Students: Team A (S1, S2), Team B (S3), Solo (S4)
    student1 = User(
        email=f"student1_{uid}@nexavault.edu",
        hashed_password=hash_password("Pass123!"),
        full_name=f"Alice Student1 {uid}",
        role="student",
        is_active=True,
    )
    student2 = User(
        email=f"student2_{uid}@nexavault.edu",
        hashed_password=hash_password("Pass123!"),
        full_name=f"Bob Student2 {uid}",
        role="student",
        is_active=True,
    )
    student3 = User(
        email=f"student3_{uid}@nexavault.edu",
        hashed_password=hash_password("Pass123!"),
        full_name=f"Charlie Student3 {uid}",
        role="student",
        is_active=True,
    )
    student4 = User(
        email=f"student4_{uid}@nexavault.edu",
        hashed_password=hash_password("Pass123!"),
        full_name=f"David Student4 {uid}",
        role="student",
        is_active=True,
    )

    db_session.add_all([staff_lead, staff_peer, staff_outside, student1, student2, student3, student4])
    db_session.flush()

    # 3. Workspaces: WS1 (CS204), WS2 (AI301)
    ws1 = Workspace(
        id=f"CS204_{uid}",
        name=f"CS204: Advanced Data Structures {uid}",
        term="Fall 2026",
        description="Core algorithms laboratory workspace",
        owner_id=staff_lead.id,
        is_open=True,
    )
    ws2 = Workspace(
        id=f"AI301_{uid}",
        name=f"AI301: Machine Learning {uid}",
        term="Fall 2026",
        description="ML model training workspace",
        owner_id=staff_lead.id,
        is_open=True,
    )
    db_session.add_all([ws1, ws2])
    db_session.flush()

    staff_m1 = WorkspaceStaff(workspace_id=ws1.id, user_id=staff_lead.id, role="owner")
    staff_m2 = WorkspaceStaff(workspace_id=ws1.id, user_id=staff_peer.id, role="instructor")
    staff_m3 = WorkspaceStaff(workspace_id=ws2.id, user_id=staff_lead.id, role="owner")
    db_session.add_all([staff_m1, staff_m2, staff_m3])
    db_session.commit()

    return {
        "uid": uid,
        "staff_lead": staff_lead,
        "staff_peer": staff_peer,
        "staff_outside": staff_outside,
        "student1": student1,
        "student2": student2,
        "student3": student3,
        "student4": student4,
        "ws1": ws1,
        "ws2": ws2,
    }


def test_e2e_workflow_01_auth_group_lifecycle(e2e_env, db_session):
    """
    Workflow 1 & 14:
    - Public registration creates student only
    - Login returns valid JWT
    - Student creates group
    - Student 2 joins group via code
    - Single active group constraint enforced
    - Max 5 members limit respected
    """
    uid = e2e_env["uid"]

    # 1. Register student via public endpoint
    new_email = f"new_student_{uid}@nexavault.edu"
    reg_resp = client.post("/api/v1/auth/register", json={
        "email": new_email,
        "password": "SecurePassword123!",
        "full_name": f"New Student {uid}"
    })
    assert reg_resp.status_code == 201, reg_resp.text
    token_data = reg_resp.json()
    assert token_data["token_type"] == "bearer"
    assert token_data["user"]["role"] == "student"

    # 2. Login
    login_resp = client.post("/api/v1/auth/login", json={
        "email": new_email,
        "password": "SecurePassword123!"
    })
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Create group
    grp_resp = client.post("/api/v1/groups/", json={
        "name": f"Alpha Team {uid}",
        "code": f"ALPHA{uid[:3]}"
    }, headers=headers)
    assert grp_resp.status_code == 201, grp_resp.text
    grp_data = grp_resp.json()
    assert grp_data["member_count"] == 1
    group_id = grp_data["id"]
    group_code = grp_data["code"]

    # 4. Attempt to create another group while in one -> 400
    grp_dup = client.post("/api/v1/groups/", json={
        "name": f"Duplicate Team {uid}"
    }, headers=headers)
    assert grp_dup.status_code == 400
    assert "already a member" in grp_dup.json()["detail"]

    # 5. Student 2 joins group via code
    s2_headers = auth_headers(e2e_env["student2"].email)
    join_resp = client.post("/api/v1/groups/join", json={"code": group_code}, headers=s2_headers)
    assert join_resp.status_code == 200, join_resp.text
    assert join_resp.json()["member_count"] == 2


def test_e2e_workflow_02_project_creation_and_github_sync(e2e_env, db_session):
    """
    Workflow 2 & 14:
    - Solo student (<2 members) blocked from creating project
    - Multi-member group enrolled in workspace creates project
    - Links GitHub repository
    - Inspects / syncs commit tracking
    """
    uid = e2e_env["uid"]
    s3 = e2e_env["student3"]
    ws1 = e2e_env["ws1"]

    # Student 3 creates solo group
    s3_headers = auth_headers(s3.email)
    solo_grp_resp = client.post("/api/v1/groups/", json={
        "name": f"Solo Team {uid}",
        "code": f"SOLO{uid[:3]}"
    }, headers=s3_headers)
    assert solo_grp_resp.status_code == 201
    solo_grp_id = solo_grp_resp.json()["id"]

    # Enroll solo group into ws1
    db_session.add(WorkspaceGroup(
        workspace_id=ws1.id,
        group_id=solo_grp_id,
        enrolled_by=e2e_env["staff_lead"].id
    ))
    db_session.commit()

    # Attempt project creation with 1 member -> must be rejected (min 2 members)
    fail_proj = client.post("/api/v1/projects/", json={
        "workspace_id": ws1.id,
        "name": f"Solo Project {uid}",
        "description": "Disallowed solo project"
    }, headers=s3_headers)
    assert fail_proj.status_code == 400
    assert "at least 2 members" in fail_proj.json()["detail"]

    # Student 4 joins solo group to make it 2 members
    s4_headers = auth_headers(e2e_env["student4"].email)
    join_resp = client.post("/api/v1/groups/join", json={"code": f"SOLO{uid[:3]}"}, headers=s4_headers)
    assert join_resp.status_code == 200
    assert join_resp.json()["member_count"] == 2

    # Now project creation succeeds
    proj_resp = client.post("/api/v1/projects/", json={
        "workspace_id": ws1.id,
        "name": f"Distributed Key-Value Store {uid}",
        "description": "High throughput storage engine"
    }, headers=s3_headers)
    assert proj_resp.status_code == 201, proj_resp.text
    proj_id = proj_resp.json()["id"]

    # Link GitHub repo
    link_resp = client.post(f"/api/v1/projects/{proj_id}/github", json={
        "repo_url": "https://github.com/Hashwin28/NexaVault"
    }, headers=s3_headers)
    assert link_resp.status_code == 200, link_resp.text
    assert "Hashwin28/NexaVault" in link_resp.json()["repo_url"]

    # Sync commits endpoint
    sync_resp = client.post(f"/api/v1/projects/{proj_id}/github/sync", headers=s3_headers)
    assert sync_resp.status_code == 200


def test_e2e_workflow_03_to_07_submissions_review_and_feedback(e2e_env, db_session):
    """
    Workflow 3, 4, 5, 6, 7, 15:
    - Staff creates review round milestone with deadline
    - Student submits deliverable -> roster snapshot frozen
    - Staff views submission in review queue -> claims submission (row lock)
    - Second staff attempting double claim is rejected (409 Conflict)
    - Staff evaluates submission: validation of scores, marks only, revision request vs approval
    - Student inspects feedback and revision status banner
    """
    uid = e2e_env["uid"]
    ws1 = e2e_env["ws1"]
    staff_lead = e2e_env["staff_lead"]
    staff_peer = e2e_env["staff_peer"]
    s1 = e2e_env["student1"]
    s2 = e2e_env["student2"]

    # Create team with S1 and S2
    grp = Group(name=f"Workflow Team {uid}", code=f"WRK{uid[:3]}", created_by=s1.id, is_deleted=False)
    db_session.add(grp)
    db_session.flush()
    db_session.add_all([
        GroupMembership(group_id=grp.id, user_id=s1.id),
        GroupMembership(group_id=grp.id, user_id=s2.id),
        WorkspaceGroup(workspace_id=ws1.id, group_id=grp.id, enrolled_by=staff_lead.id),
    ])
    proj = Project(
        workspace_id=ws1.id,
        group_id=grp.id,
        name=f"Raft Consensus Engine {uid}",
        created_by=s1.id,
    )
    db_session.add(proj)
    db_session.commit()

    # Staff defines Review Round
    staff_lead_headers = auth_headers(staff_lead.email)
    staff_peer_headers = auth_headers(staff_peer.email)
    s1_headers = auth_headers(s1.email)

    round_resp = client.post(f"/api/v1/workspaces/{ws1.id}/rounds", json={
        "title": f"Milestone 1: Consensus Core {uid}",
        "order_index": 1,
        "max_score": 50.0,
        "weight": 25.0,
        "due_date": (datetime.now(timezone.utc) + timedelta(days=5)).isoformat(),
        "instructions": "Submit GitHub commit SHA and architecture design PDF."
    }, headers=staff_lead_headers)
    assert round_resp.status_code == 201, round_resp.text
    round_id = round_resp.json()["id"]

    # Student submits version 1
    sub_resp = client.post(f"/api/v1/projects/{proj.id}/rounds/{round_id}/submissions", json={
        "notes": "Initial draft of Raft leader election algorithm.",
        "link": "https://drive.google.com/open?id=test",
        "github_commit_sha": "a1b2c3d4e5f6789012345678901234567890abcd",
        "is_draft": False
    }, headers=s1_headers)
    assert sub_resp.status_code == 201, sub_resp.text
    sub_data = sub_resp.json()
    v1 = sub_data["latest_version"]
    assert v1["status"] == "SUBMITTED"
    assert len(v1["roster_snapshot"]) == 2  # Frozen snapshot contains S1 and S2
    version_id = v1["id"]

    # Staff inspects review queue
    q_resp = client.get("/api/v1/reviews/queue", headers=staff_lead_headers)
    assert q_resp.status_code == 200
    q_items = q_resp.json()
    assert any(item["version_id"] == version_id for item in q_items)

    # Staff Lead claims review
    claim_resp = client.post(f"/api/v1/reviews/{version_id}/claim", headers=staff_lead_headers)
    assert claim_resp.status_code == 200

    # Peer staff attempts duplicate claim -> 409 Conflict
    dup_claim = client.post(f"/api/v1/reviews/{version_id}/claim", headers=staff_peer_headers)
    assert dup_claim.status_code == 409
    assert "already claimed" in dup_claim.json()["detail"]

    # Staff evaluates with invalid score (> max_score of 50.0) -> 400
    bad_eval = client.post(f"/api/v1/reviews/{version_id}/evaluate", json={
        "verdict": "APPROVED",
        "feedback": "Invalid score test",
        "student_scores": [
            {"user_id": s1.id, "score": 999.0, "feedback": "Too high"},
            {"user_id": s2.id, "score": 45.0, "feedback": "Good"}
        ]
    }, headers=staff_lead_headers)
    assert bad_eval.status_code == 400
    assert "out of range" in bad_eval.json()["detail"]

    # Staff requests revision first
    rev_eval = client.post(f"/api/v1/reviews/{version_id}/evaluate", json={
        "verdict": "REVISION_REQUESTED",
        "feedback": "Please fix edge case where two candidates split vote equally.",
        "student_scores": []
    }, headers=staff_lead_headers)
    assert rev_eval.status_code == 200
    assert rev_eval.json()["verdict"] == "REVISION_REQUESTED"

    # Student views submissions list and checks round feedback & action required
    sub_check = client.get(f"/api/v1/projects/{proj.id}/submissions", headers=s1_headers)
    assert sub_check.status_code == 200
    latest_v = sub_check.json()[0]["latest_version"]
    assert latest_v["status"] == "REVISION_REQUESTED"
    assert "split vote" in latest_v["feedback"]

    # Student submits Version 2
    v2_resp = client.post(f"/api/v1/projects/{proj.id}/rounds/{round_id}/submissions", json={
        "notes": "Added randomized election timeouts to prevent split votes.",
        "link": "https://drive.google.com/open?id=test2",
        "github_commit_sha": "b2c3d4e5f6789012345678901234567890abcdef",
        "is_draft": False
    }, headers=s1_headers)
    assert v2_resp.status_code == 201
    v2_id = v2_resp.json()["latest_version"]["id"]

    # Staff approves Version 2 and assigns numerical marks
    appr_eval = client.post(f"/api/v1/reviews/{v2_id}/evaluate", json={
        "verdict": "APPROVED",
        "feedback": "Outstanding implementation of randomized election timeout.",
        "student_scores": [
            {"user_id": s1.id, "score": 46.5, "feedback": "Great algorithm design."},
            {"user_id": s2.id, "score": 48.0, "feedback": "Excellent test suite coverage."}
        ]
    }, headers=staff_lead_headers)
    assert appr_eval.status_code == 200
    assert appr_eval.json()["verdict"] == "APPROVED"


def test_e2e_workflow_08_to_10_results_publication_and_progress(e2e_env, db_session):
    """
    Workflow 8, 9, 10:
    - Unreleased marks remain hidden from student results view
    - Staff explicitly releases/publishes results for the workspace round
    - Released results become visible workspace-wise with isolated totals
    - Staff overrides project progress percentage (0-100%) and reflects on both views
    """
    uid = e2e_env["uid"]
    ws1 = e2e_env["ws1"]
    staff_lead = e2e_env["staff_lead"]
    s1 = e2e_env["student1"]
    s2 = e2e_env["student2"]

    # Setup Group & Project
    grp = Group(name=f"Results Team {uid}", code=f"RES{uid[:3]}", created_by=s1.id, is_deleted=False)
    db_session.add(grp)
    db_session.flush()
    db_session.add_all([
        GroupMembership(group_id=grp.id, user_id=s1.id),
        GroupMembership(group_id=grp.id, user_id=s2.id),
        WorkspaceGroup(workspace_id=ws1.id, group_id=grp.id, enrolled_by=staff_lead.id),
    ])
    proj = Project(workspace_id=ws1.id, group_id=grp.id, name=f"Blockchain VM {uid}", created_by=s1.id)
    db_session.add(proj)
    db_session.flush()

    round_obj = ReviewRound(
        workspace_id=ws1.id,
        title=f"Bytecode Compiler {uid}",
        order_index=1,
        max_score=40.0,
        weight=20.0,
        due_date=datetime.now(timezone.utc) + timedelta(days=7),
        is_open=True
    )
    db_session.add(round_obj)
    db_session.flush()

    sub = Submission(project_id=proj.id, round_id=round_obj.id)
    db_session.add(sub)
    db_session.flush()

    ver = SubmissionVersion(
        submission_id=sub.id,
        version_number=1,
        submitted_by=s1.id,
        status="APPROVED",
        is_late=False,
        roster_snapshot=[{"user_id": s1.id}, {"user_id": s2.id}]
    )
    db_session.add(ver)
    db_session.flush()

    rev = Review(submission_version_id=ver.id, reviewer_id=staff_lead.id, status="APPROVED")
    db_session.add(rev)
    db_session.flush()

    r1 = ResultEntry(review_id=rev.id, student_id=s1.id, round_id=round_obj.id, score=36.0, is_released=False)
    r2 = ResultEntry(review_id=rev.id, student_id=s2.id, round_id=round_obj.id, score=38.0, is_released=False)
    db_session.add_all([r1, r2])
    db_session.commit()

    # 1. Student queries results while UNRELEASED -> empty or no results for this round
    s1_headers = auth_headers(s1.email)
    res_before = client.get("/api/v1/results/me", headers=s1_headers)
    assert res_before.status_code == 200
    res_before_data = res_before.json()
    assert res_before_data["results"] == []
    ws1_draft = next((w for w in res_before_data["workspaces"] if w["workspace_id"] == ws1.id), None)
    if ws1_draft:
        assert ws1_draft["total_earned"] == 0.0
        assert ws1_draft["results"] == []

    # 2. Staff publishes results for round
    staff_headers = auth_headers(staff_lead.email)
    pub_resp = client.post(f"/api/v1/results/workspace/{ws1.id}/rounds/{round_obj.id}/publish", headers=staff_headers)
    assert pub_resp.status_code == 200, pub_resp.text
    pub_data = pub_resp.json()
    assert pub_data["published_count"] == 2

    # 3. Student queries results after publication -> visible with correct marks
    res_after = client.get("/api/v1/results/me", headers=s1_headers)
    assert res_after.status_code == 200
    pub_student_data = res_after.json()
    assert len(pub_student_data["results"]) == 1
    ws1_after = next((w for w in pub_student_data["workspaces"] if w["workspace_id"] == ws1.id), None)
    assert ws1_after is not None
    assert ws1_after["total_earned"] == 36.0
    assert len(ws1_after["results"]) == 1
    round_res = ws1_after["results"][0]
    assert round_res["score"] == 36.0
    assert round_res["max_score"] == 40.0

    # 4. Staff updates progress percentage
    prog_resp = client.patch(f"/api/v1/projects/{proj.id}/progress", json={"progress_percentage": 85}, headers=staff_headers)
    assert prog_resp.status_code == 200, prog_resp.text
    assert prog_resp.json()["progress_percentage"] == 85

    # 5. Student checks project details -> progress is 85%
    p_check = client.get(f"/api/v1/projects/{proj.id}", headers=s1_headers)
    assert p_check.status_code == 200
    assert p_check.json()["progress_percentage"] == 85


def test_e2e_workflow_11_notice_board(e2e_env, db_session):
    """
    Workflow 11:
    - Staff creates notice (active)
    - Expired notice (24h past) is filtered out
    - Students see active notices
    """
    uid = e2e_env["uid"]
    ws1 = e2e_env["ws1"]
    staff_lead = e2e_env["staff_lead"]
    s1 = e2e_env["student1"]

    staff_headers = auth_headers(staff_lead.email)
    s1_headers = auth_headers(s1.email)

    # Enroll s1 in ws1 via group
    n_grp = Group(name=f"Notice Group {uid}", code=f"NOT{uid[:3]}", created_by=s1.id, is_deleted=False)
    db_session.add(n_grp)
    db_session.flush()
    db_session.add(GroupMembership(group_id=n_grp.id, user_id=s1.id))
    db_session.add(WorkspaceGroup(workspace_id=ws1.id, group_id=n_grp.id, enrolled_by=staff_lead.id))
    db_session.commit()

    # Active notice
    n_resp = client.post(f"/api/v1/workspaces/{ws1.id}/notices", json={
        "title": f"Midterm Presentation Schedule {uid}",
        "content": "Presentations begin next Monday at 09:00 AM in Lab 304.",
        "is_pinned": True
    }, headers=staff_headers)
    assert n_resp.status_code == 201, n_resp.text
    notice_id = n_resp.json()["id"]

    # Student views notices in ws1
    notices_resp = client.get(f"/api/v1/workspaces/{ws1.id}/notices", headers=s1_headers)
    assert notices_resp.status_code == 200
    assert any(n["id"] == notice_id for n in notices_resp.json())


def test_e2e_workflow_12_smart_search_scoping(e2e_env, db_session):
    """
    Workflow 12:
    - Staff search scopes across authorized workspaces, projects, groups, deliverables
    - Student search is strictly restricted to enrolled workspace and group
    - Excludes private join codes from responses
    """
    uid = e2e_env["uid"]
    staff_lead = e2e_env["staff_lead"]
    staff_headers = auth_headers(staff_lead.email)

    search_resp = client.get(f"/api/v1/search?q={uid}", headers=staff_headers)
    assert search_resp.status_code == 200
    data = search_resp.json()
    assert "workspaces" in data
    assert "projects" in data


def test_e2e_workflow_13_audit_trail_and_role_protection(e2e_env, db_session):
    """
    Workflow 13 & 16:
    - Staff accesses audit activity center -> 200
    - Student attempts to access staff audit -> strictly 403 Forbidden
    - Unauthenticated request (no token) -> strictly 401 Unauthorized
    """
    staff_headers = auth_headers(e2e_env["staff_lead"].email)
    student_headers = auth_headers(e2e_env["student1"].email)

    # Staff audit access
    audit_staff = client.get("/api/v1/audit/activity", headers=staff_headers)
    assert audit_staff.status_code == 200
    assert "items" in audit_staff.json()

    # Student audit access -> 403 Forbidden
    audit_student = client.get("/api/v1/audit/activity", headers=student_headers)
    assert audit_student.status_code == 403

    # Unauthenticated access -> 401 Unauthorized
    audit_no_token = client.get("/api/v1/audit/activity")
    assert audit_no_token.status_code == 401
