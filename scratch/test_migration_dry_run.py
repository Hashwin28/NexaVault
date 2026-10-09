from app.db.session import SessionLocal, engine
from sqlalchemy import text
from app.models.review import ResultEntry, ResultCorrection, Review, SubmissionVersion
from app.models.audit import AuditLog

db = SessionLocal()
try:
    print("--- START DRY-RUN AUDIT & VERIFICATION ---")
    
    # 1. Counts Before
    res_count_before = db.execute(text("SELECT COUNT(*) FROM result_entries")).scalar()
    cor_count_before = db.execute(text("SELECT COUNT(*) FROM result_corrections")).scalar()
    table_exists = db.execute(text("SELECT to_regclass('public.result_entry_revisions')")).scalar()
    rev_count_before = 0 if not table_exists else db.execute(text("SELECT COUNT(*) FROM result_entry_revisions")).scalar()
    
    print(f"BEFORE:")
    print(f"  result_entries: {res_count_before}")
    print(f"  result_corrections: {cor_count_before}")
    print(f"  result_entry_revisions: {rev_count_before}")

    # Inspect current result entries
    entries = db.execute(text("SELECT id, review_id, student_id, round_id, score, is_released, released_at, created_at FROM result_entries")).fetchall()
    print(f"\nExisting result_entries rows:")
    for e in entries:
        print(f"  ID: {e[0]}, Review: {e[1]}, Student: {e[2]}, Round: {e[3]}, Score: {e[4]}, is_released: {e[5]}, released_at: {e[6]}, created_at: {e[7]}")

    # Inspect roster snapshot for review 1
    v = db.execute(text("SELECT sv.id, sv.status, sv.roster_snapshot, r.id, r.reviewer_id FROM submission_versions sv JOIN reviews r ON r.submission_version_id = sv.id WHERE r.id = 1")).fetchone()
    print(f"\nReview #1 version status: {v[1]}, reviewer: {v[4]}, roster: {v[2]}")

    # Check audit log for scored/released actors
    audit_events = db.execute(text("SELECT id, actor_id, action_type, entity_type, entity_id, created_at FROM audit_logs WHERE action_type IN ('score_entered', 'results_released', 'review_completed')")).fetchall()
    print(f"\nRelated audit events: {len(audit_events)}")
    for a in audit_events:
        print(f"  Audit #{a[0]}: actor #{a[1]}, action '{a[2]}', entity {a[3]}:{a[4]}, created_at {a[5]}")

finally:
    db.close()
