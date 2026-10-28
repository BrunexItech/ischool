"""daycare_and_playgroup_grades

Adds Daycare and Playgroup to the grade catalogue, ahead of PP1, for campuses (like an early-years site) that teach them.

Revision ID: i9f5a2d7b1e4
Revises: h8e4f1c6a0d3
Create Date: 2026-11-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'i9f5a2d7b1e4'
down_revision: Union[str, None] = 'h8e4f1c6a0d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW = [("DC", "Daycare", "PRE_PRIMARY", -1), ("PG", "Playgroup", "PRE_PRIMARY", 0)]


def upgrade() -> None:
    conn = op.get_bind()
    for code, name, group, order in NEW:
        exists = conn.execute(sa.text("SELECT 1 FROM grade_levels WHERE code = :c"), {"c": code}).first()
        if not exists:
            conn.execute(
                sa.text("INSERT INTO grade_levels (code, display_name, level_group, sort_order) VALUES (:c, :n, :g, :o)"),
                {"c": code, "n": name, "g": group, "o": order},
            )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DELETE FROM grade_levels WHERE code IN ('DC', 'PG')"))
