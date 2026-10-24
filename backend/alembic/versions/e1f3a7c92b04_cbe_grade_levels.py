"""cbe_grade_levels

Seeds the fixed national CBE grade catalogue (PP1 through Grade 12), adds
the per-school enabled-grades table, and adds school_classes.grade_level_id.

Existing school_classes.grade_level free-text values are best-effort mapped
to the new catalogue by normalized name match (case/space-insensitive,
common aliases like "G7"/"Grade 7"). Anything that doesn't confidently
match is left with grade_level_id = NULL and its original text preserved
in the legacy grade_level column — nothing is discarded.

Revision ID: e1f3a7c92b04
Revises: d8e4f6a21c90
Create Date: 2026-10-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1f3a7c92b04'
down_revision: Union[str, None] = 'd8e4f6a21c90'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

GRADES = [
    ("PP1", "PP1", "PRE_PRIMARY", 1, ["pp1", "preprimary1", "pre-primary1"]),
    ("PP2", "PP2", "PRE_PRIMARY", 2, ["pp2", "preprimary2", "pre-primary2"]),
    ("G1", "Grade 1", "PRIMARY", 3, ["grade1", "g1", "class1", "std1", "standard1"]),
    ("G2", "Grade 2", "PRIMARY", 4, ["grade2", "g2", "class2", "std2", "standard2"]),
    ("G3", "Grade 3", "PRIMARY", 5, ["grade3", "g3", "class3", "std3", "standard3"]),
    ("G4", "Grade 4", "PRIMARY", 6, ["grade4", "g4", "class4", "std4", "standard4"]),
    ("G5", "Grade 5", "PRIMARY", 7, ["grade5", "g5", "class5", "std5", "standard5"]),
    ("G6", "Grade 6", "PRIMARY", 8, ["grade6", "g6", "class6", "std6", "standard6"]),
    ("G7", "Grade 7", "JUNIOR_SCHOOL", 9, ["grade7", "g7", "form1", "form1a"]),
    ("G8", "Grade 8", "JUNIOR_SCHOOL", 10, ["grade8", "g8", "form2", "form2a"]),
    ("G9", "Grade 9", "JUNIOR_SCHOOL", 11, ["grade9", "g9", "form3", "form3a"]),
    ("G10", "Grade 10", "SENIOR_SCHOOL", 12, ["grade10", "g10", "form4", "form4a"]),
    ("G11", "Grade 11", "SENIOR_SCHOOL", 13, ["grade11", "g11"]),
    ("G12", "Grade 12", "SENIOR_SCHOOL", 14, ["grade12", "g12"]),
]


def upgrade() -> None:
    level_group_enum = sa.Enum("PRE_PRIMARY", "PRIMARY", "JUNIOR_SCHOOL", "SENIOR_SCHOOL", name="levelgroup")

    op.create_table(
        "grade_levels",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(10), nullable=False, unique=True),
        sa.Column("display_name", sa.String(50), nullable=False),
        sa.Column("level_group", level_group_enum, nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, unique=True),
    )

    op.create_table(
        "school_enabled_grades",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("school_id", sa.Integer(), sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("grade_level_id", sa.Integer(), sa.ForeignKey("grade_levels.id", ondelete="CASCADE"), nullable=False),
        sa.UniqueConstraint("school_id", "grade_level_id", name="uq_school_enabled_grade"),
    )

    op.add_column(
        "school_classes",
        sa.Column("grade_level_id", sa.Integer(), sa.ForeignKey("grade_levels.id", ondelete="SET NULL"), nullable=True),
    )

    conn = op.get_bind()
    grade_ids = {}
    for code, display_name, level_group, sort_order, _aliases in GRADES:
        result = conn.execute(
            sa.text(
                "INSERT INTO grade_levels (code, display_name, level_group, sort_order) "
                "VALUES (:code, :display_name, :level_group, :sort_order) RETURNING id"
            ),
            {"code": code, "display_name": display_name, "level_group": level_group, "sort_order": sort_order},
        )
        grade_ids[code] = result.scalar()

    # Best-effort mapping of existing free-text grade_level values.
    existing = conn.execute(sa.text("SELECT DISTINCT grade_level FROM school_classes WHERE grade_level IS NOT NULL")).fetchall()
    alias_to_code = {}
    for code, _name, _group, _order, aliases in GRADES:
        for alias in aliases:
            alias_to_code[alias] = code
        alias_to_code[code.lower()] = code

    for (raw_value,) in existing:
        normalized = raw_value.strip().lower().replace(" ", "").replace("-", "")
        matched_code = alias_to_code.get(normalized)
        if matched_code is not None:
            conn.execute(
                sa.text("UPDATE school_classes SET grade_level_id = :gid WHERE grade_level = :raw"),
                {"gid": grade_ids[matched_code], "raw": raw_value},
            )


def downgrade() -> None:
    op.drop_column("school_classes", "grade_level_id")
    op.drop_table("school_enabled_grades")
    op.drop_table("grade_levels")
    sa.Enum(name="levelgroup").drop(op.get_bind(), checkfirst=True)
