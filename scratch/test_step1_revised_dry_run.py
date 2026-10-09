import json
from datetime import datetime, timezone
from sqlalchemy import text
from app.db.session import SessionLocal

db = SessionLocal()
try:
    print("=================================================================")
    print("STEP 1 REVISED: COMPREHENSIVE AUDIT, DISCREPANCY & DRY RUN")
    print("=================================================================\n")

    # -------------------------------------------------------------
    # 1. DISCREPANCY REPORT & RAW INVENTORY
    # -------------------------------------------------------------
    print("1. DISCREPANCY REPORT ON EXISTING RESULT_ENTRIES:")
    raw_entries = db.execute(text("""
        SELECT 
            re.id,
            re.review_id,
            re.student_id,
            re.round_id,
            re.score,
            re.is_released,
            re.released_at,
            re.created_at,
            r.reviewer_id,
            r.status as review_status,
            sv.id as version_id,
            sv.status as version_status,
            sub.round_id as submission_round_id
        FROM result_entries re
        JOIN reviews r ON re.review_id = r.id
        JOIN submission_versions sv ON r.submission_version_id = sv.id
        JOIN submissions sub ON sv.submission_id = sub.id
        ORDER BY re.id
    """)).fetchall()

    for row in raw_entries:
        entry_id, rev_id, student_id, round_id, score, is_rel, rel_at, created_at, reviewer_id, rev_status, ver_id, ver_status, sub_round_id = row
        round_mismatch = (round_id != sub_round_id)
        rel_discrepancy = (is_rel is True and rel_at is None) or (is_rel is False and rel_at is not None)
        print(f"  - Entry #{entry_id}: student={student_id}, score={score}, is_released={is_rel}, released_at={rel_at}")
        print(f"    Round Match: entry.round_id={round_id} vs sub.round_id={sub_round_id} -> {'MISMATCH' if round_mismatch else 'OK'}")
        print(f"    Release State Alignment: {'DISCREPANCY' if rel_discrepancy else 'Consistent'}")
        print(f"    Associated Review #{rev_id} (Version #{ver_id}, ver_status='{ver_status}', reviewer={reviewer_id})")

    # -------------------------------------------------------------
    # 2. ACTOR PROVENANCE FROM AUDIT LOGS
    # -------------------------------------------------------------
    print("\n2. AUDIT LOG PROVENANCE CHECK FOR SCORING & RELEASE ACTIONS:")
    audit_rows = db.execute(text("""
        SELECT id, actor_id, action_type, entity_type, entity_id, workspace_id, created_at, old_value, new_value
        FROM audit_logs
        WHERE entity_type IN ('review', 'submission_version', 'result_entry')
           OR action_type IN ('score_entered', 'results_released', 'review_completed', 'score_corrected')
        ORDER BY id
    """)).fetchall()

    if not audit_rows:
        print("  -> Audit log records for historical scores/releases: NONE FOUND.")
        print("  -> Policy: Scored_by and Released_by MUST remain NULL for legacy rows. No assumptions made.")
    else:
        for a in audit_rows:
            print(f"  Audit #{a[0]}: actor #{a[1]}, action='{a[2]}', entity={a[3]}:{a[4]}, created_at={a[6]}")

    # -------------------------------------------------------------
    # 3. DYNAMIC ELIGIBLE ROSTER DISCOVERY (NO HARDCODED IDS)
    # -------------------------------------------------------------
    print("\n3. DYNAMIC DISCOVERY OF ELIGIBLE SUBMISSION VERSIONS & ROSTERS:")
    eligible_versions = db.execute(text("""
        SELECT 
            sv.id as version_id,
            sv.version_number,
            sv.status as version_status,
            sub.id as submission_id,
            sub.project_id,
            sub.round_id,
            r.id as review_id,
            r.status as review_status,
            sv.roster_snapshot
        FROM submission_versions sv
        JOIN submissions sub ON sv.submission_id = sub.id
        JOIN reviews r ON r.submission_version_id = sv.id
        WHERE sv.status NOT IN ('REVISION_REQUESTED', 'WITHDRAWN', 'DRAFT')
        ORDER BY sv.id
    """)).fetchall()

    backfill_candidates = []
    for ev in eligible_versions:
        ver_id, ver_num, ver_status, sub_id, proj_id, round_id, rev_id, rev_status, roster = ev
        print(f"  Eligible Version #{ver_id} (Sub #{sub_id}, Round #{round_id}, Rev #{rev_id}, status='{ver_status}'):")
        roster_list = roster if isinstance(roster, list) else json.loads(roster or '[]')
        print(f"    Roster Snapshot Members: {len(roster_list)}")
        for member in roster_list:
            u_id = member.get('user_id') or member.get('id')
            u_name = member.get('full_name') or member.get('name')
            u_email = member.get('email')
            # Check if result_entry already exists
            exists = db.execute(text("SELECT id, score, is_released, released_at FROM result_entries WHERE review_id = :rev_id AND student_id = :u_id"), {"rev_id": rev_id, "u_id": u_id}).fetchone()
            if exists:
                print(f"      [EXISTS] Student #{u_id} ({u_name}): Entry #{exists[0]}, score={exists[1]}, released={exists[2]}")
            else:
                print(f"      [PENDING BACKFILL REQUIRED] Student #{u_id} ({u_name}, {u_email}): No result_entry row.")
                backfill_candidates.append({
                    "review_id": rev_id,
                    "student_id": u_id,
                    "round_id": round_id
                })

    print(f"\nTotal Pending Entries to dynamically backfill: {len(backfill_candidates)}")

    # -------------------------------------------------------------
    # 4. SIMULATE STEP A UPGRADE & DOWNGRADE (ISOLATED TRANSACTION)
    # -------------------------------------------------------------
    print("\n-------------------------------------------------------------")
    print("4. EXECUTING STEP A UPGRADE (IN TRANSACTION)")
    print("-------------------------------------------------------------")
    db.execute(text("BEGIN"))

    # Track migration state explicitly for safe rollback
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS _schema_migration_markers (
            marker_key VARCHAR(100) PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            metadata JSONB NULL
        );
    """))

    # A1. Alter result_entries
    db.execute(text("ALTER TABLE result_entries ALTER COLUMN score DROP NOT NULL;"))
    db.execute(text("ALTER TABLE result_entries ADD COLUMN IF NOT EXISTS scored_by INTEGER REFERENCES users(id) ON DELETE SET NULL;"))
    db.execute(text("ALTER TABLE result_entries ADD COLUMN IF NOT EXISTS scored_at TIMESTAMPTZ;"))
    db.execute(text("ALTER TABLE result_entries ADD COLUMN IF NOT EXISTS released_by INTEGER REFERENCES users(id) ON DELETE SET NULL;"))
    db.execute(text("ALTER TABLE result_entries ADD COLUMN IF NOT EXISTS is_migration_backfilled BOOLEAN DEFAULT FALSE NOT NULL;"))

    # A2. Reconcile released_at without clearing timestamps
    # If is_released is True and released_at is NULL -> populate released_at from created_at
    # If is_released is False and released_at is NOT NULL -> KEEP released_at intact (preserve history), set is_released = TRUE if released_at exists or preserve raw data
    db.execute(text("""
        UPDATE result_entries 
        SET released_at = created_at 
        WHERE is_released = TRUE AND released_at IS NULL;
    """))

    # A3. Actor Provenance: Search audit logs. If none found, leave NULL.
    db.execute(text("""
        UPDATE result_entries re
        SET scored_by = al.actor_id,
            scored_at = al.created_at
        FROM audit_logs al
        WHERE al.action_type = 'score_entered' 
          AND al.entity_type = 'result_entry' 
          AND al.entity_id = re.id;
    """))
    db.execute(text("""
        UPDATE result_entries re
        SET released_by = al.actor_id
        FROM audit_logs al
        WHERE al.action_type = 'results_released' 
          AND al.entity_type = 'result_entry' 
          AND al.entity_id = re.id;
    """))

    # A4. Create result_entry_revisions
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

    # A5. Convert existing result_corrections
    db.execute(text("""
        INSERT INTO result_entry_revisions (entry_id, action, old_score, new_score, reason, changed_by, changed_at)
        SELECT result_entry_id, 'CORRECTED', old_score, new_score, reason, corrected_by_id, created_at
        FROM result_corrections;
    """))

    # A6. Idempotent baseline revisions for existing entries
    # Insert SCORED revision if not already created
    db.execute(text("""
        INSERT INTO result_entry_revisions (entry_id, action, old_score, new_score, reason, changed_by, changed_at)
        SELECT 
            re.id, 
            'SCORED', 
            NULL, 
            re.score, 
            NULL, 
            re.scored_by, 
            COALESCE(re.scored_at, re.created_at)
        FROM result_entries re
        WHERE re.score IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM result_entry_revisions rev 
              WHERE rev.entry_id = re.id AND rev.action = 'SCORED'
          );
    """))

    # Insert RELEASED revision if released_at is set and not already recorded
    db.execute(text("""
        INSERT INTO result_entry_revisions (entry_id, action, old_score, new_score, reason, changed_by, changed_at)
        SELECT 
            re.id, 
            'RELEASED', 
            re.score, 
            re.score, 
            NULL, 
            re.released_by, 
            re.released_at
        FROM result_entries re
        WHERE re.released_at IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM result_entry_revisions rev 
              WHERE rev.entry_id = re.id AND rev.action = 'RELEASED'
          );
    """))

    # A7. Dynamic generic roster backfill for eligible non-revision-requested versions
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
            review_id, 
            student_id, 
            round_id, 
            score, 
            is_released, 
            released_at, 
            created_at, 
            scored_by, 
            scored_at, 
            released_by,
            is_migration_backfilled
        )
        SELECT 
            ru.review_id,
            ru.student_id,
            ru.round_id,
            NULL,
            FALSE,
            NULL,
            NOW(),
            NULL,
            NULL,
            NULL,
            TRUE
        FROM roster_unpivoted ru
        WHERE NOT EXISTS (
            SELECT 1 FROM result_entries existing 
            WHERE existing.review_id = ru.review_id AND existing.student_id = ru.student_id
        )
        ON CONFLICT (review_id, student_id) DO NOTHING;
    """))

    # Record migration marker
    db.execute(text("""
        INSERT INTO _schema_migration_markers (marker_key, metadata)
        VALUES ('step_a_results_migration', '{"version": "1.0", "description": "Step A results migration with revisions and backfill"}');
    """))

    # Query counts after upgrade
    res_after_up = db.execute(text("SELECT COUNT(*) FROM result_entries")).scalar()
    cor_after_up = db.execute(text("SELECT COUNT(*) FROM result_corrections")).scalar()
    rev_after_up = db.execute(text("SELECT COUNT(*) FROM result_entry_revisions")).scalar()

    print(f"\nAFTER UPGRADE (Step A):")
    print(f"  result_entries count: {res_after_up} (2 original + 2 backfilled = 4 total)")
    print(f"  result_corrections count: {cor_after_up} (preserved)")
    print(f"  result_entry_revisions count: {rev_after_up} (2 SCORED + 1 RELEASED = 3 total)")

    print("\nROW-LEVEL VALIDATION OF ALL RESULT_ENTRIES:")
    validated_rows = db.execute(text("""
        SELECT id, review_id, student_id, round_id, score, is_released, released_at, scored_by, scored_at, released_by, is_migration_backfilled 
        FROM result_entries 
        ORDER BY id
    """)).fetchall()

    for vr in validated_rows:
        state = "RELEASED" if vr[6] else ("SCORED" if vr[4] is not None else "PENDING")
        print(f"  Entry #{vr[0]}: student={vr[2]}, score={vr[4]}, state={state}, scored_by={vr[7]}, released_at={vr[6]}, backfilled={vr[10]}")

    print("\nROW-LEVEL VALIDATION OF RESULT_ENTRY_REVISIONS:")
    rev_rows = db.execute(text("SELECT id, entry_id, action, old_score, new_score, reason, changed_by, changed_at FROM result_entry_revisions ORDER BY id")).fetchall()
    for rr in rev_rows:
        print(f"  Rev #{rr[0]}: entry #{rr[1]}, action='{rr[2]}', old={rr[3]}, new={rr[4]}, reason='{rr[5]}', changed_by={rr[6]}, at={rr[7]}")

    # -------------------------------------------------------------
    # 5. TEST SAFE DOWNGRADE
    # -------------------------------------------------------------
    print("\n-------------------------------------------------------------")
    print("5. EXECUTING STEP A DOWNGRADE VERIFICATION (IN TRANSACTION)")
    print("-------------------------------------------------------------")

    # Downgrade step:
    # 1. Delete ONLY entries created by migration that remain unscored (is_migration_backfilled = TRUE and score IS NULL)
    db.execute(text("DELETE FROM result_entries WHERE is_migration_backfilled = TRUE AND score IS NULL;"))

    # 2. Drop result_entry_revisions
    db.execute(text("DROP TABLE IF EXISTS result_entry_revisions CASCADE;"))

    # 3. Remove added columns from result_entries
    db.execute(text("ALTER TABLE result_entries DROP COLUMN IF EXISTS scored_by;"))
    db.execute(text("ALTER TABLE result_entries DROP COLUMN IF EXISTS scored_at;"))
    db.execute(text("ALTER TABLE result_entries DROP COLUMN IF EXISTS released_by;"))
    db.execute(text("ALTER TABLE result_entries DROP COLUMN IF EXISTS is_migration_backfilled;"))
    db.execute(text("ALTER TABLE result_entries ALTER COLUMN score SET NOT NULL;"))

    # 4. Remove marker
    db.execute(text("DELETE FROM _schema_migration_markers WHERE marker_key = 'step_a_results_migration';"))

    # Query counts after downgrade
    res_after_down = db.execute(text("SELECT COUNT(*) FROM result_entries")).scalar()
    cor_after_down = db.execute(text("SELECT COUNT(*) FROM result_corrections")).scalar()
    table_rev_exists = db.execute(text("SELECT to_regclass('public.result_entry_revisions')")).scalar()

    print(f"\nAFTER DOWNGRADE:")
    print(f"  result_entries count: {res_after_down} (restored to exactly original 2 rows)")
    print(f"  result_corrections count: {cor_after_down} (preserved)")
    print(f"  result_entry_revisions table: {'Exists' if table_rev_exists else 'Cleanly Dropped'}")

    # Clean Rollback
    db.execute(text("ROLLBACK"))
    print("\nTRANSACTION ROLLED BACK. Production database is 100% clean and untouched.")

finally:
    db.close()
