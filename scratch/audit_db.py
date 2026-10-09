from app.db.session import SessionLocal
from app.models.review import ReviewRound, Submission, SubmissionVersion, Review, ResultEntry, ResultCorrection
from app.models.project import Project
from app.models.group import Group, GroupMembership
from app.models.user import User
from app.models.workspace import Workspace

db = SessionLocal()
try:
    print("=== AUDIT REPORT: NEXAVAULT DATABASE INVENTORY ===")
    rounds = db.query(ReviewRound).all()
    print(f"Total ReviewRounds: {len(rounds)}")
    for r in rounds:
        print(f"  Round #{r.id} (Workspace: {r.workspace_id}) - Title: '{r.title}', max_score: {r.max_score}, is_open: {r.is_open}")

    submissions = db.query(Submission).all()
    print(f"\nTotal Submissions: {len(submissions)}")

    versions = db.query(SubmissionVersion).all()
    print(f"\nTotal SubmissionVersions: {len(versions)}")
    for v in versions:
        print(f"  Version #{v.id} (Sub #{v.submission_id}, v{v.version_number}) - status: {v.status}, submitter: {v.submitted_by}, roster: {v.roster_snapshot}")

    reviews = db.query(Review).all()
    print(f"\nTotal Reviews: {len(reviews)}")
    for rev in reviews:
        print(f"  Review #{rev.id} (Version #{rev.submission_version_id}) - status: {rev.status}, reviewer: {rev.reviewer_id}, completed_at: {rev.completed_at}")

    results = db.query(ResultEntry).all()
    print(f"\nTotal ResultEntries: {len(results)}")
    for res in results:
        print(f"  ResultEntry #{res.id} - Review #{res.review_id}, Student #{res.student_id}, Round #{res.round_id}, Score: {res.score}, is_released: {res.is_released}, released_at: {res.released_at}")

    corrections = db.query(ResultCorrection).all()
    print(f"\nTotal ResultCorrections: {len(corrections)}")
    for cor in corrections:
        print(f"  Correction #{cor.id} - ResultEntry #{cor.result_entry_id}, Old: {cor.old_score}, New: {cor.new_score}, Reason: '{cor.reason}'")

finally:
    db.close()
