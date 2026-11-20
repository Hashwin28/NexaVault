"""seed_default_administrators

Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
Create Date: 2026-11-20 10:45:00.000000

Ensures baseline Administrator accounts are provisioned in the database:
- admin@nexavault.edu (Global Administrator, department=None)
- admin.cs@nexavault.edu (CS Department Administrator, department='CS')
"""
from typing import Sequence, Union
from datetime import datetime, timezone
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column
import bcrypt

# revision identifiers, used by Alembic.
revision: str = 'h8i9j0k1l2m3'
down_revision: Union[str, None] = 'g7h8i9j0k1l2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def hash_pwd(password: str) -> str:
    pwd_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')


def upgrade() -> None:
    conn = op.get_bind()

    users_tbl = table(
        'users',
        column('id', sa.Integer),
        column('email', sa.String),
        column('full_name', sa.String),
        column('hashed_password', sa.String),
        column('role', sa.String),
        column('department', sa.String),
        column('is_active', sa.Boolean),
        column('created_at', sa.DateTime(timezone=True)),
    )

    # 1. Global System Administrator
    res_global = conn.execute(
        sa.text("SELECT id, role, is_active FROM users WHERE email = 'admin@nexavault.edu'")
    ).fetchone()

    if not res_global:
        op.bulk_insert(
            users_tbl,
            [{
                'email': 'admin@nexavault.edu',
                'full_name': 'System Administrator',
                'hashed_password': hash_pwd('AdminVault2026!'),
                'role': 'administrator',
                'department': None,
                'is_active': True,
                'created_at': datetime.now(timezone.utc),
            }]
        )
    else:
        # Ensure role is administrator and account is active
        conn.execute(
            sa.text("UPDATE users SET role = 'administrator', is_active = true WHERE email = 'admin@nexavault.edu'")
        )

    # 2. CS Department Administrator
    res_cs = conn.execute(
        sa.text("SELECT id, role, is_active FROM users WHERE email = 'admin.cs@nexavault.edu'")
    ).fetchone()

    if not res_cs:
        op.bulk_insert(
            users_tbl,
            [{
                'email': 'admin.cs@nexavault.edu',
                'full_name': 'CS Department Admin',
                'hashed_password': hash_pwd('AdminVault2026!'),
                'role': 'administrator',
                'department': 'CS',
                'is_active': True,
                'created_at': datetime.now(timezone.utc),
            }]
        )
    else:
        conn.execute(
            sa.text("UPDATE users SET role = 'administrator', department = 'CS', is_active = true WHERE email = 'admin.cs@nexavault.edu'")
        )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text("DELETE FROM users WHERE email IN ('admin@nexavault.edu', 'admin.cs@nexavault.edu')")
    )
