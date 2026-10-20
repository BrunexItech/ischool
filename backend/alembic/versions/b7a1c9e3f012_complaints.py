"""complaints

Revision ID: b7a1c9e3f012
Revises: a39834e7fcf4
Create Date: 2026-10-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7a1c9e3f012'
down_revision: Union[str, None] = 'a39834e7fcf4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    audience_enum = sa.Enum("class_teacher", "principal", name="complaintaudience")
    status_enum = sa.Enum("open", "resolved", name="complaintstatus")
    op.create_table(
        "complaints",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("school_id", sa.Integer(), sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("raised_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("raised_by_name", sa.String(255), nullable=False),
        sa.Column("raised_by_role", sa.String(30), nullable=False),
        sa.Column("audience", audience_enum, nullable=False),
        sa.Column("class_id", sa.Integer(), sa.ForeignKey("school_classes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("subject", sa.String(255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", status_enum, nullable=False, server_default="open"),
        sa.Column("response", sa.Text(), nullable=True),
        sa.Column("responded_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("complaints")
    sa.Enum(name="complaintaudience").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="complaintstatus").drop(op.get_bind(), checkfirst=True)
