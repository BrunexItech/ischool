"""conduct_reports

Adds a module where a teacher (or staff/admin) can file a misconduct
report for a student — visible to school leadership, the student, and
their guardian.

Revision ID: f1a9c3e6b8d2
Revises: c4e8a2f9d517
Create Date: 2026-10-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a9c3e6b8d2'
down_revision: Union[str, None] = 'c4e8a2f9d517'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_MODULE_KEYS = ["conduct"]


def upgrade() -> None:
    op.create_table(
        "conduct_reports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("school_id", sa.Integer(), sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False),
        sa.Column("class_id", sa.Integer(), sa.ForeignKey("school_classes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reported_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reported_by_name", sa.String(255), nullable=False),
        sa.Column(
            "category",
            sa.Enum(
                "DISRUPTION", "DISRESPECT", "BULLYING", "FIGHTING", "DISHONESTY",
                "PROPERTY_DAMAGE", "DRESS_CODE", "OTHER",
                name="conductcategory",
            ),
            nullable=False,
        ),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("action_taken", sa.Text(), nullable=True),
        sa.Column("incident_date", sa.Date(), nullable=False),
        sa.Column("status", sa.Enum("OPEN", "REVIEWED", name="conductstatus"), nullable=False, server_default="OPEN"),
        sa.Column("response", sa.Text(), nullable=True),
        sa.Column("responded_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_conduct_reports_school_student", "conduct_reports", ["school_id", "student_id"])

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
    op.drop_index("ix_conduct_reports_school_student", table_name="conduct_reports")
    op.drop_table("conduct_reports")
    op.execute("DROP TYPE IF EXISTS conductcategory")
    op.execute("DROP TYPE IF EXISTS conductstatus")
