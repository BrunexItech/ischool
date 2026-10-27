"""staff_meetings

Revision ID: f6c2d9a4e8b1
Revises: e5b1c8d3f7a9
Create Date: 2026-10-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f6c2d9a4e8b1'
down_revision: Union[str, None] = 'e5b1c8d3f7a9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "staff_meetings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("host_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("agenda", sa.String(1000), nullable=True),
        sa.Column("scheduled_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(12), nullable=False),
        sa.Column("room_name", sa.String(100), nullable=False, unique=True),
        sa.Column("school_ids", sa.JSON(), nullable=False),
        sa.Column("audience", sa.String(10), nullable=False),
        sa.Column("invitee_user_ids", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "staff_meeting_joins",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("meeting_id", sa.Integer(), sa.ForeignKey("staff_meetings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("meeting_id", "user_id", name="uq_meeting_join"),
    )
    op.create_table(
        "principal_report_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("iso_year", sa.Integer(), nullable=False),
        sa.Column("iso_week", sa.Integer(), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "iso_year", "iso_week", name="uq_principal_report_run"),
    )


def downgrade() -> None:
    op.drop_table("principal_report_runs")
    op.drop_table("staff_meeting_joins")
    op.drop_table("staff_meetings")
