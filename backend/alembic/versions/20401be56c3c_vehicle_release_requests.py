"""vehicle_release_requests

Revision ID: 20401be56c3c
Revises: c3458f99ccaf
Create Date: 2026-10-19 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20401be56c3c'
down_revision: Union[str, None] = 'c3458f99ccaf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "vehicle_release_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("school_id", sa.Integer(), sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("registration", sa.String(20), nullable=False),
        sa.Column("driver_name", sa.String(255), nullable=False),
        sa.Column("purpose", sa.String(255), nullable=False),
        sa.Column(
            "status",
            sa.Enum("PENDING", "APPROVED", "REJECTED", name="vehiclereleasestatus"),
            nullable=False,
            server_default="PENDING",
        ),
        sa.Column("decision_note", sa.String(255), nullable=True),
        sa.Column("requested_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("requested_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("decided_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_vehicle_release_requests_school_status", "vehicle_release_requests", ["school_id", "status"])


def downgrade() -> None:
    op.drop_index("ix_vehicle_release_requests_school_status", table_name="vehicle_release_requests")
    op.drop_table("vehicle_release_requests")
    op.execute("DROP TYPE IF EXISTS vehiclereleasestatus")
