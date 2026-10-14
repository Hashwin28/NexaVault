"""add_weight_to_review_rounds

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-10-14 09:20:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text

# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Add weight column to review_rounds table with default 20.0
    op.add_column(
        'review_rounds',
        sa.Column('weight', sa.Numeric(precision=5, scale=2), server_default='20.0', nullable=True)
    )

    # 2. Backfill existing records with default weight of 20.0
    conn.execute(text("""
        UPDATE review_rounds
        SET weight = 20.0
        WHERE weight IS NULL;
    """))


def downgrade() -> None:
    op.drop_column('review_rounds', 'weight')
