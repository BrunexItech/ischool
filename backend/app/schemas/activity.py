from datetime import date

from pydantic import BaseModel, ConfigDict


class ActivityCreate(BaseModel):
    name: str
    category: str | None = None
    date: date
    description: str | None = None


class ActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: int
    name: str
    category: str | None
    date: date
    description: str | None
    participant_count: int


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
