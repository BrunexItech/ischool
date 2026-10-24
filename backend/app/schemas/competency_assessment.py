from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.models.competency_assessment import PerformanceLevel


class CompetencyAssessmentCreate(BaseModel):
    student_id: int
    class_id: int
    subject_id: int
    term: str
    strand: str
    sub_strand: str | None = None
    criterion: str
    performance_level: PerformanceLevel
    assessment_date: date
    teacher_comment: str | None = None
    follow_up_action: str | None = None


class CompetencyAssessmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: int
    student_id: int
    class_id: int
    subject_id: int
    teacher_user_id: int | None
    term: str
    strand: str
    sub_strand: str | None
    criterion: str
    performance_level: PerformanceLevel
    assessment_date: date
    teacher_comment: str | None
    follow_up_action: str | None
    created_at: datetime
