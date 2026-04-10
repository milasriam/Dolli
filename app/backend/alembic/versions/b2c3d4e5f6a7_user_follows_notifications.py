"""user_follows + user_notifications (creator subscriptions & inbox)

Revision ID: b2c3d4e5f6a7
Revises: 9f0e1d2c3b4a
Create Date: 2026-04-10 23:30:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, Sequence[str], None] = "9f0e1d2c3b4a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_follows",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("follower_id", sa.String(length=255), nullable=False),
        sa.Column("following_id", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("follower_id", "following_id", name="uq_user_follows_pair"),
    )
    op.create_index("ix_user_follows_follower_id", "user_follows", ["follower_id"], unique=False)
    op.create_index("ix_user_follows_following_id", "user_follows", ["following_id"], unique=False)

    op.create_table(
        "user_notifications",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=255), nullable=False),
        sa.Column("kind", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=512), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("campaign_id", sa.Integer(), nullable=True),
        sa.Column("actor_user_id", sa.String(length=255), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_user_notifications_user_id", "user_notifications", ["user_id"], unique=False)
    op.create_index("ix_user_notifications_campaign_id", "user_notifications", ["campaign_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_user_notifications_campaign_id", table_name="user_notifications")
    op.drop_index("ix_user_notifications_user_id", table_name="user_notifications")
    op.drop_table("user_notifications")
    op.drop_index("ix_user_follows_following_id", table_name="user_follows")
    op.drop_index("ix_user_follows_follower_id", table_name="user_follows")
    op.drop_table("user_follows")
