"""sample_data_rows

Revision ID: h8e4f1c6a0d3
Revises: g7d3e0b5f9c2
Create Date: 2026-10-31 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'h8e4f1c6a0d3'
down_revision: Union[str, None] = 'g7d3e0b5f9c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sample_data_rows",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("school_id", sa.Integer(), sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("table_name", sa.String(80), nullable=False),
        sa.Column("row_id", sa.Integer(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("sample_data_rows")
