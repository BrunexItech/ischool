"""secretary_role

The head's office: sets term dates, runs the calendar and notices, handles
admissions and enrolment. No finance, no approvals.

Revision ID: b5e1f8a3c7d9
Revises: a4d9e7b2c6f8
Create Date: 2026-10-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'b5e1f8a3c7d9'
down_revision: Union[str, None] = 'a4d9e7b2c6f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Postgres cannot add an enum label inside the normal migration transaction.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'SECRETARY'")


def downgrade() -> None:
    # Postgres has no DROP VALUE for enum types; reassign any secretary
    # accounts before rebuilding the type if you ever need to remove it.
    pass
