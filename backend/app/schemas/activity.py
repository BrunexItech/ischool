from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict


class ActivityCreate(BaseModel):
    name: str
    category: str | None = None
    date: date
    description: str | None = None
    scope: Literal["school", "class", "invited"] = "school"
    class_id: int | None = None


class ActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: int
    name: str
    category: str | None
    date: date
    description: str | None
    participant_count: int
    created_by: int | None = None
    created_by_name: str | None = None
    scope: str = "school"
    class_id: int | None = None
    class_name: str | None = None


class ParticipantAdd(BaseModel):
    student_id: int
    role: str | None = None


class ParticipantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    student_name: str
    role: str | None


class ActivityDetailOut(ActivityOut):
    participants: list[ParticipantOut]


class StudentActivityOut(BaseModel):
    activity_id: int
    activity_name: str
    category: str | None
    date: date
    role: str | None


class ActivityAwardItem(BaseModel):
    student_id: int
    title: str
    description: str | None = None
    category: str | None = None


class ActivityAwardsCreate(BaseModel):
    awards: list[ActivityAwardItem]
    notify_guardian: bool = True
