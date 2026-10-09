from app.db.session import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    print("=== TESTING STEP A MIGRATION IN TRANSACTION (DRY RUN) ===")
    # Begin transaction
    db.execute(text("BEGIN"))

    # 1. Alter result_entries to make score nullable and add scored_by, scored_at, released_by
    db.execute(text("ALTER TABLE result_entries ALTER COLUMN score DROP NOT NULL;"))
    db.execute(text("ALTER TABLE result_entries ADD COLUMN IF NOT EXISTS scored_by INTEGER REFERENCES users(id) ON DELETE SET NULL;"))
    db.execute(text("ALTER TABLE result_entries ADD COLUMN IF NOT EXISTS scored_at TIMESTAMPTZ;"))
    db.execute(text("ALTER TABLE result_entries ADD COLUMN IF NOT EXISTS released_by INTEGER REFERENCES users(id) ON DELETE SET NULL;"))

    # 2. Reconcile released_at and is_released
    # If is_released is True but released_at is NULL, set released_at = created_at
    db.execute(text("UPDATE result_entries SET released_at = created_at WHERE is_released = TRUE AND released_at IS NULL;"))
    # If is_released is False, ensure released_at is NULL
    db.execute(text("UPDATE result_entries SET released_at = NULL WHERE is_released = FALSE;"))

    # Populate scored_by and scored_at from review reviewer_id and created_at where score is not null
    db.execute(text("""
        UPDATE result_entries re
        SET scored_by = r.reviewer_id,
            scored_at = re.created_at
        FROM reviews r
        WHERE re.review_id = r.id AND re.score IS NOT NULL AND re.scored_by IS NULL;
    """))

    # Populate released_by from reviewer_id for released rows where released_at is not null
    db.execute(text("""
        UPDATE result_entries re
        SET released_by = r.reviewer_id
        FROM reviews r
        WHERE re.review_id = r.id AND re.released_at IS NOT NULL AND re.released_by IS NULL;
    """))

    # 3. Create result_entry_revisions table
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS result_entry_revisions (
            id SERIAL PRIMARY KEY,
            entry_id INTEGER NOT NULL REFERENCES result_entries(id) ON DELETE CASCADE,
            action VARCHAR(20) NOT NULL,
            old_score NUMERIC(6, 2) NULL,
            new_score NUMERIC(6, 2) NULL,
            reason TEXT NULL,
            changed_by INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
            changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    """))
    db.execute(text("CREATE INDEX IF NOT EXISTS ix_result_entry_revisions_entry_changed ON result_entry_revisions(entry_id, changed_at);"))

    # 4. Convert existing result_corrections into CORRECTED revisions (if any exist)
    db.execute(text("""
        INSERT INTO result_entry_revisions (entry_id, action, old_score, new_score, reason, changed_by, changed_at)
        SELECT result_entry_id, 'CORRECTED', old_score, new_score, reason, corrected_by_id, created_at
        FROM result_corrections;
    """))

    # 5. Create initial SCORED and RELEASED revisions for existing entries using real timestamps
    # For SCORED:
    db.execute(text("""
        INSERT INTO result_entry_revisions (entry_id, action, old_score, new_score, reason, changed_by, changed_at)
        SELECT id, 'SCORED', NULL, score, NULL, scored_by, COALESCE(scored_at, created_at)
        FROM result_entries
        WHERE score IS NOT NULL;
    """))

    # For RELEASED:
    db.execute(text("""
        INSERT INTO result_entry_revisions (entry_id, action, old_score, new_score, reason, changed_by, changed_at)
        SELECT id, 'RELEASED', score, score, NULL, released_by, released_at
        FROM result_entries
        WHERE released_at IS NOT NULL;
    """))

    # 6. Backfill PENDING result_entries (score=NULL) for unrepresented roster members in Review #1 (Students 4 and 5)
    # Using explicit roster backfill for active submission versions
    pending_backfill_sql = text("""
        INSERT INTO result_entries (review_id, student_id, round_id, score, is_released, released_at, created_at, scored_by, scored_at, released_by)
        VALUES 
            (1, 4, 1, NULL, FALSE, NULL, NOW(), NULL, NULL, NULL),
            (1, 5, 1, NULL, FALSE, NULL, NOW(), NULL, NULL, NULL)
        ON CONFLICT (review_id, student_id) DO NOTHING;
    """)
    db.execute(pending_backfill_sql)

    # 7. Query and report after counts
    res_after = db.execute(text("SELECT COUNT(*) FROM result_entries")).scalar()
    cor_after = db.execute(text("SELECT COUNT(*) FROM result_corrections")).scalar()
    rev_after = db.execute(text("SELECT COUNT(*) FROM result_entry_revisions")).scalar()

    print(f"\nAFTER (in simulated transaction):")
    print(f"  result_entries: {res_after} (2 original + 2 backfilled pending = 4 total)")
    print(f"  result_corrections: {cor_after} (preserved for Step A)")
    print(f"  result_entry_revisions: {rev_after} (2 SCORED + 1 RELEASED = 3 total revisions)")

    # Print all result_entries in detail
    all_res = db.execute(text("SELECT id, review_id, student_id, round_id, score, is_released, released_at, scored_by, scored_at, released_by FROM result_entries ORDER BY id")).fetchall()
    print("\nSimulated result_entries rows:")
    for r in all_res:
        state = "RELEASED" if r[6] else ("SCORED" if r[4] is not None else "PENDING")
        print(f"  Entry #{r[0]}: Review #{r[1]}, Student #{r[2]}, Round #{r[3]}, Score: {r[4]}, State: {state}, scored_by: {r[7]}, released_by: {r[9]}")

    # Print all result_entry_revisions in detail
    all_rev = db.execute(text("SELECT id, entry_id, action, old_score, new_score, reason, changed_by, changed_at FROM result_entry_revisions ORDER BY id")).fetchall()
    print("\nSimulated result_entry_revisions rows:")
    for rev in all_rev:
        print(f"  Rev #{rev[0]}: Entry #{rev[1]}, Action: {rev[2]}, Old: {rev[3]}, New: {rev[4]}, Reason: '{rev[5]}', Changed By: {rev[6]}, Changed At: {rev[7]}")

    # Rollback so database is unchanged until explicit user approval
    db.execute(text("ROLLBACK"))
    print("\nTransaction successfully ROLLED BACK. Database remains untouched.")

except Exception as e:
    db.execute(text("ROLLBACK"))
    print(f"ERROR: {e}")
finally:
    db.close()
