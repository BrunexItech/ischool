from datetime import date, time
from typing import Literal

from pydantic import BaseModel

from app.schemas.lesson_plan import LessonPlanEntryOut

DeliveryStatus = Literal["taught", "partly", "not_taught"]
NotTaughtReason = Literal["teacher_absent", "public_holiday", "exams", "school_event", "other"]


class DeliveryCreate(BaseModel):
    timetable_slot_id: int
    lesson_date: date
    status: DeliveryStatus
    reason: NotTaughtReason | None = None
    remark: str | None = None
    entry_id: int | None = None


class DeliveryOut(BaseModel):
    id: int
    entry_id: int | None
    status: DeliveryStatus
    reason: str | None
    remark: str | None
    topic: str | None


class LessonPlanRef(BaseModel):
    plan_id: int
    term: str
    entry_count: int
    completed_count: int


class LessonItemOut(BaseModel):
    slot_id: int
    class_id: int
    class_name: str
    subject_id: int
    subject_name: str
    start_time: time
    end_time: time
    room: str | None
    plan: LessonPlanRef | None
    entry: LessonPlanEntryOut | None
    delivery: DeliveryOut | None


class LessonDayOut(BaseModel):
    date: date
    is_today: bool
    holiday: str | None
    lessons: list[LessonItemOut]


class RecordOfWorkRow(BaseModel):
    id: int
    lesson_date: date
    start_time: time
    end_time: time
    teacher_user_id: int
    teacher_name: str
    class_name: str
    subject_name: str
    topic: str | None
    status: DeliveryStatus
    reason: str | None
    remark: str | None


class CoverageRow(BaseModel):
    teacher_user_id: int | None
    teacher_name: str
    class_id: int
    class_name: str
    subject_id: int
    subject_name: str
    plan_id: int | None
    entry_count: int
    completed_count: int
    expected_covered: int | None
    taught: int
    partly: int
    not_taught: int
    reasons: dict[str, int]
    last_taught: date | None


class CoverageOut(BaseModel):
    term: str
    start_date: date | None
    end_date: date | None
    rows: list[CoverageRow]


class ReorderPayload(BaseModel):
    entry_ids: list[int]


class DuplicatePayload(BaseModel):
    class_id: int
    subject_id: int
    term: str
