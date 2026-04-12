"""users.password_hash + magic_login_tokens for email auth

Revision ID: e1f2a3b4c5d6
Revises: d4e5f6a7b8c9
Create Date: 2026-04-12 14:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e1f2a3b4c5d6"
down_revision: Union[str, Sequence[str], None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("password_hash", sa.String(length=255), nullable=True))
    op.create_table(
        "magic_login_tokens",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_magic_login_tokens_token_hash", "magic_login_tokens", ["token_hash"], unique=True)
    op.create_index("ix_magic_login_tokens_user_id", "magic_login_tokens", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_magic_login_tokens_user_id", table_name="magic_login_tokens")
    op.drop_index("ix_magic_login_tokens_token_hash", table_name="magic_login_tokens")
    op.drop_table("magic_login_tokens")
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("password_hash")
