"""weekly_menu

Revision ID: b2e7f5a9c3d6
Revises: a1d6e4f8b2c5
Create Date: 2026-10-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b2e7f5a9c3d6'
down_revision: Union[str, None] = 'a1d6e4f8b2c5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "meal_times",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("school_id", sa.Integer(), sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(60), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("audience", sa.String(10), nullable=False, server_default="all"),
    )
    op.create_index("ix_meal_times_school", "meal_times", ["school_id"])
    op.create_table(
        "weekly_menu_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("meal_time_id", sa.Integer(), sa.ForeignKey("meal_times.id", ondelete="CASCADE"), nullable=False),
        sa.Column("weekday", sa.Integer(), nullable=False),
        sa.Column("description", sa.String(1000), nullable=False),
        sa.UniqueConstraint("meal_time_id", "weekday", name="uq_weekly_menu_item"),
    )


def downgrade() -> None:
    op.drop_table("weekly_menu_items")
    op.drop_index("ix_meal_times_school", table_name="meal_times")
    op.drop_table("meal_times")
