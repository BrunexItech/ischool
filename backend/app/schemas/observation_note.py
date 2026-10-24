from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class ObservationNoteCreate(BaseModel):
    student_id: int
    class_id: int
    subject_id: int | None = None
    strand: str | None = None
    note: str
    noted_on: date


class ObservationNoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: int
    student_id: int
    class_id: int
    teacher_user_id: int | None
    subject_id: int | None
    strand: str | None
    note: str
    noted_on: date
    created_at: datetime
