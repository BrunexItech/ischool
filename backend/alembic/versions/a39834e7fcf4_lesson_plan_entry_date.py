"""lesson_plan_entry_date

Revision ID: a39834e7fcf4
Revises: 20401be56c3c
Create Date: 2026-10-19 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a39834e7fcf4'
down_revision: Union[str, None] = '20401be56c3c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("lesson_plan_entries", sa.Column("scheduled_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("lesson_plan_entries", "scheduled_date")
