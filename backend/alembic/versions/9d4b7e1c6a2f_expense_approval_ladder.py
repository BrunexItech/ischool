"""expense_approval_ladder

Revision ID: 9d4b7e1c6a2f
Revises: 7a1c9f3e2b4d
Create Date: 2026-10-18 08:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9d4b7e1c6a2f'
down_revision: Union[str, None] = '7a1c9f3e2b4d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


expense_status = sa.Enum("PENDING", "APPROVED", "REJECTED", name="expensestatus")


def upgrade() -> None:
    op.add_column(
        "schools",
        sa.Column("expense_approval_threshold", sa.Numeric(12, 2), nullable=False, server_default="50000"),
    )

    expense_status.create(op.get_bind())
    op.add_column(
        "expenses",
        sa.Column("status", expense_status, nullable=False, server_default="APPROVED"),
    )
    op.add_column("expenses", sa.Column("approved_by", sa.Integer(), nullable=True))
    op.add_column("expenses", sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("expenses", sa.Column("rejected_reason", sa.String(500), nullable=True))
    op.create_foreign_key(
        "fk_expenses_approved_by_users", "expenses", "users", ["approved_by"], ["id"], ondelete="SET NULL"
    )
    # Every pre-existing expense was recorded before this approval ladder
    # existed, so treat it as already settled by whoever recorded it.
    op.execute("UPDATE expenses SET approved_by = recorded_by, approved_at = created_at WHERE status = 'APPROVED'")


def downgrade() -> None:
    op.drop_constraint("fk_expenses_approved_by_users", "expenses", type_="foreignkey")
    op.drop_column("expenses", "rejected_reason")
    op.drop_column("expenses", "approved_at")
    op.drop_column("expenses", "approved_by")
    op.drop_column("expenses", "status")
    expense_status.drop(op.get_bind())
    op.drop_column("schools", "expense_approval_threshold")
