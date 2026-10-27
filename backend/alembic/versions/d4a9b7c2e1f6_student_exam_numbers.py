"""student_exam_numbers

Revision ID: d4a9b7c2e1f6
Revises: c3f8a6b1d9e4
Create Date: 2026-10-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd4a9b7c2e1f6'
down_revision: Union[str, None] = 'c3f8a6b1d9e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COLUMNS = [("upi_number", 30), ("assessment_number", 30), ("index_number", 30), ("birth_certificate_number", 40), ("nationality", 60)]


def upgrade() -> None:
    for name, size in COLUMNS:
        op.add_column("students", sa.Column(name, sa.String(size), nullable=True))


def downgrade() -> None:
    for name, _ in reversed(COLUMNS):
        op.drop_column("students", name)
