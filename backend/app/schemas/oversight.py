from datetime import date

from pydantic import BaseModel


class ClassCard(BaseModel):
    id: int
    name: str
    grade_code: str | None
    grade_name: str | None
    level: str
    homeroom_teacher_id: int | None
    homeroom_teacher_name: str | None
    learners: int
    teachers: int
    subjects: int
    register_today: str            # "taken" | "missing" | "not_a_school_day"
    attendance_rate: float | None  # most recent register
    attendance_date: date | None
    average: float | None
    topics_covered: int
    topics_total: int
    homework_this_week: int
    open_conduct: int


class ClassTeacherRow(BaseModel):
    subject_id: int
    subject: str
    teacher_id: int | None
    teacher: str | None
    topics_covered: int
    topics_total: int
    homework_this_week: int
    last_taught: date | None


class ClassLearner(BaseModel):
    id: int
    name: str
    admission_number: str
    attendance_rate: float | None
    average: float | None


class ClassDay(BaseModel):
    date: date
    rate: float
    marked: int


class SubjectAverage(BaseModel):
    subject: str
    average: float


class ClassHomework(BaseModel):
    id: int
    title: str
    subject: str
    due_date: date
    given_on_board: bool
    teacher: str | None


class ClassConduct(BaseModel):
    id: int
    student_name: str
    category: str
    status: str
    incident_date: date


class ClassDetail(BaseModel):
    card: ClassCard
    term: str | None
    teacher_rows: list[ClassTeacherRow]
    learners_list: list[ClassLearner]
    attendance_days: list[ClassDay]
    subject_averages: list[SubjectAverage]
    homework: list[ClassHomework]
    conduct: list[ClassConduct]
    boys: int
    girls: int


class StreamsCreate(BaseModel):
    grade_level_id: int
    streams: list[str]


class StreamsResult(BaseModel):
    created: list[str]
    skipped: list[str]


class TeacherCard(BaseModel):
    user_id: int
    name: str
    email: str
    phone: str | None
    staff_number: str | None
    tsc_number: str | None
    department: str | None
    categories: list[str]
    classes: list[str]
    class_teacher_of: list[str]
    subjects: list[str]
    today: str | None              # present | late | absent | on_leave | expected | None (not a school day / not tracked)
    topics_covered: int
    topics_total: int
    topics_expected: int | None
    lessons_marked_week: int
    lessons_scheduled_week: int
    homework_week: int
    plans: int


class HomeworkCell(BaseModel):
    date: date
    status: str            # given | board | none | missing | upcoming | no_lesson
    count: int
    titles: list[str]


class HomeworkRow(BaseModel):
    class_id: int
    class_name: str
    subject_id: int
    subject: str
    teacher: str | None
    cells: list[HomeworkCell]


class HomeworkSummary(BaseModel):
    given: int
    board: int
    none: int
    missing: int
    expected: int


class HomeworkGrid(BaseModel):
    week_start: date
    days: list[date]
    rows: list[HomeworkRow]
    summary: HomeworkSummary


class Absentee(BaseModel):
    name: str
    status: str
    reason: str | None


class AttendanceClassRow(BaseModel):
    class_id: int
    class_name: str
    level: str
    learners: int
    register_status: str     # taken | missing | not_a_school_day
    taken_by: str | None
    present: int
    late: int
    excused: int
    absent: int
    rate: float | None
    absentees: list[Absentee]


class AttendanceOversight(BaseModel):
    date: date
    school_day: bool
    holiday: str | None
    classes_total: int
    classes_taken: int
    school_rate: float | None
    learners_marked: int
    rows: list[AttendanceClassRow]


class InboxItem(BaseModel):
    kind: str
    title: str
    detail: str
    age_days: int
    href: str


class Pulse(BaseModel):
    school_day: bool
    holiday: str | None
    learners: int
    teachers: int
    classes: int
    attendance_rate: float | None
    registers_taken: int
    registers_total: int
    staff_present: int
    staff_late: int
    staff_absent: int
    staff_on_leave: int
    staff_expected: int
    lessons_scheduled: int
    lessons_marked: int
    unmarked_yesterday: int


class HeadOverview(BaseModel):
    pulse: Pulse
    inbox: list[InboxItem]
    inbox_counts: dict[str, int]


# --- Module pulses and the weekly report ---


class Tile(BaseModel):
    label: str
    value: str
    hint: str | None = None
    tone: str = "neutral"      # neutral | good | warn | bad


class Attention(BaseModel):
    text: str
    tone: str = "warn"         # warn | bad | good
    href: str | None = None


class PulseSection(BaseModel):
    key: str
    title: str
    href: str
    summary: str               # one line: the headline for this area
    tiles: list[Tile]
    attention: list[Attention]


class WeeklyReport(BaseModel):
    school_name: str
    term: str | None
    week_start: date
    week_end: date
    headline: str
    attention_count: int
    sections: list[PulseSection]


class MarkOverride(BaseModel):
    """A head's correction to a mark a teacher recorded. The reason is required
    and kept in the activity log; the teacher is told."""

    student_id: int
    subject_id: int
    term: str
    exam_type: str
    score: float
    reason: str
