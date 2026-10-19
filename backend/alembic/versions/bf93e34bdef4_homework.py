"""homework

Revision ID: bf93e34bdef4
Revises: 9f4a7c2e8b1d
Create Date: 2026-10-19 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bf93e34bdef4'
down_revision: Union[str, None] = '9f4a7c2e8b1d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_MODULE_KEYS = ["homework"]


def upgrade() -> None:
    op.create_table(
        "homework",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("school_id", sa.Integer(), sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("class_id", sa.Integer(), sa.ForeignKey("school_classes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("subject_id", sa.Integer(), sa.ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("allow_digital_submission", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_homework_school_class", "homework", ["school_id", "class_id"])

    op.create_table(
        "homework_submissions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("homework_id", sa.Integer(), sa.ForeignKey("homework.id", ondelete="CASCADE"), nullable=False),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "status",
            sa.Enum("NOT_SUBMITTED", "SUBMITTED", "REVIEWED", name="homeworksubmissionstatus"),
            nullable=False,
            server_default="NOT_SUBMITTED",
        ),
        sa.Column("file_url", sa.String(500), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("teacher_comment", sa.Text(), nullable=True),
        sa.Column("reviewed_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("homework_id", "student_id", name="uq_homework_submission_student"),
    )
    op.create_index("ix_homework_submissions_homework", "homework_submissions", ["homework_id"])

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
    op.drop_index("ix_homework_submissions_homework", table_name="homework_submissions")
    op.drop_table("homework_submissions")
    op.drop_index("ix_homework_school_class", table_name="homework")
    op.drop_table("homework")
    op.execute("DROP TYPE IF EXISTS homeworksubmissionstatus")
