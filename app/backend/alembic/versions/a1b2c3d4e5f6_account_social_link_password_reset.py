"""account: social link columns, oidc link_user_id, password_reset_tokens

Revision ID: a1b2c3d4e5f6
Revises: e1f2a3b4c5d6
Create Date: 2026-04-10 16:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "e1f2a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("oidc_states", sa.Column("link_user_id", sa.String(length=255), nullable=True))
    op.create_index("ix_oidc_states_link_user_id", "oidc_states", ["link_user_id"], unique=False)

    op.add_column("users", sa.Column("tiktok_linked_open_id", sa.String(length=64), nullable=True))
    op.add_column("users", sa.Column("tiktok_linked_display_name", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("meta_linked_user_id", sa.String(length=64), nullable=True))
    op.add_column("users", sa.Column("meta_linked_display_name", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("instagram_handle", sa.String(length=120), nullable=True))
    op.create_index("ix_users_tiktok_linked_open_id", "users", ["tiktok_linked_open_id"], unique=True)
    op.create_index("ix_users_meta_linked_user_id", "users", ["meta_linked_user_id"], unique=True)

    op.create_table(
        "password_reset_tokens",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_password_reset_tokens_token_hash", "password_reset_tokens", ["token_hash"], unique=True)
    op.create_index("ix_password_reset_tokens_user_id", "password_reset_tokens", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_password_reset_tokens_user_id", table_name="password_reset_tokens")
    op.drop_index("ix_password_reset_tokens_token_hash", table_name="password_reset_tokens")
    op.drop_table("password_reset_tokens")

    op.drop_index("ix_users_meta_linked_user_id", table_name="users")
    op.drop_index("ix_users_tiktok_linked_open_id", table_name="users")
    op.drop_column("users", "instagram_handle")
    op.drop_column("users", "meta_linked_display_name")
    op.drop_column("users", "meta_linked_user_id")
    op.drop_column("users", "tiktok_linked_display_name")
    op.drop_column("users", "tiktok_linked_open_id")

    op.drop_index("ix_oidc_states_link_user_id", table_name="oidc_states")
    op.drop_column("oidc_states", "link_user_id")
