"""add_notice_expiration_and_storage

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-10-10 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text

# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    conn = op.get_bind()

    # Add image_key and thumbnail_url columns
    op.add_column('workspace_notices', sa.Column('image_key', sa.String(length=255), nullable=True))
    op.add_column('workspace_notices', sa.Column('thumbnail_url', sa.Text(), nullable=True))

    # Add expires_at column as nullable first to allow backfill
    op.add_column('workspace_notices', sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True))

    # Backfill expires_at for existing notices to 24h after created_at
    conn.execute(text("UPDATE workspace_notices SET expires_at = created_at + interval '24 hours' WHERE expires_at IS NULL;"))

    # Alter expires_at to NOT NULL
    op.alter_column('workspace_notices', 'expires_at', nullable=False)

    # Create index on expires_at for high-performance expiration queries
    op.create_index('ix_workspace_notices_expires_at', 'workspace_notices', ['expires_at'])

def downgrade() -> None:
    op.drop_index('ix_workspace_notices_expires_at', table_name='workspace_notices')
    op.drop_column('workspace_notices', 'expires_at')
    op.drop_column('workspace_notices', 'thumbnail_url')
    op.drop_column('workspace_notices', 'image_key')
