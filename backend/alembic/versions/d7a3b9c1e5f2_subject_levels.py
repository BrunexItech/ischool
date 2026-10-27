"""subject_levels

Revision ID: d7a3b9c1e5f2
Revises: c6f2a9b4d8e1
Create Date: 2026-10-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd7a3b9c1e5f2'
down_revision: Union[str, None] = 'c6f2a9b4d8e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "subject_levels",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("subject_id", sa.Integer(), sa.ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("grade_level_id", sa.Integer(), sa.ForeignKey("grade_levels.id", ondelete="CASCADE"), nullable=False),
        sa.UniqueConstraint("subject_id", "grade_level_id", name="uq_subject_level"),
    )


def downgrade() -> None:
    op.drop_table("subject_levels")
