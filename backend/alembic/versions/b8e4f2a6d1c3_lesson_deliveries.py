"""lesson_deliveries

The dated Record of Work Covered: what was taught (or not, and why) in each
timetabled lesson.

Revision ID: b8e4f2a6d1c3
Revises: a7d3e1b9c5f4
Create Date: 2026-10-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8e4f2a6d1c3'
down_revision: Union[str, None] = 'a7d3e1b9c5f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "lesson_deliveries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("school_id", sa.Integer(), sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("teacher_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("class_id", sa.Integer(), sa.ForeignKey("school_classes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("subject_id", sa.Integer(), sa.ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("timetable_slot_id", sa.Integer(), sa.ForeignKey("timetable_slots.id", ondelete="SET NULL"), nullable=True),
        sa.Column("entry_id", sa.Integer(), sa.ForeignKey("lesson_plan_entries.id", ondelete="SET NULL"), nullable=True),
        sa.Column("lesson_date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("reason", sa.String(length=30), nullable=True),
        sa.Column("remark", sa.Text(), nullable=True),
        sa.Column("topic", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("teacher_user_id", "timetable_slot_id", "lesson_date", name="uq_lesson_delivery_slot_date"),
    )
    op.create_index("ix_lesson_deliveries_school_date", "lesson_deliveries", ["school_id", "lesson_date"])


def downgrade() -> None:
    op.drop_index("ix_lesson_deliveries_school_date", table_name="lesson_deliveries")
    op.drop_table("lesson_deliveries")
