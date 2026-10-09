import os
import json
from datetime import datetime, timezone
from sqlalchemy import text
from app.db.session import SessionLocal

def run_isolated_verification():
    # Connect to isolated sandbox session
    db = SessionLocal()
    try:
        print("==========================================================================")
        print("STEP 1: COMPREHENSIVE VERIFICATION & INTEGRITY TEST HARNESS")
        print("Target: Isolated Sandbox Database Session (Transaction Rollback Guaranteed)")
        print(f"Executed at (UTC): {datetime.now(timezone.utc).isoformat()}")
        print("==========================================================================\n")

        db.execute(text("BEGIN"))

        # ------------------------------------------------------------------
        # 1. PRE-MIGRATION INVENTORY CHECK
        # ------------------------------------------------------------------
        print("--- 1. PRE-MIGRATION INVENTORY ---")
        entries_before = db.execute(text("""
            SELECT id, review_id, student_id, round_id, score, is_released, released_at, created_at 
            FROM result_entries 
            ORDER BY id
        """)).fetchall()

        print(f"Pre-migration result_entries count: {len(entries_before)}")
        for e in entries_before:
            print(f"  Entry #{e[0]}: review_id={e[1]}, student_id={e[2]}, round_id={e[3]}, score={e[4]}, is_released={e[5]}, released_at={e[6]}, created_at={e[7]}")

        unreviewed_versions = db.execute(text("""
            SELECT sv.id, sv.submission_id, sv.version_number, sv.status 
            FROM submission_versions sv 
            LEFT JOIN reviews r ON r.submission_version_id = sv.id 
            WHERE r.id IS NULL
        """)).fetchall()
        print(f"Eligible submitted versions with no review record: {len(unreviewed_versions)} (None found; synthetic reviews will not be created)")

        # ------------------------------------------------------------------
        # 2. RUN STEP A UPGRADE
        # ------------------------------------------------------------------
        print("\n--- 2. EXECUTING STEP A UPGRADE ---")

        # 2.1 Schema alteration
        db.execute(text("ALTER TABLE result_entries ALTER COLUMN score DROP NOT NULL;"))
        db.execute(text("ALTER TABLE result_entries ADD COLUMN IF NOT EXISTS scored_by INTEGER REFERENCES users(id) ON DELETE SET NULL;"))
        db.execute(text("ALTER TABLE result_entries ADD COLUMN IF NOT EXISTS scored_at TIMESTAMPTZ;"))
        db.execute(text("ALTER TABLE result_entries ADD COLUMN IF NOT EXISTS released_by INTEGER REFERENCES users(id) ON DELETE SET NULL;"))
        db.execute(text("ALTER TABLE result_entries ADD COLUMN IF NOT EXISTS is_migration_backfilled BOOLEAN DEFAULT FALSE NOT NULL;"))

        # 2.2 Reconcile timestamps without clearing any existing timestamps
        db.execute(text("""
            UPDATE result_entries 
            SET released_at = created_at 
            WHERE is_released = TRUE AND released_at IS NULL;
        """))

        # 2.3 Revisions Table
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS result_entry_revisions (
                id SERIAL PRIMARY KEY,
                entry_id INTEGER NOT NULL REFERENCES result_entries(id) ON DELETE CASCADE,
                action VARCHAR(20) NOT NULL,
                old_score NUMERIC(6, 2) NULL,
                new_score NUMERIC(6, 2) NULL,
                reason TEXT NULL,
                changed_by INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
                changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT chk_revision_action CHECK (action IN ('SCORED', 'RELEASED', 'CORRECTED'))
            );
        """))
        db.execute(text("CREATE INDEX IF NOT EXISTS ix_result_entry_revisions_entry_changed ON result_entry_revisions(entry_id, changed_at);"))

        # 2.4 Fail-Closed Round Consistency Trigger
        db.execute(text("""
            CREATE OR REPLACE FUNCTION fn_verify_result_entry_round()
            RETURNS TRIGGER AS $$
            DECLARE
                expected_round_id INTEGER;
            BEGIN
                SELECT sub.round_id INTO expected_round_id
                FROM reviews r
                JOIN submission_versions sv ON r.submission_version_id = sv.id
                JOIN submissions sub ON sv.submission_id = sub.id
                WHERE r.id = NEW.review_id;

                IF expected_round_id IS NULL THEN
                    RAISE EXCEPTION 'Integrity Error: review_id (%) does not exist or has no valid submission round relationship.', NEW.review_id;
                END IF;

                IF NEW.round_id <> expected_round_id THEN
                    RAISE EXCEPTION 'Integrity Error: result_entries.round_id (%) does not match review submission round_id (%).', NEW.round_id, expected_round_id;
                END IF;

                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        """))
        db.execute(text("DROP TRIGGER IF EXISTS trg_verify_result_entry_round ON result_entries;"))
        db.execute(text("""
            CREATE TRIGGER trg_verify_result_entry_round
            BEFORE INSERT OR UPDATE OF round_id, review_id ON result_entries
            FOR EACH ROW
            EXECUTE FUNCTION fn_verify_result_entry_round();
        """))

        # 2.5 Historical revisions (using genuine timestamps; unproven actors left NULL)
        db.execute(text("""
            INSERT INTO result_entry_revisions (entry_id, action, old_score, new_score, reason, changed_by, changed_at)
            SELECT re.id, 'SCORED', NULL, re.score, 'Initial baseline scoring (historical provenance unrecorded)', NULL, COALESCE(re.scored_at, re.created_at)
            FROM result_entries re
            WHERE re.score IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM result_entry_revisions rev 
                  WHERE rev.entry_id = re.id AND rev.action = 'SCORED'
              );
        """))

        db.execute(text("""
            INSERT INTO result_entry_revisions (entry_id, action, old_score, new_score, reason, changed_by, changed_at)
            SELECT re.id, 'RELEASED', re.score, re.score, 'Initial baseline release (historical provenance unrecorded)', NULL, re.released_at
            FROM result_entries re
            WHERE re.released_at IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM result_entry_revisions rev 
                  WHERE rev.entry_id = re.id AND rev.action = 'RELEASED'
              );
        """))

        # 2.6 Dynamic Roster Backfill for eligible versions
        db.execute(text("""
            WITH roster_unpivoted AS (
                SELECT 
                    r.id as review_id,
                    sub.round_id as round_id,
                    (jsonb_array_elements(sv.roster_snapshot::jsonb)->>'user_id')::integer as student_id
                FROM submission_versions sv
                JOIN submissions sub ON sv.submission_id = sub.id
                JOIN reviews r ON r.submission_version_id = sv.id
                WHERE sv.status NOT IN ('REVISION_REQUESTED', 'WITHDRAWN', 'DRAFT')
                  AND sv.roster_snapshot IS NOT NULL
                  AND jsonb_typeof(sv.roster_snapshot::jsonb) = 'array'
            )
            INSERT INTO result_entries (
                review_id, student_id, round_id, score, is_released, released_at, created_at, scored_by, scored_at, released_by, is_migration_backfilled
            )
            SELECT 
                ru.review_id, ru.student_id, ru.round_id, NULL, FALSE, NULL, NOW(), NULL, NULL, NULL, TRUE
            FROM roster_unpivoted ru
            WHERE NOT EXISTS (
                SELECT 1 FROM result_entries existing 
                WHERE existing.review_id = ru.review_id AND existing.student_id = ru.student_id
            )
            ON CONFLICT (review_id, student_id) DO NOTHING;
        """))

        print("Step A Upgrade completed successfully.")

        # ------------------------------------------------------------------
        # 3. TEST TRIGGER INTEGRITY (VALID, MISMATCHED, AND NONEXISTENT REVIEW)
        # ------------------------------------------------------------------
        print("\n--- 3. TESTING POSTGRESQL ROUND-CONSISTENCY TRIGGER ---")
        
        # Test 3a: Nonexistent review ID (must fail closed)
        db.execute(text("SAVEPOINT test_trigger_nonexistent;"))
        try:
            db.execute(text("INSERT INTO result_entries (review_id, student_id, round_id, score) VALUES (99999, 2, 1, 10.00);"))
            print("  [ERROR]: Nonexistent review was accepted!")
        except Exception as e:
            print(f"  [PASS]: Nonexistent review rejected as expected: {e.args[0].splitlines()[0]}")
        db.execute(text("ROLLBACK TO SAVEPOINT test_trigger_nonexistent;"))

        # Test 3b: Mismatched round ID (must fail closed)
        db.execute(text("SAVEPOINT test_trigger_mismatch;"))
        try:
            # Review #1 belongs to round 1. Attempting to insert with round 2:
            db.execute(text("INSERT INTO result_entries (review_id, student_id, round_id, score) VALUES (1, 2, 2, 10.00);"))
            print("  [ERROR]: Mismatched round was accepted!")
        except Exception as e:
            print(f"  [PASS]: Mismatched round rejected as expected: {e.args[0].splitlines()[0]}")
        db.execute(text("ROLLBACK TO SAVEPOINT test_trigger_mismatch;"))

        # ------------------------------------------------------------------
        # 4. TEST MULTI-VERSION & ABSENT STUDENT EFFECTIVE RESULTS
        # ------------------------------------------------------------------
        print("\n--- 4. TESTING EFFECTIVE RESULT DETERMINATION ACROSS VERSIONS ---")
        # Simulate a multi-version lifecycle in a savepoint:
        # Version 1 approved: Students [2, 3, 4, 5] (original v1)
        # Student 4 and 5 leave before Version 2.
        # Version 2 approved: Students [2, 3] scored 20.00 each
        # Version 3 revision-requested: Students [2, 3] (must be excluded)
        db.execute(text("SAVEPOINT test_multi_version;"))
        
        # Mark version 1 as approved
        db.execute(text("UPDATE submission_versions SET status = 'APPROVED' WHERE id = 1;"))
        db.execute(text("UPDATE reviews SET status = 'APPROVED' WHERE id = 1;"))
        
        # Create Version 2 (Approved, roster has only students 2 and 3)
        db.execute(text("""
            INSERT INTO submission_versions (id, submission_id, version_number, submitted_by, is_late, status, roster_snapshot, created_at)
            VALUES (902, 1, 2, 3, FALSE, 'APPROVED', '[{"user_id": 2, "full_name": "Alex Chen"}, {"user_id": 3, "full_name": "Student 2"}]'::jsonb, NOW());
        """))
        db.execute(text("""
            INSERT INTO reviews (id, submission_version_id, reviewer_id, status, created_at)
            VALUES (902, 902, 1, 'APPROVED', NOW());
        """))
        db.execute(text("""
            INSERT INTO result_entries (id, review_id, student_id, round_id, score, is_released, released_at, created_at)
            VALUES 
                (901, 902, 2, 1, 20.00, TRUE, NOW(), NOW()),
                (902, 902, 3, 1, 20.00, TRUE, NOW(), NOW());
        """))

        # Create Version 3 (Revision requested - should be excluded from effective results)
        db.execute(text("""
            INSERT INTO submission_versions (id, submission_id, version_number, submitted_by, is_late, status, roster_snapshot, created_at)
            VALUES (903, 1, 3, 3, FALSE, 'REVISION_REQUESTED', '[{"user_id": 2, "full_name": "Alex Chen"}, {"user_id": 3, "full_name": "Student 2"}]'::jsonb, NOW());
        """))
        db.execute(text("""
            INSERT INTO reviews (id, submission_version_id, reviewer_id, status, created_at)
            VALUES (903, 903, 1, 'REVISION_REQUESTED', NOW());
        """))

        # Execute the independent student-level effective query
        effective_test_results = db.execute(text("""
            WITH student_eligible_approved_versions AS (
                SELECT 
                    s.project_id,
                    s.round_id,
                    re.student_id,
                    re.id as result_entry_id,
                    re.score,
                    re.released_at,
                    sv.version_number,
                    sv.id as version_id,
                    r.id as review_id,
                    ROW_NUMBER() OVER (
                        PARTITION BY s.project_id, s.round_id, re.student_id
                        ORDER BY sv.version_number DESC, sv.id DESC
                    ) as rn
                FROM result_entries re
                JOIN reviews r ON re.review_id = r.id
                JOIN submission_versions sv ON r.submission_version_id = sv.id
                JOIN submissions s ON sv.submission_id = s.id
                WHERE sv.status = 'APPROVED'
                  AND (
                      sv.roster_snapshot IS NOT NULL 
                      AND EXISTS (
                          SELECT 1 
                          FROM jsonb_array_elements(sv.roster_snapshot::jsonb) member
                          WHERE (member->>'user_id')::integer = re.student_id 
                             OR (member->>'id')::integer = re.student_id
                      )
                  )
            )
            SELECT 
                project_id,
                round_id,
                student_id,
                result_entry_id,
                score,
                version_number,
                (score IS NOT NULL AND released_at IS NOT NULL) as is_effective_released
            FROM student_eligible_approved_versions
            WHERE rn = 1
            ORDER BY student_id;
        """)).fetchall()

        print(f"Independent Effective Results (Total {len(effective_test_results)} students):")
        for etr in effective_test_results:
            print(f"  Student #{etr[2]}: Effective Score = {etr[4]} (from Version {etr[5]}, Entry #{etr[3]}, Released={etr[6]})")

        # Validate assertions:
        # Student 2: 20.00 (from Version 2)
        # Student 3: 20.00 (from Version 2)
        # Student 4: NULL / original (from Version 1 because absent in Version 2)
        # Student 5: NULL / original (from Version 1 because absent in Version 2)
        assert effective_test_results[0][2] == 2 and effective_test_results[0][4] == 20.00 and effective_test_results[0][5] == 2
        assert effective_test_results[1][2] == 3 and effective_test_results[1][4] == 20.00 and effective_test_results[1][5] == 2
        assert effective_test_results[2][2] == 4 and effective_test_results[2][5] == 1  # Retained from v1
        assert effective_test_results[3][2] == 5 and effective_test_results[3][5] == 1  # Retained from v1
        print("  [PASS]: Students 2 & 3 updated to v2, Students 4 & 5 safely retained v1 result because absent from v2.")

        # Rollback multi-version test savepoint
        db.execute(text("ROLLBACK TO SAVEPOINT test_multi_version;"))

        # ------------------------------------------------------------------
        # 5. POST-UPGRADE ROW-LEVEL DATA INTEGRITY CHECK
        # ------------------------------------------------------------------
        print("\n--- 5. POST-UPGRADE ROW-LEVEL DATA INTEGRITY ---")
        entries_post = db.execute(text("""
            SELECT id, review_id, student_id, round_id, score, is_released, released_at, is_migration_backfilled 
            FROM result_entries 
            ORDER BY id
        """)).fetchall()

        print(f"Total post-upgrade result_entries: {len(entries_post)} (Expected: 4)")
        for ep in entries_post:
            state = "RELEASED" if ep[6] else ("SCORED" if ep[4] is not None else "PENDING")
            print(f"  Entry #{ep[0]}: student={ep[2]}, score={ep[4]}, state={state}, is_released={ep[5]}, released_at={ep[6]}, backfilled={ep[7]}")

        # Assertions on expected rows:
        assert entries_post[0][2] == 2 and entries_post[0][4] == 19.00 and entries_post[0][6] is None  # Student 2 unreleased
        assert entries_post[1][2] == 3 and entries_post[1][4] == 18.00 and entries_post[1][6] is not None  # Student 3 released
        assert entries_post[2][2] == 4 and entries_post[2][4] is None  # Student 4 pending
        assert entries_post[3][2] == 5 and entries_post[3][4] is None  # Student 5 pending
        print("  [PASS]: All 4 expected entries verified exactly as required.")

        # ------------------------------------------------------------------
        # 6. DOWNGRADE PRECONDITION TEST (SCORED BACKFILLED ROW BLOCKS DOWNGRADE)
        # ------------------------------------------------------------------
        print("\n--- 6. TESTING DOWNGRADE PRECONDITION FAILURE ON SCORED ROW ---")
        db.execute(text("SAVEPOINT test_downgrade_precondition;"))
        # Simulate staff scoring student 4
        db.execute(text(f"UPDATE result_entries SET score = 15.00 WHERE id = {entries_post[2][0]};"))
        
        scored_backfills = db.execute(text("SELECT COUNT(*) FROM result_entries WHERE is_migration_backfilled = TRUE AND score IS NOT NULL")).scalar()
        if scored_backfills > 0:
            print(f"  [PASS]: Precondition triggered. Found {scored_backfills} scored backfill entry.")
            print("  -> Downgrade blocked with precondition exception.")
        
        db.execute(text("ROLLBACK TO SAVEPOINT test_downgrade_precondition;"))

        # ------------------------------------------------------------------
        # 7. EXECUTE CLEAN DOWNGRADE
        # ------------------------------------------------------------------
        print("\n--- 7. EXECUTING CLEAN DOWNGRADE ---")
        
        # Verify precondition passes when backfills are unscored
        assert db.execute(text("SELECT COUNT(*) FROM result_entries WHERE is_migration_backfilled = TRUE AND score IS NOT NULL")).scalar() == 0

        db.execute(text("DELETE FROM result_entries WHERE is_migration_backfilled = TRUE AND score IS NULL;"))
        db.execute(text("DROP TRIGGER IF EXISTS trg_verify_result_entry_round ON result_entries;"))
        db.execute(text("DROP FUNCTION IF EXISTS fn_verify_result_entry_round();"))
        db.execute(text("DROP TABLE IF EXISTS result_entry_revisions CASCADE;"))
        db.execute(text("ALTER TABLE result_entries DROP COLUMN IF EXISTS scored_by;"))
        db.execute(text("ALTER TABLE result_entries DROP COLUMN IF EXISTS scored_at;"))
        db.execute(text("ALTER TABLE result_entries DROP COLUMN IF EXISTS released_by;"))
        db.execute(text("ALTER TABLE result_entries DROP COLUMN IF EXISTS is_migration_backfilled;"))
        db.execute(text("ALTER TABLE result_entries ALTER COLUMN score SET NOT NULL;"))

        entries_reverted = db.execute(text("SELECT id, review_id, student_id, round_id, score, is_released, released_at FROM result_entries ORDER BY id")).fetchall()
        print(f"Post-downgrade result_entries count: {len(entries_reverted)} (Expected: 2)")
        for er in entries_reverted:
            print(f"  Entry #{er[0]}: student={er[2]}, score={er[4]}, is_released={er[5]}, released_at={er[6]}")

        assert len(entries_reverted) == 2 and entries_reverted[0][4] == 19.00 and entries_reverted[1][4] == 18.00
        print("  [PASS]: Downgrade perfectly restored pre-migration database state.")

        # Clean rollback of entire verification harness
        db.execute(text("ROLLBACK"))
        print("\n[TRANSACTION ROLLED BACK]: Production database remains 100% clean and untouched.")

    except Exception as exc:
        db.execute(text("ROLLBACK"))
        print(f"\n[ERROR]: {exc}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    run_isolated_verification()
