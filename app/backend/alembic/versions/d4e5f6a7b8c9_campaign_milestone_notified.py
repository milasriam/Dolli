"""campaign_milestone_notified — dedupe progress alerts per campaign

Revision ID: d4e5f6a7b8c9
Revises: b2c3d4e5f6a7
Create Date: 2026-04-10 22:45:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "campaign_milestone_notified",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("campaign_id", sa.Integer(), nullable=False),
        sa.Column("milestone_pct", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("campaign_id", "milestone_pct", name="uq_campaign_milestone_pct"),
    )
    op.create_index("ix_campaign_milestone_notified_campaign_id", "campaign_milestone_notified", ["campaign_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_campaign_milestone_notified_campaign_id", table_name="campaign_milestone_notified")
    op.drop_table("campaign_milestone_notified")
