"""role_specializations

Revision ID: 7a1c9f3e2b4d
Revises: 2bb890167fa1
Create Date: 2026-10-18 03:10:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '7a1c9f3e2b4d'
down_revision: Union[str, None] = '2bb890167fa1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# New job-function roles so "staff" can be narrowed to a specific working
# view (security, boarding/matron, transport, bursar) instead of every
# employee seeing every operational module.
NEW_ROLES = ["SECURITY", "BOARDING_STAFF", "TRANSPORT_STAFF", "BURSAR"]


def upgrade() -> None:
    # Postgres can't add enum labels inside the migration's normal
    # transaction block, so this runs each ADD VALUE as its own statement.
    with op.get_context().autocommit_block():
        for label in NEW_ROLES:
            op.execute(f"ALTER TYPE userrole ADD VALUE IF NOT EXISTS '{label}'")


def downgrade() -> None:
    # Postgres has no DROP VALUE for enum types; removing a label would
    # require rebuilding the type and every column/constraint that uses it.
    # Left as a no-op — rows using the new roles must be reassigned first
    # if you ever need to actually drop them.
    pass
