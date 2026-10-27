"""transport_runs_and_new_roles

Revision ID: f9c5d3e7a2b4
Revises: e8b4c2d6f1a3
Create Date: 2026-10-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f9c5d3e7a2b4'
down_revision: Union[str, None] = 'e8b4c2d6f1a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_ROLES = ("TRANSPORT_ATTENDANT", "LIBRARIAN", "STORE_KEEPER", "ACCOUNTANT", "PROCUREMENT_OFFICER")


def upgrade() -> None:
    with op.get_context().autocommit_block():
        for role in NEW_ROLES:
            op.execute(f"ALTER TYPE userrole ADD VALUE IF NOT EXISTS '{role}'")

    op.add_column("vehicles", sa.Column("vehicle_type", sa.String(20), nullable=False, server_default="bus"))
    op.add_column("vehicles", sa.Column("make_model", sa.String(100), nullable=True))
    op.add_column("vehicles", sa.Column("insurance_expiry", sa.Date(), nullable=True))
    op.add_column("vehicles", sa.Column("inspection_expiry", sa.Date(), nullable=True))
    op.add_column("vehicles", sa.Column("next_service_date", sa.Date(), nullable=True))
    op.add_column("vehicles", sa.Column("attendant_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True))
    op.add_column("vehicles", sa.Column("notes", sa.String(500), nullable=True))
    op.add_column("transport_routes", sa.Column("school_arrival_time", sa.Time(), nullable=True))
    op.add_column("transport_routes", sa.Column("afternoon_departure_time", sa.Time(), nullable=True))

    op.create_table(
        "transport_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("school_id", sa.Integer(), sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("route_id", sa.Integer(), sa.ForeignKey("transport_routes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("vehicle_id", sa.Integer(), sa.ForeignKey("vehicles.id", ondelete="SET NULL"), nullable=True),
        sa.Column("run_date", sa.Date(), nullable=False),
        sa.Column("direction", sa.String(10), nullable=False),
        sa.Column("status", sa.String(15), nullable=False),
        sa.Column("started_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.UniqueConstraint("route_id", "run_date", "direction", name="uq_transport_run"),
    )
    op.create_index("ix_transport_runs_school_date", "transport_runs", ["school_id", "run_date"])
    op.create_table(
        "transport_boardings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("run_id", sa.Integer(), sa.ForeignKey("transport_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False),
        sa.Column("stop_id", sa.Integer(), sa.ForeignKey("route_stops.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(15), nullable=False),
        sa.Column("boarded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("dropped_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("handed_to", sa.String(255), nullable=True),
        sa.Column("note", sa.String(500), nullable=True),
        sa.Column("recorded_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.UniqueConstraint("run_id", "student_id", name="uq_transport_boarding"),
    )
    op.add_column("pickup_dropoff_logs", sa.Column("source", sa.String(15), nullable=False, server_default="gate"))
    op.add_column("pickup_dropoff_logs", sa.Column("at_school", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column("pickup_dropoff_logs", sa.Column("run_id", sa.Integer(), sa.ForeignKey("transport_runs.id", ondelete="SET NULL"), nullable=True))
    op.create_index("ix_pickup_dropoff_school_time", "pickup_dropoff_logs", ["school_id", "occurred_at"])


def downgrade() -> None:
    op.drop_index("ix_pickup_dropoff_school_time", table_name="pickup_dropoff_logs")
    op.drop_column("pickup_dropoff_logs", "run_id")
    op.drop_column("pickup_dropoff_logs", "at_school")
    op.drop_column("pickup_dropoff_logs", "source")
    op.drop_table("transport_boardings")
    op.drop_index("ix_transport_runs_school_date", table_name="transport_runs")
    op.drop_table("transport_runs")
    op.drop_column("transport_routes", "afternoon_departure_time")
    op.drop_column("transport_routes", "school_arrival_time")
    for col in ("notes", "attendant_user_id", "next_service_date", "inspection_expiry", "insurance_expiry", "make_model", "vehicle_type"):
        op.drop_column("vehicles", col)
    # Postgres cannot drop enum labels; the new roles stay in the type.
