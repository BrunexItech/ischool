from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.lesson_plan import LessonPlanEntryStatus


class LessonPlanEntryCreate(BaseModel):
    order: int
    label: str
    topic: str
    objectives: str | None = None
    resources: str | None = None
    notes: str | None = None
    status: LessonPlanEntryStatus = LessonPlanEntryStatus.PLANNED


class LessonPlanEntryUpdate(BaseModel):
    order: int | None = None
    label: str | None = None
    topic: str | None = None
    objectives: str | None = None
    resources: str | None = None
    notes: str | None = None
    status: LessonPlanEntryStatus | None = None


class LessonPlanEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order: int
    label: str
    topic: str
    objectives: str | None
    resources: str | None
    notes: str | None
    status: LessonPlanEntryStatus


class LessonPlanCreate(BaseModel):
    class_id: int
    subject_id: int
    term: str


class LessonPlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: int
    class_id: int
    subject_id: int
    term: str
    created_at: datetime
    updated_at: datetime
    entry_count: int
    completed_count: int


class LessonPlanDetailOut(LessonPlanOut):
    entries: list[LessonPlanEntryOut]
