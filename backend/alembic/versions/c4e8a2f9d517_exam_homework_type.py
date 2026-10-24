"""exam_homework_type

Adds a short, teacher-chosen label (exam_type / homework_type) so exams
and homework can be grouped by kind — e.g. "CAT 1", "End Term",
"Assignment" — instead of only free-text titles.

Revision ID: c4e8a2f9d517
Revises: b7d2e94f3a18
Create Date: 2026-10-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4e8a2f9d517'
down_revision: Union[str, None] = 'b7d2e94f3a18'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("exams", sa.Column("exam_type", sa.String(50), nullable=False, server_default="Other"))
    op.alter_column("exams", "exam_type", server_default=None)
    op.add_column("homework", sa.Column("homework_type", sa.String(50), nullable=False, server_default="Other"))
    op.alter_column("homework", "homework_type", server_default=None)


def downgrade() -> None:
    op.drop_column("homework", "homework_type")
    op.drop_column("exams", "exam_type")
