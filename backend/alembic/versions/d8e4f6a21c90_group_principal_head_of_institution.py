"""group_principal_head_of_institution

Renames the SCHOOL_ADMIN role to HEAD_OF_INSTITUTION and the SUPERVISOR
role to GROUP_PRINCIPAL (in place — existing accounts keep their identity
and current access, only the label changes), and adds `schools.school_type`
so a non-operational "group" (umbrella) row can be distinguished from a
real operating school. No existing rows are altered beyond the enum label
rename; `school_type` defaults every existing school to SCHOOL.

This migration does NOT create a Milai Group row or link any real schools
to it — that data is specific to the client's actual organization and is
applied separately, once confirmed, not invented here.

Revision ID: d8e4f6a21c90
Revises: c2d4e8a91b33
Create Date: 2026-10-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd8e4f6a21c90'
down_revision: Union[str, None] = 'c2d4e8a91b33'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE userrole RENAME VALUE 'SCHOOL_ADMIN' TO 'HEAD_OF_INSTITUTION'")
    op.execute("ALTER TYPE userrole RENAME VALUE 'SUPERVISOR' TO 'GROUP_PRINCIPAL'")

    school_type_enum = sa.Enum("SCHOOL", "GROUP", name="schooltype")
    school_type_enum.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "schools",
        sa.Column("school_type", school_type_enum, nullable=False, server_default="SCHOOL"),
    )


def downgrade() -> None:
    op.drop_column("schools", "school_type")
    sa.Enum(name="schooltype").drop(op.get_bind(), checkfirst=True)
    op.execute("ALTER TYPE userrole RENAME VALUE 'GROUP_PRINCIPAL' TO 'SUPERVISOR'")
    op.execute("ALTER TYPE userrole RENAME VALUE 'HEAD_OF_INSTITUTION' TO 'SCHOOL_ADMIN'")
