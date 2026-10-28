"""add_staff_progress_override_to_projects

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-10-29 01:25:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'projects',
        sa.Column('custom_progress', sa.Float(), nullable=True)
    )
    op.add_column(
        'projects',
        sa.Column('progress_updated_at', sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        'projects',
        sa.Column(
            'progress_updated_by',
            sa.Integer(),
            sa.ForeignKey('users.id', ondelete='SET NULL'),
            nullable=True
        )
    )


def downgrade() -> None:
    op.drop_constraint('fk_projects_progress_updated_by', 'projects', type_='foreignkey')
    op.drop_column('projects', 'progress_updated_by')
    op.drop_column('projects', 'progress_updated_at')
    op.drop_column('projects', 'custom_progress')
