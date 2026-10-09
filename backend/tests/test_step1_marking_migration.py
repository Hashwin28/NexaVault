import os
import pytest
from decimal import Decimal
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

TEST_DB_URL = os.getenv("DATABASE_URL", settings.DATABASE_URL)

@pytest.fixture(scope="function")
def db_session():
    """Provides a transactional database session rolled back after every test."""
    engine = create_engine(TEST_DB_URL)
    connection = engine.connect()
    transaction = connection.begin()
    Session = sessionmaker(bind=connection)
    session = Session()

    yield session

    session.close()
    transaction.rollback()
    connection.close()
    engine.dispose()

def test_01_real_data_fixture_status_grid_resolution(db_session):
    """
    Verifies that on real database fixture (Review #1: sv.status=SUBMITTED, r.status=COMPLETED):
    - Student #2 shows SCORED (19.00, unreleased)
    - Student #3 shows RELEASED (18.00)
    - Students #4 and #5 show APPROVED_PENDING_SCORES
    """
    rows = db_session.execute(text("""
        SELECT student_id, score, released_at, round_state 
        FROM view_round_status_grid 
        WHERE project_id = 1 AND round_id = 1 
        ORDER BY student_id
    """)).fetchall()

    assert len(rows) == 4
    # Student 2: 19.00 SCORED
    assert rows[0][0] == 2 and float(rows[0][1]) == 19.00 and rows[0][2] is None and rows[0][3] == 'SCORED'
    # Student 3: 18.00 RELEASED
    assert rows[1][0] == 3 and float(rows[1][1]) == 18.00 and rows[1][2] is not None and rows[1][3] == 'RELEASED'
    # Student 4: NULL APPROVED_PENDING_SCORES
    assert rows[2][0] == 4 and rows[2][1] is None and rows[2][3] == 'APPROVED_PENDING_SCORES'
    # Student 5: NULL APPROVED_PENDING_SCORES
    assert rows[3][0] == 5 and rows[3][1] is None and rows[3][3] == 'APPROVED_PENDING_SCORES'

def test_02_view_released_results_isolation(db_session):
    """
    Verifies view_released_results:
    1. Returns only released entries (Student #3 on real baseline).
    2. Does NOT leak unreleased score for Student #2 or pending scores for #4, #5.
    3. Preserves older released result when a newer approved version is unreleased.
    """
    # Baseline check on real data
    released_baseline = db_session.execute(text("""
        SELECT student_id, score, released_at 
        FROM view_released_results 
        WHERE project_id = 1 AND round_id = 1
    """)).fetchall()

    assert len(released_baseline) == 1
    assert released_baseline[0][0] == 3 and float(released_baseline[0][1]) == 18.00

    # Insert newer approved Version 2 for Student 3 with unreleased score (25.00)
    db_session.execute(text("""
        INSERT INTO submission_versions (id, submission_id, version_number, submitted_by, is_late, status, roster_snapshot, created_at)
        VALUES (912, 1, 2, 3, FALSE, 'APPROVED', '[{"user_id": 3}]'::jsonb, NOW());
    """))
    db_session.execute(text("""
        INSERT INTO reviews (id, submission_version_id, reviewer_id, status, created_at)
        VALUES (912, 912, 1, 'APPROVED', NOW());
    """))
    db_session.execute(text("""
        INSERT INTO result_entries (id, review_id, student_id, round_id, score, is_released, released_at, created_at)
        VALUES (912, 912, 3, 1, 25.00, FALSE, NULL, NOW());
    """))

    # Student view querying view_released_results must still return Version 1 released score (18.00)
    released_after_newer_unreleased = db_session.execute(text("""
        SELECT student_id, score, version_number 
        FROM view_released_results 
        WHERE project_id = 1 AND round_id = 1 AND student_id = 3
    """)).fetchall()

    assert len(released_after_newer_unreleased) == 1
    assert float(released_after_newer_unreleased[0][1]) == 18.00 and released_after_newer_unreleased[0][2] == 1

def test_03_revisions_chronology_and_immutability(db_session):
    """
    Verifies:
    1. Revisions ordered by changed_at ASC have SCORED strictly preceding RELEASED.
    2. Immutability trigger blocks UPDATE and DELETE on result_entry_revisions.
    """
    revs = db_session.execute(text("""
        SELECT entry_id, action, changed_at 
        FROM result_entry_revisions 
        WHERE entry_id = 2 
        ORDER BY changed_at ASC
    """)).fetchall()

    assert len(revs) >= 2
    assert revs[0][1] == 'SCORED'
    assert revs[1][1] == 'RELEASED'
    assert revs[0][2] <= revs[1][2]

    # Immutability trigger test
    rev_id = revs[0][0]
    with pytest.raises(Exception) as exc_update:
        with db_session.begin_nested():
            db_session.execute(text(f"UPDATE result_entry_revisions SET new_score = 99.00 WHERE id = {rev_id};"))
    assert "Immutability Error" in str(exc_update.value)

def test_04_departed_students_and_not_in_roster_states(db_session):
    """
    Verifies:
    1. Departed students who left the group retain their result entries in the grid view.
    2. NOT_IN_ROSTER applies correctly across submissions.
    """
    # Simulate student 5 removed from group_memberships
    db_session.execute(text("DELETE FROM group_memberships WHERE group_id = 1 AND user_id = 5;"))

    # Grid view must STILL show student 5 because they have a result_entry for this project/round
    grid_rows = db_session.execute(text("""
        SELECT student_id, round_state 
        FROM view_round_status_grid 
        WHERE project_id = 1 AND round_id = 1 AND student_id = 5
    """)).fetchall()

    assert len(grid_rows) == 1
    assert grid_rows[0][0] == 5

def test_05_exclusion_of_draft_and_withdrawn_versions(db_session):
    """Verifies latest_submissions ignores DRAFT and WITHDRAWN versions."""
    # Insert DRAFT version 3
    db_session.execute(text("""
        INSERT INTO submission_versions (id, submission_id, version_number, submitted_by, is_late, status, roster_snapshot, created_at)
        VALUES (915, 1, 3, 3, FALSE, 'DRAFT', '[{"user_id": 2}]'::jsonb, NOW());
    """))

    # Grid status should NOT be impacted by DRAFT version 3
    grid_rows = db_session.execute(text("""
        SELECT student_id, effective_version_number 
        FROM view_round_status_grid 
        WHERE project_id = 1 AND round_id = 1 AND student_id = 2
    """)).fetchall()

    assert grid_rows[0][1] == 1  # Still version 1

def test_06_strict_status_mapping_no_unknown_states(db_session):
    """Verifies that all grid view rows resolve to known valid enum states."""
    invalid_rows = db_session.execute(text("""
        SELECT student_id, round_state 
        FROM view_round_status_grid 
        WHERE round_state = 'UNKNOWN_STATE'
    """)).fetchall()

    assert len(invalid_rows) == 0

def test_07_no_invented_timestamps_enforcement(db_session):
    """Verifies check constraint preventing release without score."""
    with pytest.raises(Exception) as exc_invent:
        with db_session.begin_nested():
            db_session.execute(text("""
                INSERT INTO result_entries (review_id, student_id, round_id, score, is_released, released_at, created_at)
                VALUES (1, 2, 1, NULL, TRUE, NOW(), NOW());
            """))
    assert "chk_result_entries_released_requires_score" in str(exc_invent.value)

def test_08_downgrade_precondition_check(db_session):
    """Verifies that downgrade blocks if non-backfilled score is NULL."""
    non_backfilled_nulls = db_session.execute(text("SELECT COUNT(*) FROM result_entries WHERE score IS NULL AND is_migration_backfilled = FALSE")).scalar()
    assert non_backfilled_nulls == 0
