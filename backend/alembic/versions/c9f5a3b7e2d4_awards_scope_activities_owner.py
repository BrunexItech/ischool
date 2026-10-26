"""awards_scope_activities_owner

Awards can now go to a learner, a class, the whole school or a staff member,
carry a term, a subject and an optional activity. Activities record who runs
them and who they are for.

Revision ID: c9f5a3b7e2d4
Revises: b8e4f2a6d1c3
Create Date: 2026-10-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9f5a3b7e2d4'
down_revision: Union[str, None] = 'b8e4f2a6d1c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("awards", sa.Column("scope", sa.String(length=10), nullable=False, server_default="student"))
    op.execute("UPDATE awards SET scope = 'staff' WHERE staff_user_id IS NOT NULL")
    op.add_column("awards", sa.Column("class_id", sa.Integer(), sa.ForeignKey("school_classes.id", ondelete="CASCADE"), nullable=True))
    op.add_column("awards", sa.Column("subject_id", sa.Integer(), sa.ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True))
    op.add_column("awards", sa.Column("activity_id", sa.Integer(), sa.ForeignKey("activities.id", ondelete="SET NULL"), nullable=True))
    op.add_column("awards", sa.Column("term", sa.String(length=50), nullable=True))
    op.drop_constraint("ck_award_exactly_one_recipient", "awards", type_="check")
    op.create_check_constraint(
        "ck_award_recipient_scope",
        "awards",
        "(scope = 'student' AND student_id IS NOT NULL AND staff_user_id IS NULL AND class_id IS NULL)"
        " OR (scope = 'staff' AND staff_user_id IS NOT NULL AND student_id IS NULL AND class_id IS NULL)"
        " OR (scope = 'class' AND class_id IS NOT NULL AND student_id IS NULL AND staff_user_id IS NULL)"
        " OR (scope = 'school' AND student_id IS NULL AND staff_user_id IS NULL AND class_id IS NULL)",
    )

    op.add_column("activities", sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True))
    op.add_column("activities", sa.Column("scope", sa.String(length=10), nullable=False, server_default="school"))
    op.add_column("activities", sa.Column("class_id", sa.Integer(), sa.ForeignKey("school_classes.id", ondelete="SET NULL"), nullable=True))


def downgrade() -> None:
    op.drop_column("activities", "class_id")
    op.drop_column("activities", "scope")
    op.drop_column("activities", "created_by")
    op.drop_constraint("ck_award_recipient_scope", "awards", type_="check")
    op.execute("DELETE FROM awards WHERE scope IN ('class', 'school')")
    op.create_check_constraint("ck_award_exactly_one_recipient", "awards", "(student_id IS NOT NULL) != (staff_user_id IS NOT NULL)")
    op.drop_column("awards", "term")
    op.drop_column("awards", "activity_id")
    op.drop_column("awards", "subject_id")
    op.drop_column("awards", "class_id")
    op.drop_column("awards", "scope")
