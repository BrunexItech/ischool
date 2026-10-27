from datetime import date, datetime

from pydantic import BaseModel, Field


class BookCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    author: str | None = None
    isbn: str | None = None
    category: str | None = None
    subject_id: int | None = None
    shelf: str | None = None
    copies: int = Field(default=1, ge=1, le=500)
    condition: str = "good"


class BookUpdate(BaseModel):
    title: str | None = None
    author: str | None = None
    isbn: str | None = None
    category: str | None = None
    subject_id: int | None = None
    shelf: str | None = None


class AddCopies(BaseModel):
    count: int = Field(ge=1, le=500)
    condition: str = "good"


class BookOut(BaseModel):
    id: int
    title: str
    author: str | None
    isbn: str | None
    category: str | None
    shelf: str | None
    subject_name: str | None
    total_copies: int
    available: int
    on_loan: int
    lost: int


class Holder(BaseModel):
    loan_id: int
    kind: str                    # student | teacher
    name: str
    class_name: str | None
    via_teacher: str | None      # set when a teacher handed the book to a learner
    due_date: date
    overdue: bool


class CopyOut(BaseModel):
    id: int
    copy_number: str
    condition: str
    status: str
    holder: Holder | None


class BookDetail(BaseModel):
    book: BookOut
    copies: list[CopyOut]


class LoanIssue(BaseModel):
    copy_number: str
    student_id: int | None = None
    teacher_user_id: int | None = None
    for_class_id: int | None = None
    due_date: date | None = None
    note: str | None = None


class LoanReturn(BaseModel):
    condition: str = "good"      # good | fair | poor | lost
    note: str | None = None


class LoanOut(BaseModel):
    id: int
    copy_number: str
    title: str
    author: str | None
    borrower_kind: str
    borrower_name: str
    class_name: str | None
    via_teacher: str | None
    issued_by_name: str | None
    issued_at: datetime
    due_date: date
    returned_at: datetime | None
    returned_to_name: str | None
    overdue: bool
    days_overdue: int
    parent_loan_id: int | None
    active: bool


class ClassSet(BaseModel):
    loan_id: int
    teacher_id: int
    teacher_name: str
    class_name: str | None
    titles: list[str]
    copies: int
    with_learners: int
    due_date: date
    overdue: bool
    copy_numbers: list[str]


class TeacherHoldings(BaseModel):
    sets: list[ClassSet]
    learner_loans: list[LoanOut]


class LibraryOverview(BaseModel):
    titles: int
    copies: int
    available: int
    on_loan: int
    lost: int
    overdue: int
    borrowers_now: int
    class_sets: list[ClassSet]
    overdue_loans: list[LoanOut]
    recent: list[LoanOut]
    popular: list[dict]
