"""fee_structure

Revision ID: e5b1c8d3f7a9
Revises: d4a9b7c2e1f6
Create Date: 2026-10-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e5b1c8d3f7a9'
down_revision: Union[str, None] = 'd4a9b7c2e1f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "fee_structure_lines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("school_id", sa.Integer(), sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("term", sa.String(50), nullable=False),
        sa.Column("grade_level_id", sa.Integer(), sa.ForeignKey("grade_levels.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category", sa.String(30), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.UniqueConstraint("school_id", "term", "grade_level_id", "category", name="uq_fee_structure_line"),
    )


def downgrade() -> None:
    op.drop_table("fee_structure_lines")
