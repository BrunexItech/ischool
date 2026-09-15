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
