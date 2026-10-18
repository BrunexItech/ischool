"""school section modules (pre-primary, primary, secondary, college)

Revision ID: a1b2c3d4e5f6
Revises: d1baaf8b39a2
Create Date: 2026-10-17 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'd1baaf8b39a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SECTION_KEYS = ["pre_primary", "primary_section", "secondary_section", "college_section"]


def upgrade() -> None:
    for key in SECTION_KEYS:
        op.execute(
            f"""
            INSERT INTO school_modules (school_id, module_key, enabled)
            SELECT id, '{key}', true FROM schools
            WHERE NOT EXISTS (
                SELECT 1 FROM school_modules
                WHERE school_modules.school_id = schools.id AND school_modules.module_key = '{key}'
            )
            """
        )


def downgrade() -> None:
    for key in SECTION_KEYS:
        op.execute(f"DELETE FROM school_modules WHERE module_key = '{key}'")
