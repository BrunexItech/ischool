"""school_periods_and_change_requests

Revision ID: e8b4c2d6f1a3
Revises: d7a3b9c1e5f2
Create Date: 2026-10-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e8b4c2d6f1a3'
down_revision: Union[str, None] = 'd7a3b9c1e5f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "school_periods",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("school_id", sa.Integer(), sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("level_group", sa.String(30), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(60), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("days", sa.JSON(), nullable=False),
        sa.UniqueConstraint("school_id", "level_group", "position", name="uq_school_period_position"),
    )
    op.add_column("timetable_slots", sa.Column("period_id", sa.Integer(), sa.ForeignKey("school_periods.id", ondelete="SET NULL"), nullable=True))
    change_status = sa.Enum("PENDING", "APPROVED", "REJECTED", name="changestatus")
    op.create_table(
        "change_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("school_id", sa.Integer(), sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(40), nullable=False),
        sa.Column("scope", sa.String(60), nullable=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("status", change_status, nullable=False),
        sa.Column("requested_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("requested_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("decided_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decision_note", sa.Text(), nullable=True),
    )
    op.create_index("ix_change_requests_school_status", "change_requests", ["school_id", "status"])


def downgrade() -> None:
    op.drop_index("ix_change_requests_school_status", table_name="change_requests")
    op.drop_table("change_requests")
    sa.Enum(name="changestatus").drop(op.get_bind(), checkfirst=True)
    op.drop_column("timetable_slots", "period_id")
    op.drop_table("school_periods")
