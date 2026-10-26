"""live_class_controls

Waiting-room requests and a who-joined list for live classes.

Revision ID: e2b7c5d9f4a6
Revises: d1a6b4c8e3f5
Create Date: 2026-10-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e2b7c5d9f4a6'
down_revision: Union[str, None] = 'd1a6b4c8e3f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "live_class_guest_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("live_class_id", sa.Integer(), sa.ForeignKey("live_classes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("request_code", sa.String(length=50), nullable=False, unique=True),
        sa.Column("status", sa.String(length=10), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "live_class_joins",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("live_class_id", sa.Integer(), sa.ForeignKey("live_classes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("identity", sa.String(length=60), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("kind", sa.String(length=10), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("live_class_id", "identity", name="uq_live_class_join"),
    )


def downgrade() -> None:
    op.drop_table("live_class_joins")
    op.drop_table("live_class_guest_requests")
