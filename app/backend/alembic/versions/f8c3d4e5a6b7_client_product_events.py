"""client product events for web analytics

Revision ID: f8c3d4e5a6b7
Revises: e7b2a1c0d3e4
Create Date: 2026-04-10 14:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f8c3d4e5a6b7"
down_revision: Union[str, Sequence[str], None] = "e7b2a1c0d3e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "client_product_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("event", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_client_product_events_created_at", "client_product_events", ["created_at"])
    op.create_index("ix_client_product_events_event", "client_product_events", ["event"])
    op.create_index("ix_client_product_events_user_id", "client_product_events", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_client_product_events_user_id", table_name="client_product_events")
    op.drop_index("ix_client_product_events_event", table_name="client_product_events")
    op.drop_index("ix_client_product_events_created_at", table_name="client_product_events")
    op.drop_table("client_product_events")
