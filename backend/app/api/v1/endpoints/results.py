import io
import csv
from datetime import datetime, timezone
from typing import List, Tuple
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session, joinedload
from app.api.deps import get_db, get_current_student, get_current_staff
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceGroup
from app.models.group import Group, GroupMembership
from app.models.project import Project
from app.models.review import ResultEntry, ReviewRound, ResultCorrection, Submission, SubmissionVersion, Review
from app.schemas.result import (
    StudentResultResponse,
    StudentResultsSummary,
    StudentWorkspaceResultGroup,
    ResultCorrectionCreate,
    ResultCorrectionResponse,
    RoundColumnHeader,
    StudentRoundScoreDetail,
    WorkspaceStudentResultItem,
    WorkspaceResultsSummaryStats,
    WorkspaceResultsResponse,
    PublishRoundResultsResponse,
)
from app.core.permissions import can_correct_result, can_access_workspace
from app.services.audit_service import log_audit
from app.core.cache import cache, key_results_me, invalidate_results, invalidate_workspace

router = APIRouter()

# --- HELPER FOR WORKSPACE RESULTS COMPILATION ---

def build_workspace_results(
    db: Session,
    workspace_id: str,
    staff_id: int
) -> Tuple[Workspace, List[RoundColumnHeader], List[WorkspaceStudentResultItem], WorkspaceResultsSummaryStats]:
    """
    Assembles real, individual-level student grades, feedback, reviewer data, and review round
    metrics across all enrolled groups and projects in the workspace.
    Guarantees that individual student results are never conflated with group marks.
    """
    # 1. Authorization check
    if not can_access_workspace(db, staff_id, workspace_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied."
        )

    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found."
        )

    # 2. Configured review rounds
    rounds = (
        db.query(ReviewRound)
        .filter(ReviewRound.workspace_id == workspace_id)
        .order_by(ReviewRound.order_index.asc(), ReviewRound.id.asc())
        .all()
    )
    total_possible_max = sum(float(r.max_score) for r in rounds)

    # 3. Enrolled groups in workspace
    enrolled_groups = (
        db.query(WorkspaceGroup)
        .options(joinedload(WorkspaceGroup.group))
        .filter(WorkspaceGroup.workspace_id == workspace_id)
        .order_by(WorkspaceGroup.id.asc())
        .all()
    )
    group_ids = [eg.group_id for eg in enrolled_groups if eg.group and not eg.group.is_deleted]
    group_num_by_id = {gid: idx for idx, gid in enumerate(group_ids, 1)}

    # 4. Workspace projects
    projects = (
        db.query(Project)
        .filter(Project.workspace_id == workspace_id, Project.group_id.in_(group_ids))
        .all()
    )
    project_by_group = {p.group_id: p for p in projects}
    project_ids = [p.id for p in projects]

    # 5. Submissions and latest versions
    submissions = (
        db.query(Submission)
        .options(
            joinedload(Submission.versions)
            .joinedload(SubmissionVersion.review)
            .joinedload(Review.reviewer)
        )
        .filter(Submission.project_id.in_(project_ids))
        .all()
    )
    latest_version_by_proj_round = {}
    for sub in submissions:
        if sub.versions:
            latest_v = max(sub.versions, key=lambda v: v.version_number)
            latest_version_by_proj_round[(sub.project_id, sub.round_id)] = latest_v

    # 6. Result entries for workspace rounds
    round_ids = [r.id for r in rounds]
    result_entries = (
        db.query(ResultEntry)
        .options(joinedload(ResultEntry.review).joinedload(Review.reviewer))
        .filter(ResultEntry.round_id.in_(round_ids))
        .all()
    )
    result_entry_by_round_student = {(re.round_id, re.student_id): re for re in result_entries}
    entries_by_round = {}
    for re in result_entries:
        entries_by_round.setdefault(re.round_id, []).append(re)

    round_headers = []
    for r in rounds:
        r_entries = entries_by_round.get(r.id, [])
        graded_cnt = len([e for e in r_entries if e.score is not None])
        released_cnt = len([e for e in r_entries if e.score is not None and e.is_released])
        is_rel = (graded_cnt > 0 and released_cnt == graded_cnt)
        round_headers.append(
            RoundColumnHeader(
                id=r.id,
                title=r.title,
                order_index=r.order_index,
                max_score=float(r.max_score),
                is_open=r.is_open,
                weight=float(r.weight) if r.weight is not None else 20.0,
                is_released=is_rel,
                released_count=released_cnt,
                graded_count=graded_cnt,
                total_count=0,
            )
        )

    # 7. Group memberships & individual students
    memberships = (
        db.query(GroupMembership)
        .options(joinedload(GroupMembership.user), joinedload(GroupMembership.group))
        .filter(GroupMembership.group_id.in_(group_ids))
        .all()
    )
    # Order predictably by group sequence index then student full name
    memberships.sort(key=lambda m: (group_num_by_id.get(m.group_id, 9999), m.user.full_name if m.user else ""))

    students_list = []
    total_pct_sum = 0.0
    completed_count = 0
    passed_count = 0

    for m in memberships:
        user = m.user
        group = m.group
        if not user or not group:
            continue

        proj = project_by_group.get(group.id)
        project_topic = proj.name if proj else "No Project Initialized"
        project_id = proj.id if proj else None

        roll_num = user.roll_number or user.email.split("@")[0]

        student_round_results = {}
        graded_rounds_count = 0
        total_student_marks = 0.0

        for r in rounds:
            r_max = float(r.max_score)
            re = result_entry_by_round_student.get((r.id, user.id))
            latest_v = latest_version_by_proj_round.get((project_id, r.id)) if project_id else None

            if re and re.score is not None:
                score_val = float(re.score)
                total_student_marks += score_val
                graded_rounds_count += 1
                pct = round((score_val / r_max * 100.0), 2) if r_max > 0 else 0.0
                fb = re.feedback or (re.review.feedback if re.review else None) or (latest_v.review.feedback if (latest_v and latest_v.review) else None)
                reviewer = (re.review.reviewer.full_name if (re.review and re.review.reviewer) else None) or (latest_v.review.reviewer.full_name if (latest_v and latest_v.review and latest_v.review.reviewer) else None)
                rev_date = (re.review.completed_at if re.review else None) or re.created_at
                is_rel = bool(re.is_released)

                student_round_results[str(r.id)] = StudentRoundScoreDetail(
                    round_id=r.id,
                    round_title=r.title,
                    score=score_val,
                    max_score=r_max,
                    percentage=pct,
                    feedback=fb,
                    reviewer_id=re.review.reviewer_id if re.review else None,
                    reviewer_name=reviewer,
                    review_date=rev_date,
                    status="GRADED",
                    is_released=is_rel,
                    released_at=re.released_at,
                    result_entry_id=re.id,
                )
            elif re:
                fb = re.feedback or (re.review.feedback if re.review else None) or (latest_v.review.feedback if (latest_v and latest_v.review) else None)
                reviewer = (re.review.reviewer.full_name if (re.review and re.review.reviewer) else None) or (latest_v.review.reviewer.full_name if (latest_v and latest_v.review and latest_v.review.reviewer) else None)
                rev_date = (re.review.completed_at if re.review else None) or re.created_at
                is_rel = bool(re.is_released)

                student_round_results[str(r.id)] = StudentRoundScoreDetail(
                    round_id=r.id,
                    round_title=r.title,
                    score=None,
                    max_score=r_max,
                    percentage=None,
                    feedback=fb,
                    reviewer_id=re.review.reviewer_id if re.review else None,
                    reviewer_name=reviewer,
                    review_date=rev_date,
                    status="PENDING",
                    is_released=is_rel,
                    released_at=re.released_at,
                    result_entry_id=re.id,
                )
            elif latest_v:
                rev = latest_v.review
                rev_status = rev.status if rev else latest_v.status
                fb = rev.feedback if rev else None
                reviewer = rev.reviewer.full_name if (rev and rev.reviewer) else None
                rev_date = rev.completed_at if rev else None

                student_round_results[str(r.id)] = StudentRoundScoreDetail(
                    round_id=r.id,
                    round_title=r.title,
                    score=None,
                    max_score=r_max,
                    percentage=None,
                    feedback=fb,
                    reviewer_id=rev.reviewer_id if rev else None,
                    reviewer_name=reviewer,
                    review_date=rev_date,
                    status=rev_status or "SUBMITTED",
                    is_released=False,
                    released_at=None,
                    result_entry_id=None,
                )
            else:
                now_utc = datetime.now(timezone.utc)
                is_past_due = bool(r.due_date and r.due_date < now_utc)
                missing_status = "MISSING" if (is_past_due or not r.is_open) else "NOT_SUBMITTED"

                student_round_results[str(r.id)] = StudentRoundScoreDetail(
                    round_id=r.id,
                    round_title=r.title,
                    score=None,
                    max_score=r_max,
                    percentage=None,
                    feedback=None,
                    reviewer_id=None,
                    reviewer_name=None,
                    review_date=None,
                    status=missing_status,
                    is_released=False,
                    released_at=None,
                    result_entry_id=None,
                )

        # Review Completion Status
        total_rounds_num = len(rounds)
        if total_rounds_num > 0 and graded_rounds_count == total_rounds_num:
            completion_status = "COMPLETED"
            completed_count += 1
        elif graded_rounds_count > 0:
            completion_status = "IN_PROGRESS"
        else:
            completion_status = "PENDING"

        student_pct = round((total_student_marks / total_possible_max * 100.0), 2) if total_possible_max > 0 else 0.0
        total_pct_sum += student_pct

        # Final Result Status
        if completion_status == "COMPLETED":
            if student_pct >= 60.0:
                final_status = "PASS"
                passed_count += 1
            else:
                final_status = "FAIL"
        else:
            final_status = "INCOMPLETE" if graded_rounds_count > 0 else "PENDING"

        students_list.append(
            WorkspaceStudentResultItem(
                student_id=user.id,
                student_name=user.full_name,
                student_email=user.email,
                roll_number=roll_num,
                group_id=group.id,
                group_number=group_num_by_id.get(group.id, 1),
                group_name=group.name,
                group_code=group.code,
                project_id=project_id,
                project_topic=project_topic,
                rounds=student_round_results,
                total_marks=round(total_student_marks, 2),
                max_marks=round(total_possible_max, 2),
                percentage=student_pct,
                review_completion_status=completion_status,
                final_result_status=final_status,
            )
        )

    total_students = len(students_list)
    total_groups = len(group_ids)
    avg_pct = round(total_pct_sum / total_students, 2) if total_students > 0 else 0.0
    pass_rate = round(passed_count / completed_count * 100.0, 2) if completed_count > 0 else (round(passed_count / total_students * 100.0, 2) if total_students > 0 else 0.0)

    summary = WorkspaceResultsSummaryStats(
        total_students=total_students,
        total_groups=total_groups,
        completed_students=completed_count,
        average_percentage=avg_pct,
        pass_rate=pass_rate,
    )

    for rh in round_headers:
        rh.total_count = total_students

    return ws, round_headers, students_list, summary


# --- WORKSPACE RESULTS DASHBOARD & CSV ENDPOINTS ---

@router.get("/workspace/{workspace_id}", response_model=WorkspaceResultsResponse)
def get_workspace_results_dashboard(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
):
    """
    Dedicated results endpoint for staff to view all groups and individual student marks
    across all dynamically configured review rounds for a managed workspace.
    """
    ws, rounds, students, summary = build_workspace_results(db, workspace_id, current_staff.id)

    return WorkspaceResultsResponse(
        workspace_id=ws.id,
        workspace_name=ws.name,
        rounds=rounds,
        students=students,
        summary=summary,
    )

@router.get("/workspace/{workspace_id}/export-csv")
def export_workspace_results_csv(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
):
    """
    Downloads a single, workspace-wide UTF-8 CSV containing individual student marks,
    feedback, reviewer names, review dates, and overall completion/grading totals.
    - Missing marks are strictly empty strings, distinguished from 0.0 marks.
    - Properly escapes commas, quotes, and multiline text.
    - Includes UTF-8 BOM for universal spreadsheet compatibility.
    """
    ws, rounds, students, summary = build_workspace_results(db, workspace_id, current_staff.id)

    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL, lineterminator="\r\n")

    # CSV Header Row
    headers = [
        "Group Number",
        "Group Name",
        "Project Topic",
        "Student Name",
        "Roll Number",
    ]
    for idx, r in enumerate(rounds, 1):
        headers.extend([
            f"Review Round {idx} Marks",
            f"Review Round {idx} Feedback",
            f"Review Round {idx} Reviewer",
            f"Review Round {idx} Date",
        ])
    headers.extend([
        "Individual Total Marks",
        "Maximum Possible Marks",
        "Percentage",
        "Review Completion Status",
        "Final Result Status",
    ])
    writer.writerow(headers)

    # Student Data Rows (One row per student)
    # Group rows so that the group metadata appears on the first student of the group,
    # grouping the group as one whole (matching reference layout).
    seen_groups = set()
    for s in students:
        is_first_in_group = s.group_id not in seen_groups
        seen_groups.add(s.group_id)

        group_num_val = str(s.group_number or s.group_id)

        if is_first_in_group:
            row = [
                group_num_val,
                s.group_name,
                s.project_topic,
                s.student_name,
                s.roll_number,
            ]
        else:
            row = [
                "",
                "",
                "",
                s.student_name,
                s.roll_number,
            ]
        has_any_score = False
        for r in rounds:
            r_res = s.rounds.get(str(r.id))
            if r_res and r_res.score is not None:
                row.append(f"{r_res.score:.2f}")
                has_any_score = True
            else:
                row.append("")  # Strictly empty string for missing marks

            row.append(r_res.feedback or "" if r_res else "")
            row.append(r_res.reviewer_name or "" if r_res else "")

            if r_res and r_res.review_date:
                rev_d_str = r_res.review_date.strftime("%Y-%m-%d")
            else:
                rev_d_str = ""
            row.append(rev_d_str)

        if not has_any_score and s.review_completion_status == "PENDING":
            row.extend([
                "",
                f"{s.max_marks:.2f}",
                "",
                "PENDING",
                "PENDING",
            ])
        else:
            row.extend([
                f"{s.total_marks:.2f}",
                f"{s.max_marks:.2f}",
                f"{s.percentage:.1f}%",
                s.review_completion_status,
                s.final_result_status,
            ])
        writer.writerow(row)

    # Prepend UTF-8 BOM for Excel / universal spreadsheet compatibility
    csv_bytes = ("\ufeff" + output.getvalue()).encode("utf-8")
    export_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    clean_ws_id = ws.id.replace("/", "_").replace("\\", "_")
    filename = f"NexaVault_Results_{clean_ws_id}_{export_date}.csv"

    # Log export in audit trail
    log_audit(
        db=db,
        actor_id=current_staff.id,
        action_type="results_exported_csv",
        category="ASSESSMENT",
        status="SUCCESS",
        entity_type="workspace",
        entity_id=None,
        workspace_id=ws.id,
        resource_name=f"Workspace Results CSV ({filename})",
        description=f"Staff exported workspace results CSV containing {len(students)} student rows",
        details=f"Exported {len(students)} student records for workspace {ws.id}",
    )
    db.commit()

    return Response(
        content=csv_bytes,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


# --- EXISTING STUDENT & CORRECTION ENDPOINTS ---

@router.get("/me", response_model=StudentResultsSummary)
def get_my_released_results(
    db: Session = Depends(get_db),
    current_student: User = Depends(get_current_student)
):
    """
    Returns the student's individual released results across all past and present rounds.
    - Strictly filters `is_released == True`.
    - Unreleased marks and peer student scores are NEVER exposed.
    - Former group members retain access to their own historical released scores.
    """
    c_key = key_results_me(current_student.id)
    cached = cache.get(c_key)
    if cached is not None:
        return StudentResultsSummary(**cached)

    # 1. Discover all workspaces and projects the student is enrolled in
    memberships = db.query(GroupMembership).filter(GroupMembership.user_id == current_student.id).all()
    group_ids = [m.group_id for m in memberships]

    enrolled_wsg = (
        db.query(WorkspaceGroup)
        .options(joinedload(WorkspaceGroup.workspace))
        .filter(WorkspaceGroup.group_id.in_(group_ids))
        .all()
    ) if group_ids else []

    projects = (
        db.query(Project)
        .filter(Project.group_id.in_(group_ids))
        .all()
    ) if group_ids else []
    proj_by_ws = {p.workspace_id: p for p in projects}

    ws_map = {}
    for wg in enrolled_wsg:
        ws = wg.workspace
        if not ws:
            continue
        p = proj_by_ws.get(ws.id)
        ws_map[ws.id] = {
            "workspace_id": ws.id,
            "workspace_name": ws.name,
            "workspace_term": ws.term,
            "project_id": p.id if p else None,
            "project_name": p.name if p else None,
            "results": [],
        }

    # 2. Query authorized released results for current student
    released_entries = (
        db.query(ResultEntry)
        .options(
            joinedload(ResultEntry.round).joinedload(ReviewRound.workspace),
            joinedload(ResultEntry.review).joinedload(Review.reviewer),
            joinedload(ResultEntry.review).joinedload(Review.submission_version).joinedload(SubmissionVersion.submission).joinedload(Submission.project),
        )
        .join(ReviewRound, ResultEntry.round_id == ReviewRound.id)
        .filter(ResultEntry.student_id == current_student.id, ResultEntry.is_released == True)
        .order_by(ReviewRound.order_index.asc(), ResultEntry.released_at.asc())
        .all()
    )

    results_list = []
    total_earned = 0.0
    total_possible = 0.0

    for entry in released_entries:
        round_obj = entry.round
        score_val = float(entry.score)
        max_val = float(round_obj.max_score) if round_obj else 100.0
        pct = (score_val / max_val * 100.0) if max_val > 0 else 0.0

        total_earned += score_val
        total_possible += max_val

        ws = round_obj.workspace if round_obj else None
        ws_id = ws.id if ws else "UNKNOWN"
        ws_name = ws.name if ws else "Workspace"
        fb = entry.feedback or (entry.review.feedback if entry.review else None)
        rev_name = entry.review.reviewer.full_name if (entry.review and entry.review.reviewer) else None

        proj = None
        if entry.review and entry.review.submission_version and entry.review.submission_version.submission:
            proj = entry.review.submission_version.submission.project
        if not proj and ws_id in proj_by_ws:
            proj = proj_by_ws[ws_id]

        if ws_id not in ws_map:
            ws_map[ws_id] = {
                "workspace_id": ws_id,
                "workspace_name": ws_name,
                "workspace_term": ws.term if ws else None,
                "project_id": proj.id if proj else None,
                "project_name": proj.name if proj else None,
                "results": [],
            }

        res_item = StudentResultResponse(
            id=entry.id,
            round_id=entry.round_id,
            round_title=round_obj.title if round_obj else f"Round #{entry.round_id}",
            round_order=round_obj.order_index if round_obj else 1,
            workspace_id=ws_id,
            workspace_name=ws_name,
            project_id=proj.id if proj else None,
            project_name=proj.name if proj else None,
            score=score_val,
            max_score=max_val,
            percentage=round(pct, 2),
            feedback=fb,
            status="PUBLISHED",
            reviewer_name=rev_name,
            released_at=entry.released_at,
        )

        results_list.append(res_item)
        ws_map[ws_id]["results"].append(res_item)

    # 3. Assemble workspace result groups
    workspace_groups = []
    for wid, wdata in ws_map.items():
        w_results = wdata["results"]
        w_earned = sum(r.score for r in w_results)
        w_possible = sum(r.max_score for r in w_results)
        w_pct = (w_earned / w_possible * 100.0) if w_possible > 0 else 0.0
        workspace_groups.append(
            StudentWorkspaceResultGroup(
                workspace_id=wdata["workspace_id"],
                workspace_name=wdata["workspace_name"],
                workspace_term=wdata["workspace_term"],
                project_id=wdata["project_id"],
                project_name=wdata["project_name"],
                total_earned=round(w_earned, 2),
                total_possible=round(w_possible, 2),
                percentage=round(w_pct, 2),
                published_rounds_count=len(w_results),
                results=w_results,
            )
        )

    workspace_groups.sort(key=lambda wg: wg.workspace_name)

    cumulative_pct = (total_earned / total_possible * 100.0) if total_possible > 0 else 0.0

    summary = StudentResultsSummary(
        total_earned=round(total_earned, 2),
        total_possible=round(total_possible, 2),
        cumulative_percentage=round(cumulative_pct, 2),
        results=results_list,
        workspaces=workspace_groups,
    )
    cache.set(c_key, summary.model_dump(), ttl=60, tags=[f"user:{current_student.id}:results", f"results:{current_student.id}"])
    return summary

@router.patch("/{entry_id}/correct", response_model=ResultCorrectionResponse)
def correct_result_score(
    entry_id: int,
    payload: ResultCorrectionCreate,
    db: Session = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
):
    """
    Staff corrects an already-approved score.
    Old score, new score, and reason are recorded in the audit log and ResultCorrection table.
    """
    if not can_correct_result(db, current_staff.id, entry_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Result entry not found or access denied."
        )

    entry = db.query(ResultEntry).filter(ResultEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Result entry not found.")

    round_obj = entry.round
    max_score = float(round_obj.max_score) if round_obj else 100.0

    if payload.new_score < 0 or payload.new_score > max_score:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"New score {payload.new_score} is out of valid range (0 <= score <= {max_score})."
        )

    old_score_val = float(entry.score)

    correction = ResultCorrection(
        result_entry_id=entry.id,
        corrected_by_id=current_staff.id,
        old_score=old_score_val,
        new_score=payload.new_score,
        reason=payload.reason,
    )
    db.add(correction)

    entry.score = payload.new_score

    ws_id = round_obj.workspace_id if round_obj else None

    log_audit(
        db=db,
        actor_id=current_staff.id,
        action_type="score_corrected",
        category="ASSESSMENT",
        status="SUCCESS",
        entity_type="result_entry",
        entity_id=entry.id,
        workspace_id=ws_id,
        old_value={"score": old_score_val},
        new_value={"score": payload.new_score, "reason": payload.reason},
    )

    db.commit()
    db.refresh(correction)
    invalidate_results(entry.student_id)
    cache.invalidate_prefix("project:progress:")

    return ResultCorrectionResponse(
        id=correction.id,
        result_entry_id=correction.result_entry_id,
        corrected_by_id=correction.corrected_by_id,
        corrected_by_name=current_staff.full_name,
        old_score=float(correction.old_score),
        new_score=float(correction.new_score),
        reason=correction.reason,
        created_at=correction.created_at,
    )


# --- STAFF RESULTS PUBLICATION / RELEASE WORKFLOW ---

@router.post("/workspace/{workspace_id}/rounds/{round_id}/publish", response_model=PublishRoundResultsResponse)
def publish_round_results(
    workspace_id: str,
    round_id: int,
    db: Session = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
):
    """
    Staff explicitly publishes/releases results for all evaluated submissions in a review round.
    Validates grades, sets is_released = True transactionally, logs audit trail, and invalidates caches.
    Safe and idempotent for repeated calls.
    """
    if not can_access_workspace(db, current_staff.id, workspace_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied."
        )

    round_obj = (
        db.query(ReviewRound)
        .filter(ReviewRound.id == round_id, ReviewRound.workspace_id == workspace_id)
        .first()
    )
    if not round_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Review round #{round_id} not found in workspace {workspace_id}."
        )

    max_score = float(round_obj.max_score)

    # Fetch all result entries for this round
    entries = db.query(ResultEntry).filter(ResultEntry.round_id == round_id).all()
    if not entries:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No evaluated grades exist for this review round yet. Evaluate submissions before publishing."
        )

    # Validate that none of the scores are invalid or incomplete
    for entry in entries:
        if entry.score is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Incomplete grading detected: Student #{entry.student_id} has a null score."
            )
        score_val = float(entry.score)
        if score_val < 0 or score_val > max_score:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid score {score_val} detected for student #{entry.student_id}. Score must be between 0 and {max_score}."
            )

    unreleased = [e for e in entries if not e.is_released]
    now = datetime.now(timezone.utc)

    for entry in unreleased:
        entry.is_released = True
        entry.released_at = now

    # Audit logging
    log_audit(
        db=db,
        actor_id=current_staff.id,
        action_type="results_published",
        category="ASSESSMENT",
        status="SUCCESS",
        entity_type="review_round",
        entity_id=round_obj.id,
        workspace_id=workspace_id,
        resource_name=f"Round Results: {round_obj.title}",
        description=f"Staff {current_staff.full_name} published {len(entries)} grades for round '{round_obj.title}'",
        details=f"Released {len(unreleased)} newly published results out of {len(entries)} total grades.",
    )

    db.commit()

    # Invalidate relevant caches
    invalidate_results()
    invalidate_workspace(workspace_id)
    cache.invalidate_prefix("project:progress:")

    already_published = len(unreleased) == 0
    msg = (
        f"All {len(entries)} results for round '{round_obj.title}' are already published."
        if already_published
        else f"Successfully published {len(unreleased)} results for round '{round_obj.title}'."
    )

    return PublishRoundResultsResponse(
        workspace_id=workspace_id,
        round_id=round_obj.id,
        round_title=round_obj.title,
        published_count=len(entries),
        already_published=already_published,
        message=msg,
    )


@router.post("/workspace/{workspace_id}/publish", response_model=PublishRoundResultsResponse)
def publish_all_workspace_results(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
):
    """
    Staff publishes/releases all evaluated grades across all review rounds for a workspace.
    Safe and idempotent for repeated calls.
    """
    if not can_access_workspace(db, current_staff.id, workspace_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied."
        )

    rounds = db.query(ReviewRound).filter(ReviewRound.workspace_id == workspace_id).all()
    if not rounds:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No review rounds found in workspace."
        )

    round_ids = [r.id for r in rounds]
    entries = db.query(ResultEntry).filter(ResultEntry.round_id.in_(round_ids)).all()
    if not entries:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No evaluated grades exist in this workspace to publish."
        )

    round_map = {r.id: r for r in rounds}
    for entry in entries:
        r_obj = round_map.get(entry.round_id)
        max_s = float(r_obj.max_score) if r_obj else 100.0
        if entry.score is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Incomplete grading detected: Student #{entry.student_id} has null score."
            )
        s_val = float(entry.score)
        if s_val < 0 or s_val > max_s:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid score {s_val} for student #{entry.student_id} (max {max_s})."
            )

    unreleased = [e for e in entries if not e.is_released]
    now = datetime.now(timezone.utc)
    for entry in unreleased:
        entry.is_released = True
        entry.released_at = now

    log_audit(
        db=db,
        actor_id=current_staff.id,
        action_type="results_published",
        category="ASSESSMENT",
        status="SUCCESS",
        entity_type="workspace",
        entity_id=None,
        workspace_id=workspace_id,
        resource_name=f"Workspace Results: {workspace_id}",
        description=f"Staff {current_staff.full_name} published all results ({len(entries)} entries) for workspace",
        details=f"Released {len(unreleased)} newly published results out of {len(entries)} total.",
    )

    db.commit()

    invalidate_results()
    invalidate_workspace(workspace_id)
    cache.invalidate_prefix("project:progress:")

    already_published = len(unreleased) == 0
    msg = (
        f"All {len(entries)} workspace results are already published."
        if already_published
        else f"Successfully published {len(unreleased)} results across {len(rounds)} rounds."
    )

    return PublishRoundResultsResponse(
        workspace_id=workspace_id,
        round_id=None,
        round_title="All Rounds",
        published_count=len(entries),
        already_published=already_published,
        message=msg,
    )
