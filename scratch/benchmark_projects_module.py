import os
import sys
import time
import uuid
from datetime import datetime, timezone, timedelta

# Ensure backend path
sys.path.insert(0, os.path.abspath("backend"))

from fastapi.testclient import TestClient
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

def create_benchmark_fixtures():
    db = SessionLocal()
    uid = uuid.uuid4().hex[:6]

    # Staff
    staff = User(
        email=f"prof_{uid}@test.edu",
        hashed_password=hash_password("Pass123!"),
        full_name=f"Prof Benchmark {uid}",
        role="staff",
        is_active=True,
    )
    db.add(staff)

    # Students (3 students)
    students = []
    for i in range(3):
        s = User(
            email=f"student_{i}_{uid}@test.edu",
            hashed_password=hash_password("Pass123!"),
            full_name=f"Student {i} {uid}",
            role="student",
            is_active=True,
        )
        db.add(s)
        students.append(s)

    db.flush()

    # Workspace
    ws = Workspace(
        id=f"WS-BENCH-{uid.upper()}",
        name=f"Benchmark Workspace {uid}",
        term="Fall 2026",
        owner_id=staff.id,
        is_open=True,
        is_archived=False,
    )
    db.add(ws)

    # Staff assignment
    ws_staff = WorkspaceStaff(workspace_id=ws.id, user_id=staff.id)
    db.add(ws_staff)

    # Group
    group = Group(
        name=f"Benchmark Group {uid}",
        code=f"BG-{uid.upper()}",
        created_by=students[0].id,
    )
    db.add(group)
    db.flush()

    for s in students:
        gm = GroupMembership(group_id=group.id, user_id=s.id)
        db.add(gm)

    # Enroll group
    enrollment = WorkspaceGroup(workspace_id=ws.id, group_id=group.id, enrolled_by=staff.id)
    db.add(enrollment)

    # Project
    proj = Project(
        workspace_id=ws.id,
        group_id=group.id,
        name=f"Distributed Key-Value Engine {uid}",
        description="High throughput LSM-Tree storage engine benchmark project.",
        created_by=students[0].id,
    )
    db.add(proj)
    db.flush()

    # GitHub Link
    gh_link = GithubLink(
        project_id=proj.id,
        repo_url="https://github.com/torvalds/linux",
        linked_by=students[0].id,
        last_synced_at=datetime.now(timezone.utc),
    )
    db.add(gh_link)
    db.flush()

    for i in range(10):
        c = GithubCommit(
            github_link_id=gh_link.id,
            commit_sha=f"{i:040x}",
            commit_message=f"Benchmark commit #{i}: optimized storage read path",
            author_name=f"Student {i % 3}",
            committed_at=datetime.now(timezone.utc) - timedelta(hours=i),
        )
        db.add(c)

    # 4 Review Rounds
    rounds = []
    for i, (title, score) in enumerate([("Proposal", 15.0), ("Architecture", 25.0), ("Implementation", 35.0), ("Final", 25.0)], 1):
        rr = ReviewRound(
            workspace_id=ws.id,
            title=title,
            order_index=i,
            due_date=datetime.now(timezone.utc) + timedelta(days=i * 7),
            max_score=score,
            weight=score,
            is_open=True,
        )
        db.add(rr)
        rounds.append(rr)
    db.flush()

    # Updates & Comments (5 updates, each with 3 comments)
    for u_idx in range(5):
        up = ProjectUpdate(
            project_id=proj.id,
            author_id=students[u_idx % len(students)].id,
            content=f"Sprint update #{u_idx}: completed write-ahead logging and concurrent memtable flushes.",
            link="https://github.com/torvalds/linux/commit/123",
        )
        db.add(up)
        db.flush()
        for c_idx in range(3):
            comm = UpdateComment(
                update_id=up.id,
                author_id=staff.id if c_idx == 0 else students[c_idx % len(students)].id,
                content=f"Comment {c_idx} on update {u_idx}: verified crash recovery guarantees.",
            )
            db.add(comm)

    # Submissions for Round 1 & Round 2
    sub1 = Submission(project_id=proj.id, round_id=rounds[0].id)
    db.add(sub1)
    db.flush()

    ver1 = SubmissionVersion(
        submission_id=sub1.id,
        version_number=1,
        submitted_by=students[0].id,
        status="APPROVED",
        notes="Formal design specification and interface definitions.",
        link="https://drive.google.com/benchmark-doc",
        github_commit_sha="0000000000000000000000000000000000000001",
        submitted_at=datetime.now(timezone.utc) - timedelta(days=5),
        roster_snapshot=[{"user_id": s.id, "full_name": s.full_name, "email": s.email} for s in students],
    )
    db.add(ver1)
    db.flush()

    rev1 = Review(
        submission_version_id=ver1.id,
        reviewer_id=staff.id,
        status="APPROVED",
        feedback="Excellent architecture document and clear interface contracts.",
        completed_at=datetime.now(timezone.utc) - timedelta(days=4),
    )
    db.add(rev1)
    db.flush()

    # ResultEntry for each student (released)
    for s in students:
        re = ResultEntry(
            review_id=rev1.id,
            student_id=s.id,
            round_id=rounds[0].id,
            score=14.5,
            feedback="Strong analysis.",
            is_released=True,
            released_at=datetime.now(timezone.utc) - timedelta(days=3),
        )
        db.add(re)

    # Round 2: SUBMITTED (in review, unreleased)
    sub2 = Submission(project_id=proj.id, round_id=rounds[1].id)
    db.add(sub2)
    db.flush()

    ver2 = SubmissionVersion(
        submission_id=sub2.id,
        version_number=1,
        submitted_by=students[1].id,
        status="SUBMITTED",
        notes="Architecture draft and benchmark test harness.",
        link="https://github.com/torvalds/linux/pull/1",
        submitted_at=datetime.now(timezone.utc) - timedelta(days=1),
        roster_snapshot=[{"user_id": s.id, "full_name": s.full_name, "email": s.email} for s in students],
    )
    db.add(ver2)

    student_email = students[0].email
    staff_email = staff.email
    proj_id = proj.id
    ws_id = ws.id

    db.commit()
    db.close()

    return {
        "staff_email": staff_email,
        "student_email": student_email,
        "workspace_id": ws_id,
        "project_id": proj_id,
    }

def time_request(method, url, headers=None, json=None):
    start = time.perf_counter()
    if method == "GET":
        resp = client.get(url, headers=headers)
    elif method == "POST":
        resp = client.post(url, headers=headers, json=json)
    duration_ms = (time.perf_counter() - start) * 1000.0
    return resp, duration_ms

def run_benchmark():
    fixtures = create_benchmark_fixtures()
    student_email = fixtures["student_email"]
    staff_email = fixtures["staff_email"]
    proj_id = fixtures["project_id"]
    ws_id = fixtures["workspace_id"]

    student_headers = {"Authorization": f"Bearer {create_access_token(student_email)}"}
    staff_headers = {"Authorization": f"Bearer {create_access_token(staff_email)}"}

    print("=" * 60)
    print("NEXAVAULT PROJECTS MODULE LATENCY AUDIT - BASELINE")
    print("=" * 60)
    print(f"Project ID: {proj_id}, Workspace ID: {ws_id}")
    print(f"Student: {student_email}, Staff: {staff_email}")
    print("-" * 60)

    # Clear cache to measure true cold cache
    cache.clear()

    # SECTION 1: Current Initial Page Load (Student)
    # When student navigates to ProjectsView:
    # 1. getMyWorkspaces: /api/v1/workspaces/
    # 2. getProject: /api/v1/projects/{proj.id}
    # 3. getRounds: /api/v1/workspaces/{ws.id}/rounds
    # 4. getUpdates: /api/v1/projects/{proj.id}/updates
    # 5. getSubmissions: /api/v1/projects/{proj.id}/submissions
    # 6. getGithub: /api/v1/projects/{proj.id}/github
    # 7. getMyResults: /api/v1/results/me

    print("\n--- 1. CURRENT UNOPTIMIZED INITIAL LOAD (COLD CACHE) ---")
    req_urls = [
        ("GET Workspaces", f"/api/v1/workspaces/"),
        ("GET Project Metadata", f"/api/v1/projects/{proj_id}"),
        ("GET Workspace Rounds", f"/api/v1/workspaces/{ws_id}/rounds"),
        ("GET Updates & Comments", f"/api/v1/projects/{proj_id}/updates"),
        ("GET Submissions", f"/api/v1/projects/{proj_id}/submissions"),
        ("GET GitHub Info", f"/api/v1/projects/{proj_id}/github"),
        ("GET Released Results", f"/api/v1/results/me"),
    ]

    total_cold_time = 0.0
    for label, url in req_urls:
        resp, dur = time_request("GET", url, headers=student_headers)
        assert resp.status_code == 200, f"{label} failed: {resp.text}"
        total_cold_time += dur
        print(f"  {label:<25}: {dur:6.2f} ms (Status: {resp.status_code})")

    print(f"TOTAL COLD LOAD TIME (Sequential sum): {total_cold_time:6.2f} ms")
    print(f"TOTAL API REQUESTS ON INITIAL LOAD   : {len(req_urls)} requests")
    print(f"Initial Cache Stats: {cache.stats()}")

    # WARM CACHE
    print("\n--- 2. CURRENT UNOPTIMIZED INITIAL LOAD (WARM CACHE) ---")
    total_warm_time = 0.0
    for label, url in req_urls:
        resp, dur = time_request("GET", url, headers=student_headers)
        assert resp.status_code == 200
        total_warm_time += dur
        print(f"  {label:<25}: {dur:6.2f} ms (Status: {resp.status_code})")
    print(f"TOTAL WARM LOAD TIME (Sequential sum): {total_warm_time:6.2f} ms")
    print(f"Warm Cache Stats: {cache.stats()}")

    # INDIVIDUAL SUBSECTION LATENCIES
    print("\n--- 3. SUBSECTION LATENCY BREAKDOWN (COLD vs WARM) ---")
    subsections = [
        ("Overview", f"/api/v1/projects/{proj_id}"),
        ("Updates & Comments", f"/api/v1/projects/{proj_id}/updates"),
        ("Submissions", f"/api/v1/projects/{proj_id}/submissions"),
        ("GitHub", f"/api/v1/projects/{proj_id}/github"),
        ("Progress (Metadata / Derived)", f"/api/v1/projects/{proj_id}"),
        ("Review (Submission Feedback)", f"/api/v1/projects/{proj_id}/submissions"),
        ("Results", f"/api/v1/results/me"),
    ]

    for name, endpoint in subsections:
        cache.clear()
        _, cold_ms = time_request("GET", endpoint, headers=student_headers)
        _, warm_ms = time_request("GET", endpoint, headers=student_headers)
        print(f"  {name:<30}: Cold = {cold_ms:6.2f} ms | Warm = {warm_ms:6.2f} ms")

    # STAFF ACCESS BENCHMARK
    print("\n--- 4. STAFF PROJECT ACCESS (COLD vs WARM) ---")
    cache.clear()
    _, staff_proj_cold = time_request("GET", f"/api/v1/projects/{proj_id}", headers=staff_headers)
    _, staff_proj_warm = time_request("GET", f"/api/v1/projects/{proj_id}", headers=staff_headers)
    _, staff_sub_cold = time_request("GET", f"/api/v1/projects/{proj_id}/submissions", headers=staff_headers)
    _, staff_sub_warm = time_request("GET", f"/api/v1/projects/{proj_id}/submissions", headers=staff_headers)
    print(f"  Staff Project Detail: Cold = {staff_proj_cold:6.2f} ms | Warm = {staff_proj_warm:6.2f} ms")
    print(f"  Staff Submissions   : Cold = {staff_sub_cold:6.2f} ms | Warm = {staff_sub_warm:6.2f} ms")
    print("=" * 60)

if __name__ == "__main__":
    run_benchmark()
