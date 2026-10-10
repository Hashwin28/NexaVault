"""results_individual_grading_and_roll_number

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-10-10 11:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text

# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    conn = op.get_bind()

    # 1. Add roll_number column to users table
    op.add_column('users', sa.Column('roll_number', sa.String(length=100), nullable=True))
    op.create_index('ix_users_roll_number', 'users', ['roll_number'])

    # 2. Backfill default roll_number from student email username
    conn.execute(text("""
        UPDATE users 
        SET roll_number = split_part(email, '@', 1) 
        WHERE role = 'student' AND (roll_number IS NULL OR roll_number = '');
    """))

    # 3. Add feedback column to result_entries table
    op.add_column('result_entries', sa.Column('feedback', sa.Text(), nullable=True))

    # 4. Safely backfill individual feedback from associated review feedback
    conn.execute(text("""
        UPDATE result_entries 
        SET feedback = reviews.feedback 
        FROM reviews 
        WHERE result_entries.review_id = reviews.id 
          AND result_entries.feedback IS NULL 
          AND reviews.feedback IS NOT NULL;
    """))

def downgrade() -> None:
    op.drop_column('result_entries', 'feedback')
    op.drop_index('ix_users_roll_number', table_name='users')
    op.drop_column('users', 'roll_number')
