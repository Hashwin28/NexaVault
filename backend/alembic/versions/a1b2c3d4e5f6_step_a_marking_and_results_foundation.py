"""step_a_marking_and_results_foundation

Revision ID: a1b2c3d4e5f6
Revises: 0f99eea14ca1
Create Date: 2026-10-09 16:25:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '0f99eea14ca1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    conn = op.get_bind()

    # ----------------------------------------------------------------------
    # 1. Schema Alterations on result_entries
    # ----------------------------------------------------------------------
    op.alter_column('result_entries', 'score', existing_type=sa.Numeric(6, 2), nullable=True)
    
    op.add_column('result_entries', sa.Column('scored_by', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True))
    op.add_column('result_entries', sa.Column('scored_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('result_entries', sa.Column('released_by', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True))
    op.add_column('result_entries', sa.Column('is_migration_backfilled', sa.Boolean(), server_default=sa.text('FALSE'), nullable=False))

    # Ensure index & check constraints
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_result_entries_student_id ON result_entries(student_id);"))
    op.create_check_constraint('chk_result_entries_score_non_negative', 'result_entries', 'score >= 0')
    op.create_check_constraint('chk_result_entries_released_requires_score', 'result_entries', 'released_at IS NULL OR score IS NOT NULL')

    # ----------------------------------------------------------------------
    # 2. Strict Timestamp Validation (No Invented Timestamps)
    # ----------------------------------------------------------------------
    invented_ts = conn.execute(text("""
        SELECT COUNT(*) FROM result_entries 
        WHERE is_released = TRUE AND released_at IS NULL;
    """)).scalar()

    if invented_ts > 0:
        raise Exception(f"Migration Aborted: Found {invented_ts} result entries with is_released = TRUE but NULL released_at. Invented timestamps are strictly prohibited.")

    # Chronological provenance: scored_at is set to LEAST(created_at, released_at)
    conn.execute(text("""
        UPDATE result_entries 
        SET scored_at = LEAST(created_at, COALESCE(released_at, created_at)) 
        WHERE score IS NOT NULL AND scored_at IS NULL;
    """))

    # ----------------------------------------------------------------------
    # 3. Create result_entry_revisions Table & Immutability Trigger
    # ----------------------------------------------------------------------
    op.create_table(
        'result_entry_revisions',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('entry_id', sa.Integer(), sa.ForeignKey('result_entries.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('action', sa.String(20), nullable=False),
        sa.Column('old_score', sa.Numeric(6, 2), nullable=True),
        sa.Column('new_score', sa.Numeric(6, 2), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('changed_by', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('changed_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.CheckConstraint("action IN ('SCORED', 'RELEASED', 'CORRECTED')", name='chk_revision_action')
    )
    op.create_index('ix_result_entry_revisions_entry_changed', 'result_entry_revisions', ['entry_id', 'changed_at'])

    # Immutability trigger for audit revisions
    conn.execute(text("""
        CREATE OR REPLACE FUNCTION fn_prevent_result_entry_revisions_mutation()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION 'Immutability Error: result_entry_revisions rows cannot be updated or deleted.';
        END;
        $$ LANGUAGE plpgsql;
    """))
    conn.execute(text("""
        CREATE TRIGGER trg_prevent_result_entry_revisions_mutation
        BEFORE UPDATE OR DELETE ON result_entry_revisions
        FOR EACH ROW
        EXECUTE FUNCTION fn_prevent_result_entry_revisions_mutation();
    """))

    # ----------------------------------------------------------------------
    # 4. Fail-Closed Round Consistency Trigger on result_entries
    # ----------------------------------------------------------------------
    conn.execute(text("""
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
    conn.execute(text("""
        CREATE TRIGGER trg_verify_result_entry_round
        BEFORE INSERT OR UPDATE OF round_id, review_id ON result_entries
        FOR EACH ROW
        EXECUTE FUNCTION fn_verify_result_entry_round();
    """))

    # ----------------------------------------------------------------------
    # 5. History Chain Migration with Strict Chronological Ordering
    # ----------------------------------------------------------------------
    # 5A: Baseline SCORED revisions:
    # If entry has legacy corrections, baseline new_score = earliest correction's old_score.
    # Otherwise, baseline new_score = current score.
    # Changed_at is strictly earlier than released_at and any corrections.
    conn.execute(text("""
        WITH earliest_corrections AS (
            SELECT DISTINCT ON (result_entry_id)
                result_entry_id,
                old_score,
                created_at
            FROM result_corrections
            ORDER BY result_entry_id, created_at ASC, id ASC
        )
        INSERT INTO result_entry_revisions (entry_id, action, old_score, new_score, reason, changed_by, changed_at)
        SELECT 
            re.id,
            'SCORED',
            NULL,
            COALESCE(ec.old_score, re.score),
            'Initial baseline scoring (timestamp fallback to created_at; actor unproven)',
            NULL,
            CASE 
                WHEN ec.created_at IS NOT NULL THEN ec.created_at - interval '1 second'
                WHEN re.released_at IS NOT NULL AND re.released_at <= re.scored_at THEN re.released_at - interval '1 second'
                ELSE COALESCE(re.scored_at, re.created_at)
            END
        FROM result_entries re
        LEFT JOIN earliest_corrections ec ON ec.result_entry_id = re.id
        WHERE re.score IS NOT NULL
        ORDER BY re.id;
    """))

    # 5B: Insert CORRECTED revisions from result_corrections (ordered chronologically)
    conn.execute(text("""
        INSERT INTO result_entry_revisions (entry_id, action, old_score, new_score, reason, changed_by, changed_at)
        SELECT result_entry_id, 'CORRECTED', old_score, new_score, reason, corrected_by_id, created_at
        FROM result_corrections
        ORDER BY created_at ASC, id ASC;
    """))

    # 5C: Insert baseline RELEASED revisions (authentic released_at)
    conn.execute(text("""
        INSERT INTO result_entry_revisions (entry_id, action, old_score, new_score, reason, changed_by, changed_at)
        SELECT re.id, 'RELEASED', re.score, re.score, 'Initial baseline release (authentic release timestamp; actor unproven)', NULL, re.released_at
        FROM result_entries re
        WHERE re.released_at IS NOT NULL
        ORDER BY re.id;
    """))

    # 5D: Validate History Chain Integrity (Each scored entry must end at current score)
    chain_mismatches = conn.execute(text("""
        WITH latest_score_revisions AS (
            SELECT DISTINCT ON (entry_id)
                entry_id,
                new_score
            FROM result_entry_revisions
            WHERE action IN ('SCORED', 'CORRECTED')
            ORDER BY entry_id, changed_at DESC, id DESC
        )
        SELECT re.id, re.score, lsr.new_score
        FROM result_entries re
        JOIN latest_score_revisions lsr ON re.id = lsr.entry_id
        WHERE re.score IS NOT NULL AND re.score <> lsr.new_score;
    """)).fetchall()

    if chain_mismatches:
        raise Exception(f"Migration Aborted: Revision history chain mismatch for entries: {chain_mismatches}")

    # ----------------------------------------------------------------------
    # 6. Strict Roster Backfill (Fails if any student_id resolves to NULL)
    # ----------------------------------------------------------------------
    invalid_roster = conn.execute(text("""
        SELECT sv.id, sv.submission_id, member
        FROM submission_versions sv,
             jsonb_array_elements(sv.roster_snapshot::jsonb) member
        WHERE sv.status NOT IN ('REVISION_REQUESTED', 'WITHDRAWN', 'DRAFT')
          AND sv.roster_snapshot IS NOT NULL
          AND jsonb_typeof(sv.roster_snapshot::jsonb) = 'array'
          AND (member->>'user_id') IS NULL 
          AND (member->>'id') IS NULL;
    """)).fetchall()

    if invalid_roster:
        raise Exception(f"Migration Aborted: Roster snapshot member has NULL student_id in versions: {invalid_roster}")

    conn.execute(text("""
        WITH roster_unpivoted AS (
            SELECT 
                r.id AS review_id,
                sub.round_id AS round_id,
                COALESCE(
                    (member->>'user_id')::integer,
                    (member->>'id')::integer
                ) AS student_id
            FROM submission_versions sv
            CROSS JOIN LATERAL jsonb_array_elements(sv.roster_snapshot::jsonb) AS member
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

    # ----------------------------------------------------------------------
    # 7. Database Views (Authoritative Shared Resolvers)
    # ----------------------------------------------------------------------
    # View 1: Effective Result (Latest APPROVED entry per project, round, student)
    conn.execute(text("""
        CREATE OR REPLACE VIEW view_effective_results AS
        WITH ranked_entries AS (
            SELECT 
                s.project_id,
                s.round_id,
                re.student_id,
                re.id AS result_entry_id,
                re.score,
                re.scored_by,
                re.scored_at,
                re.released_by,
                re.released_at,
                re.review_id,
                sv.id AS submission_version_id,
                sv.version_number,
                r.feedback AS review_feedback,
                ROW_NUMBER() OVER (
                    PARTITION BY s.project_id, s.round_id, re.student_id
                    ORDER BY sv.version_number DESC, sv.id DESC
                ) AS rn
            FROM result_entries re
            JOIN reviews r ON re.review_id = r.id
            JOIN submission_versions sv ON r.submission_version_id = sv.id
            JOIN submissions s ON sv.submission_id = s.id
            WHERE (
                (sv.status = 'APPROVED' AND r.status = 'APPROVED')
                OR (sv.status = 'SUBMITTED' AND r.status = 'COMPLETED')
            )
        )
        SELECT 
            project_id,
            round_id,
            student_id,
            result_entry_id,
            score,
            scored_by,
            scored_at,
            released_by,
            released_at,
            review_id,
            submission_version_id,
            version_number,
            review_feedback
        FROM ranked_entries
        WHERE rn = 1;
    """))

    # View 2: Released Results (Latest RELEASED entry per project, round, student for student endpoints)
    conn.execute(text("""
        CREATE OR REPLACE VIEW view_released_results AS
        WITH ranked_released_entries AS (
            SELECT 
                s.project_id,
                s.round_id,
                re.student_id,
                re.id AS result_entry_id,
                re.score,
                re.scored_by,
                re.scored_at,
                re.released_by,
                re.released_at,
                re.review_id,
                sv.id AS submission_version_id,
                sv.version_number,
                r.feedback AS review_feedback,
                ROW_NUMBER() OVER (
                    PARTITION BY s.project_id, s.round_id, re.student_id
                    ORDER BY sv.version_number DESC, sv.id DESC
                ) AS rn
            FROM result_entries re
            JOIN reviews r ON re.review_id = r.id
            JOIN submission_versions sv ON r.submission_version_id = sv.id
            JOIN submissions s ON sv.submission_id = s.id
            WHERE (
                (sv.status = 'APPROVED' AND r.status = 'APPROVED')
                OR (sv.status = 'SUBMITTED' AND r.status = 'COMPLETED')
            )
              AND re.score IS NOT NULL
              AND re.released_at IS NOT NULL
        )
        SELECT 
            project_id,
            round_id,
            student_id,
            result_entry_id,
            score,
            scored_by,
            scored_at,
            released_by,
            released_at,
            review_id,
            submission_version_id,
            version_number,
            review_feedback
        FROM ranked_released_entries
        WHERE rn = 1;
    """))

    # View 3: Round Status Grid (Every group member + departed student x workspace round)
    conn.execute(text("""
        CREATE OR REPLACE VIEW view_round_status_grid AS
        WITH project_students AS (
            -- Currently enrolled group members in non-deleted groups and active workspace enrollments
            SELECT 
                p.id AS project_id,
                p.name AS project_name,
                p.group_id,
                p.workspace_id,
                rr.id AS round_id,
                rr.title AS round_title,
                rr.order_index AS round_order,
                rr.max_score AS round_max_score,
                gm.user_id AS student_id,
                u.full_name AS student_name,
                u.email AS student_email
            FROM projects p
            JOIN groups g ON p.group_id = g.id AND g.is_deleted = FALSE
            JOIN workspace_groups wg ON wg.workspace_id = p.workspace_id AND wg.group_id = p.group_id
            JOIN review_rounds rr ON rr.workspace_id = p.workspace_id
            JOIN group_memberships gm ON gm.group_id = p.group_id
            JOIN users u ON gm.user_id = u.id

            UNION

            -- Students who departed the group but have historical result entries for this project/round
            SELECT 
                p.id AS project_id,
                p.name AS project_name,
                p.group_id,
                p.workspace_id,
                rr.id AS round_id,
                rr.title AS round_title,
                rr.order_index AS round_order,
                rr.max_score AS round_max_score,
                re.student_id,
                u.full_name AS student_name,
                u.email AS student_email
            FROM result_entries re
            JOIN reviews r ON re.review_id = r.id
            JOIN submission_versions sv ON r.submission_version_id = sv.id
            JOIN submissions s ON sv.submission_id = s.id
            JOIN projects p ON s.project_id = p.id
            JOIN groups g ON p.group_id = g.id AND g.is_deleted = FALSE
            JOIN workspace_groups wg ON wg.workspace_id = p.workspace_id AND wg.group_id = p.group_id
            JOIN review_rounds rr ON s.round_id = rr.id
            JOIN users u ON re.student_id = u.id
        ),
        latest_submissions AS (
            SELECT DISTINCT ON (s.project_id, s.round_id)
                s.id AS submission_id,
                s.project_id,
                s.round_id,
                sv.id AS submission_version_id,
                sv.version_number,
                sv.status AS version_status,
                sv.roster_snapshot,
                r.id AS review_id,
                r.status AS review_status
            FROM submissions s
            JOIN submission_versions sv ON sv.submission_id = s.id
            LEFT JOIN reviews r ON r.submission_version_id = sv.id
            WHERE sv.status NOT IN ('DRAFT', 'WITHDRAWN')
            ORDER BY s.project_id, s.round_id, sv.version_number DESC, sv.id DESC
        )
        SELECT 
            ps.workspace_id,
            ps.project_id,
            ps.group_id,
            ps.round_id,
            ps.round_title,
            ps.round_order,
            ps.round_max_score,
            ps.student_id,
            ps.student_name,
            ps.student_email,
            ver.result_entry_id,
            ver.score,
            ver.released_at,
            ver.scored_at,
            ver.version_number AS effective_version_number,
            ver.review_feedback,
            CASE
                WHEN ls.submission_id IS NULL THEN 'NOT_SUBMITTED'
                WHEN ls.roster_snapshot IS NOT NULL AND NOT EXISTS (
                    SELECT 1 FROM jsonb_array_elements(ls.roster_snapshot::jsonb) member
                    WHERE COALESCE((member->>'user_id')::integer, (member->>'id')::integer) = ps.student_id
                ) THEN 'NOT_IN_ROSTER'
                WHEN ls.version_status = 'REVISION_REQUESTED' OR ls.review_status = 'REVISION_REQUESTED' THEN 'REVISION_REQUESTED'
                WHEN ls.version_status = 'IN_REVIEW' OR ls.review_status = 'IN_REVIEW' THEN 'IN_REVIEW'
                WHEN ls.version_status = 'SUBMITTED' AND (ls.review_status IS NULL OR ls.review_status = 'NEW_SUBMISSION') THEN 'SUBMITTED'
                WHEN (ls.version_status = 'APPROVED' AND ls.review_status = 'APPROVED')
                  OR (ls.version_status = 'SUBMITTED' AND ls.review_status = 'COMPLETED') THEN
                    CASE
                        WHEN ver.result_entry_id IS NULL THEN 'NOT_IN_ROSTER'
                        WHEN ver.score IS NULL THEN 'APPROVED_PENDING_SCORES'
                        WHEN ver.released_at IS NULL THEN 'SCORED'
                        ELSE 'RELEASED'
                    END
                ELSE 'UNKNOWN_STATE'
            END AS round_state
        FROM project_students ps
        LEFT JOIN latest_submissions ls ON ps.project_id = ls.project_id AND ps.round_id = ls.round_id
        LEFT JOIN view_effective_results ver ON ps.project_id = ver.project_id AND ps.round_id = ver.round_id AND ps.student_id = ver.student_id;
    """))

def downgrade() -> None:
    conn = op.get_bind()

    # ----------------------------------------------------------------------
    # Downgrade Precondition: Block if ANY result_entries.score IS NULL
    # (Note: Once Step 2 is deployed, rollback requires restoring a backup/Neon branch)
    # ----------------------------------------------------------------------
    null_scores = conn.execute(text("SELECT COUNT(*) FROM result_entries WHERE score IS NULL")).scalar()
    if null_scores > 0:
        non_backfilled_nulls = conn.execute(text("SELECT COUNT(*) FROM result_entries WHERE score IS NULL AND is_migration_backfilled = FALSE")).scalar()
        if non_backfilled_nulls > 0:
            raise Exception(f"Downgrade Blocked: Found {non_backfilled_nulls} non-backfilled NULL scores. Rollback requires restoring a database backup or Neon branch.")
    
    # ----------------------------------------------------------------------
    # Drop Database Views
    # ----------------------------------------------------------------------
    conn.execute(text("DROP VIEW IF EXISTS view_round_status_grid CASCADE;"))
    conn.execute(text("DROP VIEW IF EXISTS view_released_results CASCADE;"))
    conn.execute(text("DROP VIEW IF EXISTS view_effective_results CASCADE;"))

    # ----------------------------------------------------------------------
    # Drop Triggers and Functions
    # ----------------------------------------------------------------------
    conn.execute(text("DROP TRIGGER IF EXISTS trg_prevent_result_entry_revisions_mutation ON result_entry_revisions;"))
    conn.execute(text("DROP FUNCTION IF EXISTS fn_prevent_result_entry_revisions_mutation();"))

    conn.execute(text("DROP TRIGGER IF EXISTS trg_verify_result_entry_round ON result_entries;"))
    conn.execute(text("DROP FUNCTION IF EXISTS fn_verify_result_entry_round();"))

    # ----------------------------------------------------------------------
    # Delete Unscored Backfilled Entries
    # ----------------------------------------------------------------------
    conn.execute(text("DELETE FROM result_entries WHERE is_migration_backfilled = TRUE AND score IS NULL;"))

    # ----------------------------------------------------------------------
    # Drop Revisions Table
    # ----------------------------------------------------------------------
    op.drop_table('result_entry_revisions')

    # ----------------------------------------------------------------------
    # Drop Added Constraints and Columns
    # ----------------------------------------------------------------------
    op.drop_constraint('chk_result_entries_released_requires_score', 'result_entries', type_='check')
    op.drop_constraint('chk_result_entries_score_non_negative', 'result_entries', type_='check')

    op.drop_column('result_entries', 'is_migration_backfilled')
    op.drop_column('result_entries', 'released_by')
    op.drop_column('result_entries', 'scored_at')
    op.drop_column('result_entries', 'scored_by')

    # Restore NOT NULL constraint on score
    op.alter_column('result_entries', 'score', existing_type=sa.Numeric(6, 2), nullable=False)
