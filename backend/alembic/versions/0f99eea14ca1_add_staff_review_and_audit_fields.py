"""add_staff_review_and_audit_fields

Revision ID: 0f99eea14ca1
Revises: 907ca622fbff
Create Date: 2026-10-07 09:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0f99eea14ca1'
down_revision: Union[str, None] = '907ca622fbff'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Add claimed_by_id to submission_versions
    op.add_column('submission_versions', sa.Column('claimed_by_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True))
    op.create_index('ix_submission_versions_claimed_by_id', 'submission_versions', ['claimed_by_id'])

    # Add workspace_id to audit_logs
    op.add_column('audit_logs', sa.Column('workspace_id', sa.String(100), sa.ForeignKey('workspaces.id', ondelete='SET NULL'), nullable=True))
    op.create_index('ix_audit_logs_workspace_id', 'audit_logs', ['workspace_id'])

    # Create result_corrections table
    op.create_table(
        'result_corrections',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('result_entry_id', sa.Integer(), sa.ForeignKey('result_entries.id', ondelete='CASCADE'), nullable=False),
        sa.Column('corrected_by_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('old_score', sa.Numeric(6, 2), nullable=False),
        sa.Column('new_score', sa.Numeric(6, 2), nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_result_corrections_id', 'result_corrections', ['id'])
    op.create_index('ix_result_corrections_result_entry_id', 'result_corrections', ['result_entry_id'])
    op.create_index('ix_result_corrections_corrected_by_id', 'result_corrections', ['corrected_by_id'])

def downgrade() -> None:
    op.drop_table('result_corrections')
    op.drop_index('ix_audit_logs_workspace_id', table_name='audit_logs')
    op.drop_column('audit_logs', 'workspace_id')
    op.drop_index('ix_submission_versions_claimed_by_id', table_name='submission_versions')
    op.drop_column('submission_versions', 'claimed_by_id')
