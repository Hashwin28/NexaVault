from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.review import ReviewRound, Submission, SubmissionVersion
from app.models.project import Project
from app.core.cache import cache, key_project_progress

def calculate_project_progress(db: Session, project_id: int) -> float:
    """
    Derived weighted progress formula:
    sum(max_score of approved rounds for this project) / sum(max_score of all rounds in workspace) * 100.0
    """
    c_key = key_project_progress(project_id)
    cached_val = cache.get(c_key)
    if cached_val is not None:
        return cached_val

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return 0.0

    workspace_rounds = db.query(ReviewRound).filter(ReviewRound.workspace_id == project.workspace_id).all()
    if not workspace_rounds:
        return 0.0

    total_possible = sum(float(r.max_score) for r in workspace_rounds)
    if total_possible <= 0:
        return 0.0

    # Approved rounds for this project
    approved_submissions = (
        db.query(Submission)
        .join(SubmissionVersion, SubmissionVersion.submission_id == Submission.id)
        .filter(Submission.project_id == project_id, SubmissionVersion.status == "APPROVED")
        .all()
    )
    approved_round_ids = {s.round_id for s in approved_submissions}
    approved_total = sum(float(r.max_score) for r in workspace_rounds if r.id in approved_round_ids)

    res = round((approved_total / total_possible) * 100.0, 2)
    cache.set(c_key, res, ttl=120, tags=[f"project:{project_id}", f"workspace:{project.workspace_id}"])
    return res
