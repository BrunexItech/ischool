"""library

Revision ID: a1d6e4f8b2c5
Revises: f9c5d3e7a2b4
Create Date: 2026-10-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1d6e4f8b2c5'
down_revision: Union[str, None] = 'f9c5d3e7a2b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_MODULE_KEYS = ["library"]


def upgrade() -> None:
    op.create_table(
        "library_books",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("school_id", sa.Integer(), sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("author", sa.String(255), nullable=True),
        sa.Column("isbn", sa.String(30), nullable=True),
        sa.Column("category", sa.String(80), nullable=True),
        sa.Column("subject_id", sa.Integer(), sa.ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True),
        sa.Column("shelf", sa.String(60), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_library_books_school", "library_books", ["school_id"])
    op.create_table(
        "library_copies",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("school_id", sa.Integer(), sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("book_id", sa.Integer(), sa.ForeignKey("library_books.id", ondelete="CASCADE"), nullable=False),
        sa.Column("copy_number", sa.String(30), nullable=False),
        sa.Column("condition", sa.String(15), nullable=False),
        sa.Column("status", sa.String(15), nullable=False),
        sa.UniqueConstraint("school_id", "copy_number", name="uq_library_copy_number"),
    )
    op.create_table(
        "library_loans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("school_id", sa.Integer(), sa.ForeignKey("schools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("copy_id", sa.Integer(), sa.ForeignKey("library_copies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("parent_loan_id", sa.Integer(), sa.ForeignKey("library_loans.id", ondelete="SET NULL"), nullable=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=True),
        sa.Column("teacher_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("for_class_id", sa.Integer(), sa.ForeignKey("school_classes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("issued_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("issued_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("returned_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("returned_to", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("return_condition", sa.String(15), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
    )
    op.create_index("ix_library_loans_school_open", "library_loans", ["school_id", "returned_at"])
    for key in NEW_MODULE_KEYS:
        op.execute(
            f"""
            INSERT INTO school_modules (school_id, module_key, enabled)
            SELECT id, '{key}', true FROM schools
            WHERE NOT EXISTS (
                SELECT 1 FROM school_modules
                WHERE school_modules.school_id = schools.id AND school_modules.module_key = '{key}'
            )
            """
        )


def downgrade() -> None:
    for key in NEW_MODULE_KEYS:
        op.execute(f"DELETE FROM school_modules WHERE module_key = '{key}'")
    op.drop_index("ix_library_loans_school_open", table_name="library_loans")
    op.drop_table("library_loans")
    op.drop_table("library_copies")
    op.drop_index("ix_library_books_school", table_name="library_books")
    op.drop_table("library_books")
