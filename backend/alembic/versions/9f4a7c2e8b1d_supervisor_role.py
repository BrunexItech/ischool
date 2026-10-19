"""supervisor_role

Revision ID: 9f4a7c2e8b1d
Revises: 8c3f6a1b9d2e
Create Date: 2026-10-19 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9f4a7c2e8b1d'
down_revision: Union[str, None] = '8c3f6a1b9d2e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'SUPERVISOR'")

    op.create_table(
        "supervisor_school_links",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("supervisor_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("school_id", sa.Integer(), sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("supervisor_user_id", "school_id", name="uq_supervisor_school"),
    )
    op.create_index("ix_supervisor_school_links_supervisor", "supervisor_school_links", ["supervisor_user_id"])


def downgrade() -> None:
    op.drop_index("ix_supervisor_school_links_supervisor", table_name="supervisor_school_links")
    op.drop_table("supervisor_school_links")
    # Postgres has no DROP VALUE for enum types — left as a no-op, same as
    # the other role-specialization migrations.
