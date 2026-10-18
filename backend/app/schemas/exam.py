from datetime import datetime

from pydantic import BaseModel, ConfigDict, model_validator

from app.models.exam import ExamQuestionType, ExamSubmissionStatus


class ExamQuestionCreate(BaseModel):
    question_text: str
    question_type: ExamQuestionType
    marks: float
    order: int
    options: list[str] | None = None
    correct_option_index: int | None = None

    @model_validator(mode="after")
    def mcq_needs_options(self) -> "ExamQuestionCreate":
        if self.question_type == ExamQuestionType.MCQ:
            if not self.options or len(self.options) < 2:
                raise ValueError("An MCQ question needs at least 2 options")
            if self.correct_option_index is None or not (0 <= self.correct_option_index < len(self.options)):
                raise ValueError("correct_option_index must point at one of the options")
        return self


class ExamCreate(BaseModel):
    subject_id: int
    class_id: int | None = None
    title: str
    term: str
    duration_minutes: int
    opens_at: datetime | None = None
    closes_at: datetime | None = None
    questions: list[ExamQuestionCreate] = []

    @model_validator(mode="after")
    def window_makes_sense(self) -> "ExamCreate":
        if self.opens_at and self.closes_at and self.closes_at <= self.opens_at:
            raise ValueError("closes_at must be after opens_at")
        return self


class ExamQuestionOut(BaseModel):
    """Teacher-facing — includes the answer key."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    question_text: str
    question_type: ExamQuestionType
    marks: float
    order: int
    options: list[str] | None
    correct_option_index: int | None


class ExamQuestionForStudent(BaseModel):
    """Student-facing — no answer key."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    question_text: str
    question_type: ExamQuestionType
    marks: float
    order: int
    options: list[str] | None


class ExamOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: int
    subject_id: int
    class_id: int | None
    title: str
    term: str
    duration_minutes: int
    is_published: bool
    opens_at: datetime | None
    closes_at: datetime | None
    paper_file_url: str | None
    total_marks: float
    question_count: int


class ExamDetailOut(ExamOut):
    questions: list[ExamQuestionOut]


class ExamForStudentOut(ExamOut):
    questions: list[ExamQuestionForStudent]


class ExamAnswerSubmit(BaseModel):
    question_id: int
    answer_text: str


class ExamSubmissionCreate(BaseModel):
    answers: list[ExamAnswerSubmit]


class ExamAnswerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    question_id: int
    answer_text: str | None
    awarded_marks: float | None


class ExamSubmissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    exam_id: int
    student_id: int
    status: ExamSubmissionStatus
    started_at: datetime
    submitted_at: datetime | None
    score: float | None


class ExamSubmissionDetailOut(ExamSubmissionOut):
    answers: list[ExamAnswerOut]
    student_name: str


class GradeAnswerRequest(BaseModel):
    awarded_marks: float


class ExamForStudentListOut(ExamOut):
    subject_name: str
    submission_status: str | None  # None if not yet started
    score: float | None


class ExamStartOut(BaseModel):
    exam: ExamForStudentOut
    submission: ExamSubmissionOut
    answers: list[ExamAnswerOut]
