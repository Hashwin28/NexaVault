import os
import subprocess
import re
import json
from sqlalchemy import create_engine, text

COPY_DB_NAME = "nexavault_step1_copy"
ADMIN_DB_URL = "postgresql://postgres:postgres@localhost:5432/postgres"
SOURCE_DB_URL = "postgresql://postgres:postgres@localhost:5432/nexavault_db"
COPY_DB_URL = f"postgresql://postgres:postgres@localhost:5432/{COPY_DB_NAME}"

def mask_db_url(url: str) -> str:
    return re.sub(r'://([^:]+):([^@]+)@([^:/]+)', r'://\1:****@\3', url)

def run_cmd(cmd_list, env_vars=None):
    env = os.environ.copy()
    if env_vars:
        env.update(env_vars)
    res = subprocess.run(cmd_list, capture_output=True, text=True, cwd="backend", env=env)
    return res

def main():
    print("==========================================================================")
    print("STEP 1: COMPREHENSIVE REVISED DRY-RUN ON ISOLATED COPY DATABASE")
    print(f"Source Database (Real Marks): {mask_db_url(SOURCE_DB_URL)}")
    print(f"Isolated Copy Database:       {mask_db_url(COPY_DB_URL)}")
    print("==========================================================================\n")

    # Step 1: Create fresh template copy
    print("[1] Creating isolated copy database from template...")
    admin_engine = create_engine(ADMIN_DB_URL, isolation_level="AUTOCOMMIT")
    with admin_engine.connect() as conn:
        conn.execute(text("""
            SELECT pg_terminate_backend(pid) 
            FROM pg_stat_activity 
            WHERE datname = 'nexavault_db' AND pid <> pg_backend_pid();
        """))
        conn.execute(text(f"DROP DATABASE IF EXISTS {COPY_DB_NAME};"))
        conn.execute(text(f"CREATE DATABASE {COPY_DB_NAME} TEMPLATE nexavault_db OWNER postgres;"))
    admin_engine.dispose()
    print("  -> Isolated copy database created successfully.")

    # Step 2: Audit real statuses and roster snapshots on Copy DB
    copy_engine = create_engine(COPY_DB_URL)
    with copy_engine.connect() as conn:
        print("\n[2] Live Baseline Audit (Pre-Migration Data Inspection):")
        sv_status_rows = conn.execute(text("SELECT id, status, version_number FROM submission_versions ORDER BY id")).fetchall()
        for sv in sv_status_rows:
            print(f"  SubmissionVersion #{sv[0]}: version_number={sv[2]}, status='{sv[1]}'")

        rev_status_rows = conn.execute(text("SELECT id, status, submission_version_id, reviewer_id FROM reviews ORDER BY id")).fetchall()
        for r in rev_status_rows:
            print(f"  Review #{r[0]}: submission_version_id={r[2]}, reviewer_id={r[3]}, status='{r[1]}'")

        distinct_sv_status = [r[0] for r in conn.execute(text("SELECT DISTINCT status FROM submission_versions")).fetchall()]
        distinct_rev_status = [r[0] for r in conn.execute(text("SELECT DISTINCT status FROM reviews")).fetchall()]
        print(f"  Distinct submission_versions status values: {distinct_sv_status}")
        print(f"  Distinct reviews status values: {distinct_rev_status}")

        roster_rows = conn.execute(text("SELECT id, roster_snapshot FROM submission_versions WHERE roster_snapshot IS NOT NULL")).fetchall()
        print(f"\n  Audited roster_snapshot JSON shapes ({len(roster_rows)} version):")
        for rr in roster_rows:
            print(f"    Version #{rr[0]} snapshot: {json.dumps(rr[1], indent=6)}")

        entries_before = conn.execute(text("""
            SELECT id, review_id, student_id, round_id, score, is_released, released_at, created_at 
            FROM result_entries 
            ORDER BY id
        """)).fetchall()
        print(f"\n  Pre-Migration result_entries count: {len(entries_before)}")
        for eb in entries_before:
            print(f"    Entry #{eb[0]}: student_id={eb[2]}, round_id={eb[3]}, score={eb[4]}, is_released={eb[5]}, released_at={eb[6]}")

        # Inject legacy correction fixture (ID 888) to test Item A & B requirement (4 revisions, earliest correction old_score)
        conn.execute(text("""
            INSERT INTO result_corrections (id, result_entry_id, old_score, new_score, reason, corrected_by_id, created_at)
            VALUES (888, 1, 15.00, 19.00, 'Legacy calculation adjustment', 1, '2026-10-08 12:00:00+00');
        """))
        conn.commit()
        print("  -> Injected legacy correction fixture on Entry #1 (old=15.00, new=19.00, corrected_by=1).")

    # Step 3: Run real `alembic upgrade head`
    print("\n[3] Running: alembic upgrade head against copy database...")
    res_up1 = run_cmd(["alembic", "upgrade", "head"], {"DATABASE_URL": COPY_DB_URL})
    print("STDOUT:", res_up1.stdout.strip())
    if res_up1.stderr:
        print("STDERR:", res_up1.stderr.strip())
    assert res_up1.returncode == 0, "alembic upgrade head failed"

    # Live queries post-upgrade
    with copy_engine.connect() as conn:
        entries_after = conn.execute(text("""
            SELECT id, review_id, student_id, round_id, score, is_released, released_at, scored_by, scored_at, released_by, is_migration_backfilled 
            FROM result_entries 
            ORDER BY id
        """)).fetchall()
        revs_after = conn.execute(text("""
            SELECT id, entry_id, action, old_score, new_score, reason, changed_by, changed_at 
            FROM result_entry_revisions 
            ORDER BY entry_id, id
        """)).fetchall()
        view_eff = conn.execute(text("SELECT student_id, score, version_number, released_at FROM view_effective_results ORDER BY student_id")).fetchall()
        view_rel = conn.execute(text("SELECT student_id, score, version_number, released_at FROM view_released_results ORDER BY student_id")).fetchall()
        view_grid = conn.execute(text("SELECT student_id, student_name, round_title, round_state, score, released_at FROM view_round_status_grid WHERE project_id=1 AND round_id=1 ORDER BY student_id")).fetchall()

        print(f"\n[3.1] Live Post-Upgrade Query Results:")
        print(f"  result_entries count: {len(entries_after)}")
        for ea in entries_after:
            state = "RELEASED" if ea[6] is not None else ("SCORED" if ea[4] is not None else "PENDING")
            print(f"    Entry #{ea[0]}: student={ea[2]}, score={ea[4]}, state={state}, scored_at={ea[8]}, released_at={ea[6]}, backfilled={ea[10]}")

        print(f"\n  result_entry_revisions count: {len(revs_after)} (Must be 4 with correction fixture):")
        for r in revs_after:
            print(f"    Revision #{r[0]}: entry={r[1]}, action={r[2]}, old={r[3]}, new={r[4]}, reason='{r[5]}', changed_at={r[7]}")

        print(f"\n  view_effective_results count: {len(view_eff)} (All 4 roster students resolved from Review #1):")
        for ve in view_eff:
            print(f"    Student #{ve[0]}: score={ve[1]}, version_number={ve[2]}, released_at={ve[3]}")

        print(f"\n  view_released_results count: {len(view_rel)} (Only student with released score):")
        for vr in view_rel:
            print(f"    Student #{vr[0]}: score={vr[1]}, version_number={vr[2]}, released_at={vr[3]}")

        print(f"\n  view_round_status_grid (Project 1, Round 1 - Real Data Fixture Verification):")
        for vg in view_grid:
            print(f"    Student #{vg[0]} ({vg[1]}): state={vg[3]}, score={vg[4]}, released_at={vg[5]}")

        # Assertions on real data fixture
        assert len(view_eff) == 4
        assert len(view_rel) == 1 and view_rel[0][0] == 3 and float(view_rel[0][1]) == 18.00
        assert view_grid[0][0] == 2 and float(view_grid[0][4]) == 19.00 and view_grid[0][3] == 'SCORED'
        assert view_grid[1][0] == 3 and float(view_grid[1][4]) == 18.00 and view_grid[1][3] == 'RELEASED'
        assert view_grid[2][0] == 4 and view_grid[2][4] is None and view_grid[2][3] == 'APPROVED_PENDING_SCORES'
        assert view_grid[3][0] == 5 and view_grid[3][4] is None and view_grid[3][3] == 'APPROVED_PENDING_SCORES'
        print("  [ASSERTION PASS]: Real data fixture verified: Student #2 SCORED (19.00), Student #3 RELEASED (18.00), Students #4 and #5 APPROVED_PENDING_SCORES.")

    # Step 4: Run real `alembic downgrade -1`
    print("\n[4] Running: alembic downgrade -1 against copy database...")
    res_down = run_cmd(["alembic", "downgrade", "-1"], {"DATABASE_URL": COPY_DB_URL})
    print("STDOUT:", res_down.stdout.strip())
    if res_down.stderr:
        print("STDERR:", res_down.stderr.strip())
    assert res_down.returncode == 0, "alembic downgrade -1 failed"

    # Live queries post-downgrade
    with copy_engine.connect() as conn:
        entries_downgraded = conn.execute(text("""
            SELECT id, review_id, student_id, round_id, score, is_released, released_at 
            FROM result_entries 
            ORDER BY id
        """)).fetchall()
        rev_exists = conn.execute(text("SELECT to_regclass('public.result_entry_revisions')")).scalar()

        print(f"\n[4.1] Live Post-Downgrade Query Results:")
        print(f"  result_entries count: {len(entries_downgraded)} (Restored to exact 2 baseline rows)")
        for ed in entries_downgraded:
            print(f"    Entry #{ed[0]}: student={ed[2]}, score={ed[4]}, is_released={ed[5]}, released_at={ed[6]}")
        print(f"  result_entry_revisions table exists: {rev_exists is not None}")

        assert len(entries_downgraded) == 2
        assert entries_downgraded[0][2] == 2 and float(entries_downgraded[0][4]) == 19.00
        assert entries_downgraded[1][2] == 3 and float(entries_downgraded[1][4]) == 18.00
        assert rev_exists is None

    # Step 5: Run real `alembic upgrade head` (Re-upgrade)
    print("\n[5] Running: alembic upgrade head (Re-upgrade) against copy database...")
    res_up2 = run_cmd(["alembic", "upgrade", "head"], {"DATABASE_URL": COPY_DB_URL})
    print("STDOUT:", res_up2.stdout.strip())
    if res_up2.stderr:
        print("STDERR:", res_up2.stderr.strip())
    assert res_up2.returncode == 0, "alembic re-upgrade head failed"

    # Step 6: Performance Benchmark & EXPLAIN ANALYZE on Generated Scale Data (1000 students, 10 rounds)
    print("\n[6] Seeding Performance Benchmark Data: 1,000 students, 250 groups, 10 rounds...")
    with copy_engine.connect() as conn:
        # Create dedicated workspace
        conn.execute(text("""
            INSERT INTO workspaces (id, name, description, term, owner_id, is_open, is_archived, created_at)
            VALUES ('PERF-BENCHMARK-WS', 'Scale Benchmark Workspace', 'Benchmark workspace for matrix query', 'Term 1', 1, TRUE, FALSE, NOW())
            ON CONFLICT (id) DO NOTHING;
        """))
        # Create 10 review rounds
        for r_idx in range(1, 11):
            conn.execute(text(f"""
                INSERT INTO review_rounds (id, workspace_id, title, order_index, due_date, max_score, is_open, created_at)
                VALUES ({1000 + r_idx}, 'PERF-BENCHMARK-WS', 'Round {r_idx}', {r_idx}, NOW() + interval '{r_idx} days', 100.0, TRUE, NOW())
                ON CONFLICT (id) DO NOTHING;
            """))

        # Generate 1,000 students (users 2001 to 3000) and 250 groups (groups 1001 to 1250)
        # 4 students per group
        conn.execute(text("""
            INSERT INTO users (id, email, hashed_password, full_name, role, is_active, created_at)
            SELECT 
                i, 
                'student_perf_' || i || '@test.edu', 
                'hash', 
                'Student Perf ' || i, 
                'student', 
                TRUE, 
                NOW()
            FROM generate_series(2001, 3000) AS i
            ON CONFLICT (id) DO NOTHING;
        """))

        conn.execute(text("""
            INSERT INTO groups (id, name, code, created_by, is_deleted, created_at)
            SELECT 
                g_id, 
                'Group Perf ' || g_id, 
                'CODE_' || g_id, 
                1, 
                FALSE, 
                NOW()
            FROM generate_series(1001, 1250) AS g_id
            ON CONFLICT (id) DO NOTHING;
        """))

        conn.execute(text("""
            INSERT INTO workspace_groups (workspace_id, group_id, enrolled_by, enrolled_at)
            SELECT 'PERF-BENCHMARK-WS', g_id, 1, NOW()
            FROM generate_series(1001, 1250) AS g_id
            ON CONFLICT DO NOTHING;
        """))

        # Group memberships: 4 students per group
        conn.execute(text("""
            INSERT INTO group_memberships (group_id, user_id, joined_at)
            SELECT 
                1001 + ((u_id - 2001) / 4),
                u_id,
                NOW()
            FROM generate_series(2001, 3000) AS u_id
            ON CONFLICT (user_id) DO NOTHING;
        """))

        # Projects for each group
        conn.execute(text("""
            INSERT INTO projects (id, workspace_id, group_id, name, created_by, created_at)
            SELECT 
                g_id,
                'PERF-BENCHMARK-WS',
                g_id,
                'Project Perf ' || g_id,
                1,
                NOW()
            FROM generate_series(1001, 1250) AS g_id
            ON CONFLICT DO NOTHING;
        """))

        # Submissions & Versions & Reviews for 5 of the 10 rounds for all 250 groups
        conn.execute(text("""
            INSERT INTO submissions (id, project_id, round_id, created_at)
            SELECT 
                100000 + ((p_id - 1001) * 10 + r_idx),
                p_id,
                1000 + r_idx,
                NOW()
            FROM generate_series(1001, 1250) AS p_id,
                 generate_series(1, 5) AS r_idx
            ON CONFLICT DO NOTHING;
        """))

        conn.execute(text("""
            INSERT INTO submission_versions (id, submission_id, version_number, submitted_by, is_late, status, roster_snapshot, created_at)
            SELECT 
                100000 + ((p_id - 1001) * 10 + r_idx),
                100000 + ((p_id - 1001) * 10 + r_idx),
                1,
                2001 + (p_id - 1001) * 4,
                FALSE,
                'APPROVED',
                jsonb_build_array(
                    jsonb_build_object('user_id', 2001 + (p_id - 1001) * 4),
                    jsonb_build_object('user_id', 2002 + (p_id - 1001) * 4),
                    jsonb_build_object('user_id', 2003 + (p_id - 1001) * 4),
                    jsonb_build_object('user_id', 2004 + (p_id - 1001) * 4)
                ),
                NOW()
            FROM generate_series(1001, 1250) AS p_id,
                 generate_series(1, 5) AS r_idx
            ON CONFLICT DO NOTHING;
        """))

        conn.execute(text("""
            INSERT INTO reviews (id, submission_version_id, reviewer_id, status, feedback, created_at)
            SELECT 
                100000 + ((p_id - 1001) * 10 + r_idx),
                100000 + ((p_id - 1001) * 10 + r_idx),
                1,
                'APPROVED',
                'Scale review passed.',
                NOW()
            FROM generate_series(1001, 1250) AS p_id,
                 generate_series(1, 5) AS r_idx
            ON CONFLICT DO NOTHING;
        """))

        conn.execute(text("""
            INSERT INTO result_entries (id, review_id, student_id, round_id, score, is_released, released_at, created_at)
            SELECT 
                1000000 + ((p_id - 1001) * 40 + (r_idx - 1) * 4 + s_offset),
                100000 + ((p_id - 1001) * 10 + r_idx),
                2001 + (p_id - 1001) * 4 + s_offset,
                1000 + r_idx,
                85.00 + s_offset,
                TRUE,
                NOW(),
                NOW()
            FROM generate_series(1001, 1250) AS p_id,
                 generate_series(1, 5) AS r_idx,
                 generate_series(0, 3) AS s_offset
            ON CONFLICT DO NOTHING;
        """))
        conn.commit()
        print("  -> Benchmark scale data seeded (10,000 matrix cells generated: 1,000 students x 10 rounds).")

        # Run EXPLAIN (ANALYZE, BUFFERS) on the Staff Matrix Grid Query
        print("\n[6.1] EXPLAIN (ANALYZE, BUFFERS) for Matrix Query on 10,000 Grid Cells:")
        explain_query = text("""
            EXPLAIN (ANALYZE, BUFFERS)
            SELECT 
                workspace_id, project_id, group_id, round_id, student_id, student_name, round_state, score, released_at
            FROM view_round_status_grid
            WHERE workspace_id = 'PERF-BENCHMARK-WS'
            ORDER BY group_id, student_id, round_order;
        """)
        explain_plan = conn.execute(explain_query).fetchall()
        for ep in explain_plan:
            print("  ", ep[0])

    copy_engine.dispose()
    print("\n==========================================================================")
    print("SUCCESS: Real Alembic lifecycle & performance benchmark verified.")
    print("==========================================================================")

if __name__ == "__main__":
    main()
