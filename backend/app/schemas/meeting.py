from datetime import datetime

from pydantic import BaseModel, Field


class MeetingCreate(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    agenda: str | None = Field(default=None, max_length=1000)
    scheduled_start: datetime
    school_ids: list[int] = Field(min_length=1)
    audience: str = "all"                       # all | selected
    teacher_ids: list[int] = []


class MeetingOut(BaseModel):
    id: int
    title: str
    agenda: str | None
    scheduled_start: datetime
    status: str
    host_name: str
    is_host: bool
    school_names: list[str]
    audience: str
    invited: int
    joined: int


class Candidate(BaseModel):
    user_id: int
    full_name: str


class CandidateSchool(BaseModel):
    school_id: int
    school_name: str
    teachers: list[Candidate]


class MeetingAttendee(BaseModel):
    user_id: int
    name: str
    school_name: str | None
    joined_at: datetime | None


class MeetingAttendance(BaseModel):
    meeting: MeetingOut
    attendees: list[MeetingAttendee]
