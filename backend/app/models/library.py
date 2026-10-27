from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Book(Base):
    """A title in the catalogue. The physical books are its copies, each with
    its own number, so a class set of 40 is 40 numbered copies of one title."""

    __tablename__ = "library_books"

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    author: Mapped[str | None] = mapped_column(String(255), nullable=True)
    isbn: Mapped[str | None] = mapped_column(String(30), nullable=True)
    category: Mapped[str | None] = mapped_column(String(80), nullable=True)   # e.g. Storybook, Textbook, Reference
    subject_id: Mapped[int | None] = mapped_column(ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True)
    shelf: Mapped[str | None] = mapped_column(String(60), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    copies: Mapped[list["BookCopy"]] = relationship("BookCopy", back_populates="book", cascade="all, delete-orphan")


class BookCopy(Base):
    __tablename__ = "library_copies"
    __table_args__ = (UniqueConstraint("school_id", "copy_number", name="uq_library_copy_number"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    book_id: Mapped[int] = mapped_column(ForeignKey("library_books.id", ondelete="CASCADE"), nullable=False)
    copy_number: Mapped[str] = mapped_column(String(30), nullable=False)       # printed on the book, e.g. BK-000123
    condition: Mapped[str] = mapped_column(String(15), nullable=False, default="good")  # good | fair | poor
    status: Mapped[str] = mapped_column(String(15), nullable=False, default="available")  # available | on_loan | lost | withdrawn

    book: Mapped["Book"] = relationship("Book", back_populates="copies")
    loans: Mapped[list["Loan"]] = relationship("Loan", back_populates="copy", cascade="all, delete-orphan")


class Loan(Base):
    """A copy in someone's hands. A teacher can borrow copies for a class
    (`for_class_id`) and then issue them on to individual learners; that second
    loan points back at the first through `parent_loan_id`, so the book can
    always be traced from the shelf to the child and back."""

    __tablename__ = "library_loans"

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    copy_id: Mapped[int] = mapped_column(ForeignKey("library_copies.id", ondelete="CASCADE"), nullable=False)
    parent_loan_id: Mapped[int | None] = mapped_column(ForeignKey("library_loans.id", ondelete="SET NULL"), nullable=True)

    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=True)
    teacher_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    for_class_id: Mapped[int | None] = mapped_column(ForeignKey("school_classes.id", ondelete="SET NULL"), nullable=True)

    issued_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    returned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    returned_to: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    return_condition: Mapped[str | None] = mapped_column(String(15), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    copy: Mapped["BookCopy"] = relationship("BookCopy", back_populates="loans")
    student: Mapped["Student | None"] = relationship("Student")
    teacher: Mapped["User | None"] = relationship("User", foreign_keys=[teacher_user_id])
    issuer: Mapped["User | None"] = relationship("User", foreign_keys=[issued_by])
    school_class: Mapped["SchoolClass | None"] = relationship("SchoolClass", foreign_keys=[for_class_id])
