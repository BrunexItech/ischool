"""attendance_reason

Adds a nullable reason column to attendance_records, so a teacher can
record why a student was marked absent/late/excused.

Revision ID: b7d2e94f3a18
Revises: a3c7f9e21b56
Create Date: 2026-10-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7d2e94f3a18'
down_revision: Union[str, None] = 'a3c7f9e21b56'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("attendance_records", sa.Column("reason", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("attendance_records", "reason")
