"""homework_attachment

Revision ID: c3458f99ccaf
Revises: bf93e34bdef4
Create Date: 2026-10-19 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3458f99ccaf'
down_revision: Union[str, None] = 'bf93e34bdef4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("homework", sa.Column("attachment_url", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("homework", "attachment_url")
