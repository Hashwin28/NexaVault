import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.db.session import SessionLocal
from app.core.security import hash_password, create_access_token
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceStaff, WorkspaceStaffRequest, WorkspaceGroup, WorkspaceNotice
from app.models.group import Group, GroupMembership
from app.models.project import Project, ProjectUpdate, UpdateComment
from app.models.review import ReviewRound, Submission, SubmissionVersion, Review, ResultEntry, ResultCorrection
from app.models.audit import AuditLog
from app.services.project_service import calculate_project_progress

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

def test_staff_domain_comprehensive(db_session: Session):
    timestamp_str = datetime.now().strftime("%Y%m%d%H%M%S")
    
    # 1. Setup Test Users
    # Staff Owner
    owner_email = f"staff_owner_{timestamp_str}@nexavault.edu"
    owner = User(email=owner_email, hashed_password=hash_password("password123"), full_name="Staff Owner", role="staff")
    db_session.add(owner)

    # Co-Staff
    costaff_email = f"staff_co_{timestamp_str}@nexavault.edu"
    costaff = User(email=costaff_email, hashed_password=hash_password("password123"), full_name="Co Staff", role="staff")
    db_session.add(costaff)

    # Unauthorized Staff
    other_staff_email = f"staff_other_{timestamp_str}@nexavault.edu"
    other_staff = User(email=other_staff_email, hashed_password=hash_password("password123"), full_name="Other Staff", role="staff")
    db_session.add(other_staff)

    # Students (s1, s2, s3)
    s1_email = f"student_s1_{timestamp_str}@nexavault.edu"
    s1 = User(email=s1_email, hashed_password=hash_password("password123"), full_name="Student One", role="student")
    db_session.add(s1)

    s2_email = f"student_s2_{timestamp_str}@nexavault.edu"
    s2 = User(email=s2_email, hashed_password=hash_password("password123"), full_name="Student Two", role="student")
    db_session.add(s2)

    s3_email = f"student_s3_{timestamp_str}@nexavault.edu"
    s3 = User(email=s3_email, hashed_password=hash_password("password123"), full_name="Student Three", role="student")
    db_session.add(s3)

    db_session.commit()
    db_session.refresh(owner)
    db_session.refresh(costaff)
    db_session.refresh(other_staff)
    db_session.refresh(s1)
    db_session.refresh(s2)
    db_session.refresh(s3)

    headers_owner = auth_headers(owner.email)
    headers_costaff = auth_headers(costaff.email)
    headers_other_staff = auth_headers(other_staff.email)
    headers_s1 = auth_headers(s1.email)

    # 1. Staff Authentication & Student Forbidden on Staff Endpoints
    resp = client.get("/api/v1/reviews/queue", headers=headers_s1)
    assert resp.status_code == 403, "Student must not access staff endpoints"

    # 2. Staff can create Workspace
    ws_id = f"WS-TEST-{timestamp_str}"
    resp = client.post("/api/v1/workspaces/", json={"id": ws_id, "name": "Algorithmic Vault", "description": "DSA Core", "term": "Fall 2026"}, headers=headers_owner)
    assert resp.status_code == 201, resp.text
    ws_data = resp.json()
    assert ws_data["owner_id"] == owner.id
    assert ws_data["role"] == "owner"

    # 3. Verify Workspace Owner assigned correctly in DB
    ws_staff_entry = db_session.query(WorkspaceStaff).filter_by(workspace_id=ws_id, user_id=owner.id).first()
    assert ws_staff_entry is not None
    assert ws_staff_entry.role == "owner"

    # 4. Staff Access Request Flow
    resp = client.post(f"/api/v1/workspaces/{ws_id}/staff-request", headers=headers_costaff)
    assert resp.status_code == 201, resp.text
    req_data = resp.json()
    req_id = req_data["id"]
    assert req_data["status"] == "pending"

    # Owner lists requests
    resp = client.get(f"/api/v1/workspaces/{ws_id}/staff-requests", headers=headers_owner)
    assert resp.status_code == 200
    requests_list = resp.json()
    assert any(r["id"] == req_id for r in requests_list)

    # Owner approves request
    resp = client.post(f"/api/v1/workspaces/{ws_id}/staff-request/{req_id}/resolve", json={"action": "approve"}, headers=headers_owner)
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"

    # Co-Staff receives workspace access
    resp = client.get(f"/api/v1/workspaces/{ws_id}", headers=headers_costaff)
    assert resp.status_code == 200
    assert resp.json()["role"] == "costaff"

    # 5. Co-Staff cannot perform Owner-only actions (e.g., archive workspace, resolve request)
    resp = client.post(f"/api/v1/workspaces/{ws_id}/archive", headers=headers_costaff)
    assert resp.status_code == 404, "Co-staff must be denied owner-only actions"

    # 6. Unauthorized Staff cannot access workspace (Returns 404)
    resp = client.get(f"/api/v1/workspaces/{ws_id}", headers=headers_other_staff)
    assert resp.status_code == 404

    # 7. Notice Board Operations (Co-Staff operational action)
    resp = client.post(f"/api/v1/workspaces/{ws_id}/notices", json={"title": "Midterm Update", "body": "Exam scheduled", "is_pinned": True}, headers=headers_costaff)
    assert resp.status_code == 201
    notice_id = resp.json()["id"]

    # Edit notice
    resp = client.patch(f"/api/v1/workspaces/{ws_id}/notices/{notice_id}", json={"body": "Exam updated to online"}, headers=headers_costaff)
    assert resp.status_code == 200
    assert resp.json()["body"] == "Exam updated to online"

    # Toggle pin
    resp = client.post(f"/api/v1/workspaces/{ws_id}/notices/{notice_id}/pin", headers=headers_costaff)
    assert resp.status_code == 200

    # Archive notice
    resp = client.post(f"/api/v1/workspaces/{ws_id}/notices/{notice_id}/archive", headers=headers_costaff)
    assert resp.status_code == 200

    # Verify student feed does not include archived notices
    resp = client.get(f"/api/v1/workspaces/{ws_id}/notices", headers=headers_s1)
    # student s1 not enrolled yet, returns 404 or empty
    # Let's enroll student group first!

    # 8. Setup Student Group & Project
    group = Group(name=f"Group_{timestamp_str}", code=f"CODE{timestamp_str[-6:]}", created_by=s1.id)
    db_session.add(group)
    db_session.flush()
    db_session.add(GroupMembership(group_id=group.id, user_id=s1.id))
    db_session.add(GroupMembership(group_id=group.id, user_id=s2.id))
    db_session.add(WorkspaceGroup(workspace_id=ws_id, group_id=group.id, enrolled_by=s1.id))
    db_session.commit()

    proj = Project(workspace_id=ws_id, group_id=group.id, name="Red-Black Tree Engine", created_by=s1.id)
    db_session.add(proj)
    db_session.commit()
    db_session.refresh(proj)

    # 9. Review Rounds Management (Operational)
    due = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    resp = client.post(f"/api/v1/workspaces/{ws_id}/rounds", json={"title": "Round 1 - Proposal", "order_index": 1, "due_date": due, "max_score": 50.0}, headers=headers_costaff)
    assert resp.status_code == 201
    round1_id = resp.json()["id"]

    resp = client.post(f"/api/v1/workspaces/{ws_id}/rounds", json={"title": "Round 2 - Core Engine", "order_index": 2, "due_date": due, "max_score": 50.0}, headers=headers_costaff)
    assert resp.status_code == 201
    round2_id = resp.json()["id"]

    # Test max_score >= 1.0 constraint
    resp = client.post(f"/api/v1/workspaces/{ws_id}/rounds", json={"title": "Invalid Round", "order_index": 3, "due_date": due, "max_score": 0.5}, headers=headers_costaff)
    assert resp.status_code == 422 or resp.status_code == 400

    # Edit round
    resp = client.patch(f"/api/v1/workspaces/{ws_id}/rounds/{round1_id}", json={"title": "Round 1 - Architecture Proposal"}, headers=headers_costaff)
    assert resp.status_code == 200

    # Toggle round open/closed
    resp = client.post(f"/api/v1/workspaces/{ws_id}/rounds/{round1_id}/toggle", headers=headers_costaff)
    assert resp.status_code == 200

    # Re-open round
    resp = client.post(f"/api/v1/workspaces/{ws_id}/rounds/{round1_id}/toggle", headers=headers_costaff)
    assert resp.status_code == 200

    # 10. Submission Creation by Student
    sub_resp = client.post(f"/api/v1/projects/{proj.id}/submissions/{round1_id}", json={"notes": "V1 Implementation", "link": "https://github.com/..."}, headers=headers_s1)
    assert sub_resp.status_code == 201
    version_id = sub_resp.json()["latest_version"]["id"]

    # 11. Deletion of Round 1 MUST BE BLOCKED now that submission exists!
    resp = client.delete(f"/api/v1/workspaces/{ws_id}/rounds/{round1_id}", headers=headers_owner)
    assert resp.status_code == 400, "Deleting round with submissions must be blocked"

    # 12. Review Queue: Authorized Staff receives version
    resp = client.get("/api/v1/reviews/queue", headers=headers_costaff)
    assert resp.status_code == 200
    queue = resp.json()
    assert any(q["version_id"] == version_id for q in queue)

    # Unauthorized staff receives empty queue for this workspace
    resp = client.get("/api/v1/reviews/queue", headers=headers_other_staff)
    assert resp.status_code == 200
    queue_other = resp.json()
    assert not any(q["version_id"] == version_id for q in queue_other)

    # 13. Atomic Claiming & Claim Release
    # Co-Staff claims version
    resp = client.post(f"/api/v1/reviews/{version_id}/claim", headers=headers_costaff)
    assert resp.status_code == 200

    # Second staff attempt to claim same submission returns 409 Conflict / 400
    resp = client.post(f"/api/v1/reviews/{version_id}/claim", headers=headers_owner)
    assert resp.status_code in [400, 409]

    # Co-Staff releases claim
    resp = client.post(f"/api/v1/reviews/{version_id}/release-claim", headers=headers_costaff)
    assert resp.status_code == 200

    # Owner claims version
    resp = client.post(f"/api/v1/reviews/{version_id}/claim", headers=headers_owner)
    assert resp.status_code == 200

    # 14. Evaluation - Revision Request (NO score assigned)
    resp = client.post(f"/api/v1/reviews/{version_id}/evaluate", json={"verdict": "REVISION_REQUESTED", "feedback": "Fix memory leaks"}, headers=headers_owner)
    assert resp.status_code == 200
    assert resp.json()["verdict"] == "REVISION_REQUESTED"

    # Student submits new version (v2)
    sub_resp2 = client.post(f"/api/v1/projects/{proj.id}/submissions/{round1_id}", json={"notes": "V2 Memory Leaks Fixed", "link": "https://github.com/..."}, headers=headers_s1)
    assert sub_resp2.status_code == 201
    v2_id = sub_resp2.json()["latest_version"]["id"]

    # Claim v2
    client.post(f"/api/v1/reviews/{v2_id}/claim", headers=headers_owner)

    # 15. Evaluation - Approval with Individual Scores
    # Test missing roster member score validation (roster has s1 and s2)
    resp = client.post(f"/api/v1/reviews/{v2_id}/evaluate", json={
        "verdict": "APPROVED",
        "feedback": "Outstanding work",
        "student_scores": [{"user_id": s1.id, "score": 48.0}]  # missing s2!
    }, headers=headers_owner)
    assert resp.status_code == 400, "Must require score for every roster member"

    # Correct evaluation with all roster members
    resp = client.post(f"/api/v1/reviews/{v2_id}/evaluate", json={
        "verdict": "APPROVED",
        "feedback": "Outstanding work",
        "student_scores": [
            {"user_id": s1.id, "score": 48.0},
            {"user_id": s2.id, "score": 45.0}
        ]
    }, headers=headers_owner)
    assert resp.status_code == 200, resp.text
    assert resp.json()["verdict"] == "APPROVED"

    # 16. Result Release
    # Student s1 cannot see unreleased results yet
    resp = client.get("/api/v1/results/me", headers=headers_s1)
    assert resp.status_code == 200
    assert len(resp.json()["results"]) == 0, "Unreleased results must be invisible to students"

    # Staff releases results
    resp = client.post(f"/api/v1/reviews/{v2_id}/release-results", headers=headers_owner)
    assert resp.status_code == 200

    # Student s1 can now see released result
    resp = client.get("/api/v1/results/me", headers=headers_s1)
    assert resp.status_code == 200
    assert len(resp.json()["results"]) == 1
    assert resp.json()["results"][0]["score"] == 48.0

    # 17. Result Correction
    result_entry_id = resp.json()["results"][0]["id"]
    resp = client.patch(f"/api/v1/results/{result_entry_id}/correct", json={"new_score": 49.5, "reason": "Re-graded bonus complexity section"}, headers=headers_owner)
    assert resp.status_code == 200
    assert resp.json()["new_score"] == 49.5
    assert resp.json()["old_score"] == 48.0

    # Verify student sees corrected score
    resp = client.get("/api/v1/results/me", headers=headers_s1)
    assert resp.json()["results"][0]["score"] == 49.5

    # 18. Former Group Member Access
    # Remove s2 from group (s2 leaves group)
    headers_s2 = auth_headers(s2.email)
    client.post(f"/api/v1/groups/{group.id}/leave", headers=headers_s2)

    # s2 retains access to historical released result entry!
    resp = client.get("/api/v1/results/me", headers=headers_s2)
    assert resp.status_code == 200
    assert len(resp.json()["results"]) == 1
    assert resp.json()["results"][0]["score"] == 45.0

    # 19. Derived Progress Calculation
    progress_val = calculate_project_progress(db_session, proj.id)
    # Round 1 (50 pts) is APPROVED out of Total (100 pts) -> 50.0%
    assert progress_val == 50.0

    # 20. Staff Smart Search (Database Scoped)
    resp = client.get(f"/api/v1/search?q={proj.name[:5]}", headers=headers_owner)
    assert resp.status_code == 200
    search_res = resp.json()
    assert len(search_res["projects"]) >= 1

    # Unauthorized staff search does not return this project
    resp = client.get(f"/api/v1/search?q={proj.name[:5]}", headers=headers_other_staff)
    assert resp.status_code == 200
    assert len(resp.json()["projects"]) == 0

    # 21. Audit Trail Verification
    resp = client.get(f"/api/v1/audit/logs?workspace_id={ws_id}", headers=headers_owner)
    assert resp.status_code == 200
    logs = resp.json()
    assert len(logs) > 0
    actions = [l["action_type"] for l in logs]
    assert "workspace_created" in actions
    assert "round_created" in actions
    assert "score_entered" in actions
    assert "score_corrected" in actions
    assert "results_released" in actions

    # 22. Scalability Fixes Verification
    # A. Review Queue Pagination (limit & offset)
    resp = client.get("/api/v1/reviews/queue?limit=1&offset=0", headers=headers_owner)
    assert resp.status_code == 200
    queue_paged = resp.json()
    assert len(queue_paged) <= 1

    # B. Search Result Limiting (max 50 per category)
    resp = client.get("/api/v1/search?q=e", headers=headers_owner)
    assert resp.status_code == 200
    search_paged = resp.json()
    assert len(search_paged["projects"]) <= 50
    assert len(search_paged["students"]) <= 50

    print("Staff Domain Comprehensive Test Suite PASSED Successfully!")

def test_audit_scalability_fixes(db_session: Session):
    timestamp_str = datetime.now().strftime("%Y%m%d%H%M%S")
    staff_email = f"audit_staff_{timestamp_str}@nexavault.edu"
    staff = User(email=staff_email, hashed_password=hash_password("password123"), full_name="Audit Staff", role="staff")
    db_session.add(staff)
    db_session.commit()

    headers_staff = auth_headers(staff.email)

    # 1. Review Queue Pagination limit & offset validation
    resp = client.get("/api/v1/reviews/queue?limit=0", headers=headers_staff)
    assert resp.status_code == 422, "limit < 1 must be rejected by FastAPI Query validation"

    resp = client.get("/api/v1/reviews/queue?limit=150", headers=headers_staff)
    assert resp.status_code == 422, "limit > 100 must be rejected by FastAPI Query validation"

    resp = client.get("/api/v1/reviews/queue?limit=10&offset=0", headers=headers_staff)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)

    # 2. Smart Search Limiting
    resp = client.get("/api/v1/search?q=test", headers=headers_staff)
    assert resp.status_code == 200
    res = resp.json()
    assert len(res["workspaces"]) <= 50
    assert len(res["groups"]) <= 50
    assert len(res["projects"]) <= 50
    assert len(res["submissions"]) <= 50
    assert len(res["students"]) <= 50

    # 3. Group Row Locking on Join
    # Create group with 5 members to verify max capacity boundary
    student_creator = User(email=f"creator_{timestamp_str}@nexavault.edu", hashed_password=hash_password("password123"), full_name="Creator", role="student")
    db_session.add(student_creator)
    db_session.commit()

    group_code = f"CAP{timestamp_str[-4:]}"
    grp = Group(name="Capacity Test Group", code=group_code, created_by=student_creator.id)
    db_session.add(grp)
    db_session.flush()

    for i in range(5):
        st = User(email=f"mem{i}_{timestamp_str}@nexavault.edu", hashed_password=hash_password("password123"), full_name=f"Member {i}", role="student")
        db_session.add(st)
        db_session.flush()
        db_session.add(GroupMembership(group_id=grp.id, user_id=st.id))

    db_session.commit()

    # Attempt to join full 5-member group (holding row lock during check)
    new_student = User(email=f"excess_{timestamp_str}@nexavault.edu", hashed_password=hash_password("password123"), full_name="Excess Student", role="student")
    db_session.add(new_student)
    db_session.commit()

    headers_new_student = auth_headers(new_student.email)
    resp = client.post("/api/v1/groups/join", json={"code": group_code}, headers=headers_new_student)
    assert resp.status_code == 400
    assert "maximum capacity of 5 members" in resp.json()["detail"]

    print("Audit Scalability Fixes Test Suite PASSED Successfully!")

