from datetime import date, datetime

from pydantic import BaseModel

from app.schemas.oversight import ActivityEvent, PulseSection


class GroupSchool(BaseModel):
    id: int
    name: str


class GroupModuleInfo(BaseModel):
    key: str
    title: str
    blurb: str


class GroupColumn(BaseModel):
    key: str
    label: str
    kind: str
    better: str | None
    hint: str | None


class GroupRow(BaseModel):
    school_id: int
    school_name: str
    enabled: bool
    values: dict[str, float | int | None]


class GroupComparison(BaseModel):
    key: str
    title: str
    blurb: str
    href: str
    columns: list[GroupColumn]
    rows: list[GroupRow]
    group: dict[str, float | int | None]
    marks: dict[str, dict[str, str]]


class GroupSchoolCard(BaseModel):
    school_id: int
    name: str
    learners: int
    teachers: int
    attendance_today: float | None
    registers_taken: int | None
    registers_total: int | None
    fee_rate: float | None
    outstanding: float
    attention: int
    urgent: int


class GroupAttention(BaseModel):
    school_id: int
    school_name: str
    text: str
    tone: str
    href: str | None


class GroupDecision(BaseModel):
    school_id: int
    school_name: str
    kind: str
    title: str
    detail: str
    age_days: int


class GroupAttentionSummary(BaseModel):
    """The slow half of the overview: what needs attention in each school. Loaded separately so the page can open at once."""

    per_school: dict[str, dict[str, int]]     # school id -> {"attention": n, "urgent": n}
    total: int
    urgent: int
    items: list[GroupAttention]
    spotlight: list[str]


class GroupOverview(BaseModel):
    week_start: date | None = None
    week_end: date | None = None
    principal: str
    schools: list[GroupSchoolCard]
    learners: int
    teachers: int
    attendance_today: float | None
    fee_rate: float | None
    outstanding: float
    attention_total: int
    attention: list[GroupAttention]
    decisions: list[GroupDecision]
    spotlight: list[str]


class GroupActivityEvent(ActivityEvent):
    school_id: int
    school_name: str


class GroupActivity(BaseModel):
    start: date
    end: date
    total: int
    counts: dict[str, int]
    by_school: dict[str, int]
    events: list[GroupActivityEvent]


class GroupReportSection(BaseModel):
    key: str
    title: str
    href: str
    columns: list[GroupColumn]
    rows: list[GroupRow]
    group: dict[str, float | int | None]


class GroupWeeklyReport(BaseModel):
    principal: str
    week_start: date
    week_end: date
    headline: str
    schools: list[GroupSchoolCard]
    attention: list[GroupAttention]
    decisions: list[GroupDecision]
    spotlight: list[str]
    sections: list[GroupReportSection]
