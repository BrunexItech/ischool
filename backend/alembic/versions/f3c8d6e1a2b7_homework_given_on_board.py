"""homework_given_on_board

Lets a teacher record homework that was written on the board or said aloud,
so leadership can see it was given even when it was not typed in.

Revision ID: f3c8d6e1a2b7
Revises: e2b7c5d9f4a6
Create Date: 2026-10-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f3c8d6e1a2b7'
down_revision: Union[str, None] = 'e2b7c5d9f4a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("homework", sa.Column("given_on_board", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_table(
        "homework_declarations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("school_id", sa.Integer(), sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("class_id", sa.Integer(), sa.ForeignKey("school_classes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("subject_id", sa.Integer(), sa.ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("declared_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.UniqueConstraint("class_id", "subject_id", "date", name="uq_homework_declaration"),
    )


def downgrade() -> None:
    op.drop_table("homework_declarations")
    op.drop_column("homework", "given_on_board")
