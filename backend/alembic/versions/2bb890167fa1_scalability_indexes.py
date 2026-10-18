"""scalability_indexes

Revision ID: 2bb890167fa1
Revises: b78c24afd93d
Create Date: 2026-10-18 01:55:14.068431

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2bb890167fa1'
down_revision: Union[str, None] = 'b78c24afd93d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Postgres never auto-indexes a foreign key column (only the referenced
    # side), so every school_id-scoped table — which is every table in this
    # app — was doing a sequential scan on its hottest filter. These are the
    # columns the dashboard, ledger and budget aggregates hit hardest.
    op.create_index("ix_students_school_id", "students", ["school_id"])
    op.create_index("ix_users_school_id", "users", ["school_id"])
    op.create_index("ix_attendance_records_school_date", "attendance_records", ["school_id", "date"])
    op.create_index("ix_attendance_records_class_date", "attendance_records", ["class_id", "date"])
    op.create_index("ix_fee_invoices_school_id", "fee_invoices", ["school_id"])
    op.create_index("ix_fee_invoices_student_id", "fee_invoices", ["student_id"])
    op.create_index("ix_journal_entries_school_date", "journal_entries", ["school_id", "entry_date"])
    op.create_index("ix_journal_lines_entry_id", "journal_lines", ["entry_id"])
    op.create_index("ix_journal_lines_account_id", "journal_lines", ["account_id"])
    op.create_index("ix_results_school_id", "results", ["school_id"])
    op.create_index("ix_audit_logs_school_id", "audit_logs", ["school_id"])


def downgrade() -> None:
    op.drop_index("ix_audit_logs_school_id", table_name="audit_logs")
    op.drop_index("ix_results_school_id", table_name="results")
    op.drop_index("ix_journal_lines_account_id", table_name="journal_lines")
    op.drop_index("ix_journal_lines_entry_id", table_name="journal_lines")
    op.drop_index("ix_journal_entries_school_date", table_name="journal_entries")
    op.drop_index("ix_fee_invoices_student_id", table_name="fee_invoices")
    op.drop_index("ix_fee_invoices_school_id", table_name="fee_invoices")
    op.drop_index("ix_attendance_records_class_date", table_name="attendance_records")
    op.drop_index("ix_attendance_records_school_date", table_name="attendance_records")
    op.drop_index("ix_users_school_id", table_name="users")
    op.drop_index("ix_students_school_id", table_name="students")
