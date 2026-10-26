"""result_exam_type

Results are now recorded per exam type (Opener, CAT 1, Mid Term, ...), so
a learner can have several marks for one subject in a term. Existing marks
keep working: they are tagged "Not specified".

Revision ID: a7d3e1b9c5f4
Revises: f1a9c3e6b8d2
Create Date: 2026-10-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7d3e1b9c5f4'
down_revision: Union[str, None] = 'f1a9c3e6b8d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("results", sa.Column("exam_type", sa.String(length=50), nullable=False, server_default="Not specified"))
    op.drop_constraint("uq_result_student_subject_term", "results", type_="unique")
    op.create_unique_constraint(
        "uq_result_student_subject_term_type", "results", ["student_id", "subject_id", "term", "exam_type"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_result_student_subject_term_type", "results", type_="unique")
    op.create_unique_constraint("uq_result_student_subject_term", "results", ["student_id", "subject_id", "term"])
    op.drop_column("results", "exam_type")
