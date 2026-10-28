from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.models.review import ReviewRound, Submission, SubmissionVersion
from app.models.project import Project
from app.core.cache import cache, key_project_progress

def get_project_progress_details(db: Session, project_id: int) -> Dict[str, Any]:
    """
    Returns full derived progress details including approved marks, total possible marks,
    calculated percentage, and breakdown of approved rounds.
    """
    c_key = key_project_progress(project_id)
    cached_val = cache.get(c_key)
    if isinstance(cached_val, dict):
        return cached_val

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        empty = {
            "project_id": project_id,
            "workspace_id": "",
            "approved_marks": 0.0,
            "total_round_marks": 0.0,
            "progress_percentage": 0.0,
            "approved_rounds": [],
        }
        return empty

    workspace_rounds = (
        db.query(ReviewRound)
        .filter(ReviewRound.workspace_id == project.workspace_id)
        .order_by(ReviewRound.order_index.asc())
        .all()
    )
    if not workspace_rounds:
        empty = {
            "project_id": project_id,
            "workspace_id": project.workspace_id,
            "approved_marks": 0.0,
            "total_round_marks": 0.0,
            "progress_percentage": 0.0,
            "approved_rounds": [],
        }
        return empty

    total_possible = sum(float(r.max_score) for r in workspace_rounds)
    if total_possible <= 0:
        empty = {
            "project_id": project_id,
            "workspace_id": project.workspace_id,
            "approved_marks": 0.0,
            "total_round_marks": 0.0,
            "progress_percentage": 0.0,
            "approved_rounds": [],
        }
        return empty

    # Approved rounds for this project
    approved_submissions = (
        db.query(Submission)
        .join(SubmissionVersion, SubmissionVersion.submission_id == Submission.id)
        .filter(Submission.project_id == project_id, SubmissionVersion.status == "APPROVED")
        .all()
    )
    approved_round_ids = {s.round_id for s in approved_submissions}
    approved_total = sum(float(r.max_score) for r in workspace_rounds if r.id in approved_round_ids)
    pct = round((approved_total / total_possible) * 100.0, 2)

    approved_rounds_info = [
        {
            "round_id": r.id,
            "round_title": r.title,
            "order_index": r.order_index,
            "max_score": float(r.max_score),
        }
        for r in workspace_rounds
        if r.id in approved_round_ids
    ]

    res = {
        "project_id": project_id,
        "workspace_id": project.workspace_id,
        "approved_marks": round(approved_total, 2),
        "total_round_marks": round(total_possible, 2),
        "progress_percentage": pct,
        "approved_rounds": approved_rounds_info,
    }

    cache.set(c_key, res, ttl=120, tags=[f"project:{project_id}", f"workspace:{project.workspace_id}"])
    return res

def calculate_project_progress(db: Session, project_id: int) -> float:
    """
    Derived weighted progress formula:
    sum(max_score of approved rounds for this project) / sum(max_score of all rounds in workspace) * 100.0
    """
    details = get_project_progress_details(db, project_id)
    return float(details.get("progress_percentage", 0.0))
