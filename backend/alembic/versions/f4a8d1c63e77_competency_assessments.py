"""competency_assessments

Adds competency_assessments (the PP1/PP2 alternative to a numeric Result,
using the four official KSRAT performance levels) and observation_notes
(a dated, appendable teacher observation log). Purely additive — no
existing table or column is touched.

Revision ID: f4a8d1c63e77
Revises: e1f3a7c92b04
Create Date: 2026-10-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f4a8d1c63e77'
down_revision: Union[str, None] = 'e1f3a7c92b04'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    performance_level_enum = sa.Enum(
        "exceeding_expectation", "meeting_expectation", "approaching_expectation", "below_expectation",
        name="performancelevel",
    )

    op.create_table(
        "competency_assessments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("school_id", sa.Integer(), sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False),
        sa.Column("class_id", sa.Integer(), sa.ForeignKey("school_classes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("subject_id", sa.Integer(), sa.ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("teacher_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("term", sa.String(50), nullable=False),
        sa.Column("strand", sa.String(255), nullable=False),
        sa.Column("sub_strand", sa.String(255), nullable=True),
        sa.Column("criterion", sa.Text(), nullable=False),
        sa.Column("performance_level", performance_level_enum, nullable=False),
        sa.Column("assessment_date", sa.Date(), nullable=False),
        sa.Column("teacher_comment", sa.Text(), nullable=True),
        sa.Column("follow_up_action", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "observation_notes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("school_id", sa.Integer(), sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False),
        sa.Column("class_id", sa.Integer(), sa.ForeignKey("school_classes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("teacher_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("subject_id", sa.Integer(), sa.ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True),
        sa.Column("strand", sa.String(255), nullable=True),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("noted_on", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("observation_notes")
    op.drop_table("competency_assessments")
    sa.Enum(name="performancelevel").drop(op.get_bind(), checkfirst=True)
