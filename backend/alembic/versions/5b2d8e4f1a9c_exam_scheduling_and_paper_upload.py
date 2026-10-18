"""exam_scheduling_and_paper_upload

Revision ID: 5b2d8e4f1a9c
Revises: 3e8f2a9d1c7b
Create Date: 2026-10-18 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5b2d8e4f1a9c'
down_revision: Union[str, None] = '3e8f2a9d1c7b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("exams", sa.Column("opens_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("exams", sa.Column("closes_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("exams", sa.Column("paper_file_url", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("exams", "paper_file_url")
    op.drop_column("exams", "closes_at")
    op.drop_column("exams", "opens_at")
