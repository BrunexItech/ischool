"""grading_bands

Adds grading_bands (configurable score-to-CBC-level bands, replacing the
hardcoded A-E percentage scale) and seeds the default four bands
(EE 80-100, ME 50-79, AE 30-49, BE 0-29) for every existing school, so
nothing breaks for schools that haven't visited the new settings yet.

Revision ID: a3c7f9e21b56
Revises: f4a8d1c63e77
Create Date: 2026-10-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3c7f9e21b56'
down_revision: Union[str, None] = 'f4a8d1c63e77'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_BANDS = [
    ("EE", "Exceeding Expectation", 80, 100, 4, 1),
    ("ME", "Meeting Expectation", 50, 79, 3, 2),
    ("AE", "Approaching Expectation", 30, 49, 2, 3),
    ("BE", "Below Expectation", 0, 29, 1, 4),
]


def upgrade() -> None:
    op.create_table(
        "grading_bands",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("school_id", sa.Integer(), sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("level_code", sa.String(10), nullable=False),
        sa.Column("label", sa.String(50), nullable=False),
        sa.Column("min_score", sa.Numeric(5, 2), nullable=False),
        sa.Column("max_score", sa.Numeric(5, 2), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
    )

    conn = op.get_bind()
    school_ids = [row[0] for row in conn.execute(sa.text("SELECT id FROM schools")).fetchall()]
    for school_id in school_ids:
        for level_code, label, min_score, max_score, points, sort_order in DEFAULT_BANDS:
            conn.execute(
                sa.text(
                    "INSERT INTO grading_bands (school_id, level_code, label, min_score, max_score, points, sort_order) "
                    "VALUES (:school_id, :level_code, :label, :min_score, :max_score, :points, :sort_order)"
                ),
                {
                    "school_id": school_id, "level_code": level_code, "label": label,
                    "min_score": min_score, "max_score": max_score, "points": points, "sort_order": sort_order,
                },
            )


def downgrade() -> None:
    op.drop_table("grading_bands")
