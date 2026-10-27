"""leadership_feedback

Notes from school leadership to teachers, acknowledged by the teacher.

Revision ID: a4d9e7b2c6f8
Revises: f3c8d6e1a2b7
Create Date: 2026-10-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a4d9e7b2c6f8'
down_revision: Union[str, None] = 'f3c8d6e1a2b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "leadership_feedback",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("school_id", sa.Integer(), sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("recipient_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("topic", sa.String(length=100), nullable=False),
        sa.Column("link", sa.String(length=200), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=15), nullable=False, server_default="sent"),
        sa.Column("reply", sa.Text(), nullable=True),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_feedback_recipient", "leadership_feedback", ["recipient_user_id", "status"])


def downgrade() -> None:
    op.drop_index("ix_feedback_recipient", table_name="leadership_feedback")
    op.drop_table("leadership_feedback")
