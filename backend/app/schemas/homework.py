from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.models.homework import HomeworkSubmissionStatus


class HomeworkCreate(BaseModel):
    class_id: int
    subject_id: int
    title: str
    instructions: str | None = None
    due_date: date
    allow_digital_submission: bool = True


class HomeworkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: int
    class_id: int
    subject_id: int
    title: str
    instructions: str | None
    due_date: date
    allow_digital_submission: bool
    created_by: int | None
    created_at: datetime


class HomeworkListItemOut(HomeworkOut):
    created_by_name: str | None = None
    total_students: int
    submitted_count: int
    reviewed_count: int


class HomeworkSubmissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    student_id: int
    student_name: str
    status: HomeworkSubmissionStatus
    file_url: str | None
    submitted_at: datetime | None
    score: float | None
    teacher_comment: str | None
    reviewed_at: datetime | None


class HomeworkDetailOut(HomeworkListItemOut):
    submissions: list[HomeworkSubmissionOut]


class HomeworkReviewUpdate(BaseModel):
    status: HomeworkSubmissionStatus
    score: float | None = None
    teacher_comment: str | None = None


class HomeworkForStudentOut(BaseModel):
    id: int
    subject_name: str
    title: str
    instructions: str | None
    due_date: date
    allow_digital_submission: bool
    status: HomeworkSubmissionStatus
    file_url: str | None
    score: float | None
    teacher_comment: str | None
