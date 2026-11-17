"""add_administrator_role_and_department

Revision ID: g7h8i9j0k1l2
Revises: f6a7b8c9d0e1
Create Date: 2026-11-17 06:00:00.000000

Adds:
  - users.department   (VARCHAR 100, nullable)  — used by administrators for dept scoping
  - workspaces.department  (VARCHAR 100, nullable, indexed) — used to tag workspaces to a dept

The 'role' column already accepts any string value; 'administrator' is simply a new valid value.
No schema constraint change is needed for the role column itself.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'g7h8i9j0k1l2'
down_revision: Union[str, None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add department column to users table
    op.add_column(
        'users',
        sa.Column('department', sa.String(100), nullable=True)
    )
    op.create_index('ix_users_department', 'users', ['department'])

    # Add department column to workspaces table
    op.add_column(
        'workspaces',
        sa.Column('department', sa.String(100), nullable=True)
    )
    op.create_index('ix_workspaces_department', 'workspaces', ['department'])


def downgrade() -> None:
    op.drop_index('ix_workspaces_department', table_name='workspaces')
    op.drop_column('workspaces', 'department')

    op.drop_index('ix_users_department', table_name='users')
    op.drop_column('users', 'department')
