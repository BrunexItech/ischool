"""store_requests_and_adjustments

Revision ID: c3f8a6b1d9e4
Revises: b2e7f5a9c3d6
Create Date: 2026-10-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3f8a6b1d9e4'
down_revision: Union[str, None] = 'b2e7f5a9c3d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE stockmovementtype ADD VALUE IF NOT EXISTS 'ADJUSTMENT'")
    op.create_table(
        "store_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("school_id", sa.Integer(), sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reference", sa.String(30), nullable=False),
        sa.Column("department", sa.String(100), nullable=False),
        sa.Column("note", sa.String(500), nullable=True),
        sa.Column("status", sa.String(15), nullable=False),
        sa.Column("requested_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("requested_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("decided_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decision_note", sa.String(500), nullable=True),
    )
    op.create_index("ix_store_requests_school_status", "store_requests", ["school_id", "status"])
    op.create_table(
        "store_request_lines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("request_id", sa.Integer(), sa.ForeignKey("store_requests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("item_id", sa.Integer(), sa.ForeignKey("stock_items.id", ondelete="CASCADE"), nullable=False),
        sa.Column("quantity_requested", sa.Integer(), nullable=False),
        sa.Column("quantity_issued", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_table("store_request_lines")
    op.drop_index("ix_store_requests_school_status", table_name="store_requests")
    op.drop_table("store_requests")
    # Postgres cannot drop an enum label; ADJUSTMENT stays in stockmovementtype.
