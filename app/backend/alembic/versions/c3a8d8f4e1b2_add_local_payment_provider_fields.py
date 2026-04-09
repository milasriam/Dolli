"""add local payment provider fields

Revision ID: c3a8d8f4e1b2
Revises: 1af5660b86f4
Create Date: 2026-04-09 17:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c3a8d8f4e1b2"
down_revision: Union[str, Sequence[str], None] = "1af5660b86f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("donations", sa.Column("payment_provider", sa.String(), nullable=True))
    op.add_column("donations", sa.Column("provider_invoice_id", sa.String(), nullable=True))
    op.add_column("donations", sa.Column("provider_reference", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("donations", "provider_reference")
    op.drop_column("donations", "provider_invoice_id")
    op.drop_column("donations", "payment_provider")
