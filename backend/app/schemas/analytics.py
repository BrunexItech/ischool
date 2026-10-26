from pydantic import BaseModel


class SubjectAverage(BaseModel):
    subject: str
    average: float
    count: int


class ClassAverage(BaseModel):
    class_name: str
    average: float
    count: int


class GradeCount(BaseModel):
    grade: str
    count: int


class TopStudent(BaseModel):
    student_name: str
    average: float


class TermTrendPoint(BaseModel):
    term: str
    average: float


class ResultsAnalyticsOut(BaseModel):
    overall_average: float | None
    result_count: int
    subject_averages: list[SubjectAverage]
    class_averages: list[ClassAverage]
    grade_distribution: list[GradeCount]
    top_students: list[TopStudent]
    term_trend: list[TermTrendPoint]


# --- Insights: the head's "what needs attention" view ---


class ScoreFigure(BaseModel):
    value: float | None
    previous: float | None = None


class CoverageFigure(BaseModel):
    completed: int
    total: int
    expected: int | None


class Scorecard(BaseModel):
    average: ScoreFigure
    attendance_rate: ScoreFigure
    coverage: CoverageFigure
    below_expectation: int | None
    below_expectation_previous: int | None
    learners: int
    previous_term: str | None


class DroppedLearner(BaseModel):
    student_id: int
    name: str
    class_name: str
    average: float
    previous: float
    drop: float


class AbsenceStreak(BaseModel):
    student_id: int
    name: str
    class_name: str
    days: int
    since: str


class WeakSubject(BaseModel):
    class_id: int
    class_name: str
    subject_id: int
    subject_name: str
    average: float
    previous: float | None
    learners: int


class BehindTeacher(BaseModel):
    teacher_name: str
    class_name: str
    subject_name: str
    plan_id: int | None
    completed: int
    expected: int
    behind: int


class Attention(BaseModel):
    dropped_learners: list[DroppedLearner]
    absence_streaks: list[AbsenceStreak]
    weak_subjects: list[WeakSubject]
    behind_teachers: list[BehindTeacher]
    meeting_line: float | None


class ExamTypeAverage(BaseModel):
    exam_type: str
    average: float
    count: int


class ClassPoint(BaseModel):
    class_id: int
    class_name: str
    average: float
    count: int


class SubjectLevels(BaseModel):
    subject_id: int
    subject: str
    counts: dict[str, int]
    total: int


class LevelBand(BaseModel):
    level_code: str
    label: str
    min_score: float
    max_score: float


class CalendarDay(BaseModel):
    date: str
    rate: float
    marked: int


class ScatterPoint(BaseModel):
    attendance: float
    average: float


class ReasonCount(BaseModel):
    reason: str
    count: int


class AttendanceInsights(BaseModel):
    calendar: list[CalendarDay]
    reasons: list[ReasonCount]
    without_reason: int
    scatter: list[ScatterPoint]
    correlation: float | None


class DeliveryInsights(BaseModel):
    taught: int
    partly: int
    not_taught: int
    reasons: dict[str, int]


class InsightsOut(BaseModel):
    term: str
    start_date: str | None
    end_date: str | None
    scorecard: Scorecard
    attention: Attention
    exam_types: list[ExamTypeAverage]
    classes: list[ClassPoint]
    school_average: float | None
    levels: list[SubjectLevels]
    bands: list[LevelBand]
    attendance: AttendanceInsights
    delivery: DeliveryInsights
