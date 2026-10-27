from datetime import date

from pydantic import BaseModel, Field


class FeeLineIn(BaseModel):
    grade_level_id: int
    category: str = Field(min_length=2, max_length=30)
    amount: float = Field(ge=0)


class FeeStructureIn(BaseModel):
    term: str
    lines: list[FeeLineIn]


class FeeLineOut(FeeLineIn):
    id: int
    grade_code: str
    grade_name: str


class FeeStructureOut(BaseModel):
    term: str
    lines: list[FeeLineOut]
    learners_by_grade: dict[str, int]


class FeeSaveResult(BaseModel):
    applied: bool
    request_id: int | None = None
    message: str


class GenerateIn(BaseModel):
    term: str
    due_date: date | None = None


class GenerateResult(BaseModel):
    created: int
    skipped_existing: int
    learners_without_grade: int
    total_billed: float


class BalanceRow(BaseModel):
    student_id: int
    name: str
    admission_number: str
    class_name: str | None
    guardian_name: str | None
    guardian_phone: str | None
    guardian_email: str | None
    billed: float
    paid: float
    balance: float          # this term
    arrears: float          # unpaid from other terms
    total_owed: float


class BalancesOut(BaseModel):
    term: str | None
    rows: list[BalanceRow]
    totals: dict[str, float]


class RemindIn(BaseModel):
    term: str | None = None
    student_ids: list[int] = Field(min_length=1, max_length=300)
    message: str | None = Field(default=None, max_length=300)
    sms: bool = True
    email: bool = False


class RemindResult(BaseModel):
    sms_sent: int
    email_sent: int
    no_contact: list[str]
    sms_error: str | None = None
    email_error: str | None = None
