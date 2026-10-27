"""announcement_target_roles

Revision ID: g7d3e0b5f9c2
Revises: f6c2d9a4e8b1
Create Date: 2026-10-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'g7d3e0b5f9c2'
down_revision: Union[str, None] = 'f6c2d9a4e8b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("announcements", sa.Column("target_roles", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("announcements", "target_roles")
