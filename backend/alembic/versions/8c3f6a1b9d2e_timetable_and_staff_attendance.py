"""timetable_and_staff_attendance

Revision ID: 8c3f6a1b9d2e
Revises: 5b2d8e4f1a9c
Create Date: 2026-10-18 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8c3f6a1b9d2e'
down_revision: Union[str, None] = '5b2d8e4f1a9c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_MODULE_KEYS = ["timetable", "staff_attendance"]


def upgrade() -> None:
    op.create_table(
        "timetable_slots",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("school_id", sa.Integer(), sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("class_id", sa.Integer(), sa.ForeignKey("school_classes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("subject_id", sa.Integer(), sa.ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("teacher_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("day_of_week", sa.Integer(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("room", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_timetable_slots_school_class", "timetable_slots", ["school_id", "class_id"])
    op.create_index("ix_timetable_slots_teacher", "timetable_slots", ["teacher_user_id"])

    op.create_table(
        "staff_attendance",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("school_id", sa.Integer(), sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("clocked_in_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("clocked_out_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("note", sa.String(255), nullable=True),
        sa.UniqueConstraint("user_id", "date", name="uq_staff_attendance_user_date"),
    )
    op.create_index("ix_staff_attendance_school_id", "staff_attendance", ["school_id"])

    op.create_table(
        "duty_assignments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("school_id", sa.Integer(), sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(100), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=True),
        sa.Column("end_time", sa.Time(), nullable=True),
        sa.Column("notes", sa.String(255), nullable=True),
        sa.Column("assigned_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_duty_assignments_school_date", "duty_assignments", ["school_id", "date"])

    for key in NEW_MODULE_KEYS:
        op.execute(
            f"""
            INSERT INTO school_modules (school_id, module_key, enabled)
            SELECT id, '{key}', true FROM schools
            WHERE NOT EXISTS (
                SELECT 1 FROM school_modules
                WHERE school_modules.school_id = schools.id AND school_modules.module_key = '{key}'
            )
            """
        )


def downgrade() -> None:
    for key in NEW_MODULE_KEYS:
        op.execute(f"DELETE FROM school_modules WHERE module_key = '{key}'")
    op.drop_index("ix_duty_assignments_school_date", table_name="duty_assignments")
    op.drop_table("duty_assignments")
    op.drop_index("ix_staff_attendance_school_id", table_name="staff_attendance")
    op.drop_table("staff_attendance")
    op.drop_index("ix_timetable_slots_teacher", table_name="timetable_slots")
    op.drop_index("ix_timetable_slots_school_class", table_name="timetable_slots")
    op.drop_table("timetable_slots")
