"""report_card_remarks

Revision ID: 3e8f2a9d1c7b
Revises: 9d4b7e1c6a2f
Create Date: 2026-10-18 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3e8f2a9d1c7b'
down_revision: Union[str, None] = '9d4b7e1c6a2f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "report_card_remarks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("school_id", sa.Integer(), sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False),
        sa.Column("term", sa.String(50), nullable=False),
        sa.Column("class_teacher_remark", sa.String(500), nullable=True),
        sa.Column("principal_remark", sa.String(500), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("student_id", "term", name="uq_report_card_remark_student_term"),
    )
    op.create_index("ix_report_card_remarks_school_id", "report_card_remarks", ["school_id"])


def downgrade() -> None:
    op.drop_index("ix_report_card_remarks_school_id", table_name="report_card_remarks")
    op.drop_table("report_card_remarks")
