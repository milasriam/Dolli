"""campaign gif and video url columns

Revision ID: e7b2a1c0d3e4
Revises: c3a8d8f4e1b2
Create Date: 2026-04-10 12:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e7b2a1c0d3e4"
down_revision: Union[str, Sequence[str], None] = "c3a8d8f4e1b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("campaigns", sa.Column("gif_url", sa.String(), nullable=True))
    op.add_column("campaigns", sa.Column("video_url", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("campaigns", "video_url")
    op.drop_column("campaigns", "gif_url")
