"""redesign_audit_activity_center

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-10-10 10:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text

# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    conn = op.get_bind()

    # 1. Add new columns to audit_logs
    op.add_column('audit_logs', sa.Column('category', sa.String(length=50), server_default='SYSTEM', nullable=False))
    op.add_column('audit_logs', sa.Column('status', sa.String(length=20), server_default='SUCCESS', nullable=False))
    op.add_column('audit_logs', sa.Column('action_name', sa.String(length=150), nullable=True))
    op.add_column('audit_logs', sa.Column('resource_type', sa.String(length=100), nullable=True))
    op.add_column('audit_logs', sa.Column('resource_name', sa.String(length=255), nullable=True))
    op.add_column('audit_logs', sa.Column('description', sa.Text(), nullable=True))
    op.add_column('audit_logs', sa.Column('error_reason', sa.Text(), nullable=True))
    op.add_column('audit_logs', sa.Column('request_id', sa.String(length=100), nullable=True))

    # 2. Populate resource_type from entity_type if null
    conn.execute(text("UPDATE audit_logs SET resource_type = entity_type WHERE resource_type IS NULL;"))

    # 3. Backfill categories and action names based on existing action_type
    conn.execute(text("""
        UPDATE audit_logs SET category = 'SECURITY', action_name = 'User Registration', description = 'User completed account registration'
        WHERE action_type = 'USER_REGISTERED';
    """))
    conn.execute(text("""
        UPDATE audit_logs SET category = 'SECURITY', action_name = 'User Login', description = 'User authenticated successfully'
        WHERE action_type = 'USER_LOGIN';
    """))
    conn.execute(text("""
        UPDATE audit_logs SET category = 'ACCESS', action_name = 'Member Joined Group', description = 'Student enrolled in group'
        WHERE action_type = 'MEMBER_JOINED';
    """))
    conn.execute(text("""
        UPDATE audit_logs SET category = 'ACCESS', action_name = 'Group Created', description = 'New student group registered'
        WHERE action_type = 'GROUP_CREATED';
    """))
    conn.execute(text("""
        UPDATE audit_logs SET category = 'WORKSPACE', action_name = 'Workspace Enrolled', description = 'Group enrolled into workspace'
        WHERE action_type = 'WORKSPACE_ENROLLED';
    """))
    conn.execute(text("""
        UPDATE audit_logs SET category = 'PROJECT', action_name = 'Project Created', description = 'New workspace project initiated'
        WHERE action_type = 'PROJECT_CREATED';
    """))
    conn.execute(text("""
        UPDATE audit_logs SET category = 'NOTICE', action_name = 'Notice Published', description = 'Faculty notice published to workspace board'
        WHERE action_type = 'notice_created';
    """))
    conn.execute(text("""
        UPDATE audit_logs SET category = 'NOTICE', action_name = 'Notice Pinned', description = 'Notice pinned to top of board'
        WHERE action_type = 'notice_pinned';
    """))
    conn.execute(text("""
        UPDATE audit_logs SET category = 'NOTICE', action_name = 'Notice Unpinned', description = 'Notice unpinned from top of board'
        WHERE action_type = 'notice_unpinned';
    """))
    conn.execute(text("""
        UPDATE audit_logs SET category = 'NOTICE', action_name = 'Notice Deleted', description = 'Notice deleted from workspace board'
        WHERE action_type = 'notice_deleted';
    """))
    conn.execute(text("""
        UPDATE audit_logs SET category = 'ACCESS', action_name = 'Co-Staff Removed', description = 'Faculty member removed from workspace staff'
        WHERE action_type = 'costaff_removed';
    """))
    conn.execute(text("""
        UPDATE audit_logs SET category = 'WORKSPACE', action_name = 'Workspace Archived', description = 'Workspace archived by owner'
        WHERE action_type = 'workspace_archived';
    """))
    conn.execute(text("""
        UPDATE audit_logs SET category = 'ASSESSMENT', action_name = 'Grade Corrected', description = 'Evaluation score corrected by staff'
        WHERE action_type = 'result_corrected';
    """))

    # Default remaining
    conn.execute(text("""
        UPDATE audit_logs SET action_name = action_type WHERE action_name IS NULL;
    """))

    # 4. Create performance indexes
    op.create_index('ix_audit_logs_category', 'audit_logs', ['category'])
    op.create_index('ix_audit_logs_status', 'audit_logs', ['status'])
    op.create_index('ix_audit_logs_resource_type', 'audit_logs', ['resource_type'])
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_audit_logs_category_created ON audit_logs(category, created_at DESC);"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_audit_logs_workspace_created ON audit_logs(workspace_id, created_at DESC);"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_audit_logs_status_created ON audit_logs(status, created_at DESC);"))

def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(text("DROP INDEX IF EXISTS ix_audit_logs_status_created;"))
    conn.execute(text("DROP INDEX IF EXISTS ix_audit_logs_workspace_created;"))
    conn.execute(text("DROP INDEX IF EXISTS ix_audit_logs_category_created;"))
    op.drop_index('ix_audit_logs_resource_type', table_name='audit_logs')
    op.drop_index('ix_audit_logs_status', table_name='audit_logs')
    op.drop_index('ix_audit_logs_category', table_name='audit_logs')
    op.drop_column('audit_logs', 'request_id')
    op.drop_column('audit_logs', 'error_reason')
    op.drop_column('audit_logs', 'description')
    op.drop_column('audit_logs', 'resource_name')
    op.drop_column('audit_logs', 'resource_type')
    op.drop_column('audit_logs', 'action_name')
    op.drop_column('audit_logs', 'status')
    op.drop_column('audit_logs', 'category')
