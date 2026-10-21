"""staff_tsc_number

Revision ID: c2d4e8a91b33
Revises: b7a1c9e3f012
Create Date: 2026-10-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c2d4e8a91b33'
down_revision: Union[str, None] = 'b7a1c9e3f012'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("staff_profiles", sa.Column("tsc_number", sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column("staff_profiles", "tsc_number")
