from pydantic import BaseModel, ConfigDict

from app.schemas.competency_assessment import CompetencyAssessmentOut


class SubjectCreate(BaseModel):
    name: str
    grade_level_ids: list[int] = []


class SubjectUpdate(BaseModel):
    name: str | None = None
    grade_level_ids: list[int] | None = None


class SubjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: int
    name: str
    grade_level_ids: list[int] = []


class ResultUpsert(BaseModel):
    student_id: int
    subject_id: int
    term: str
    exam_type: str = "Not specified"
    score: float
    grade: str | None = None
    remarks: str | None = None


class ResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: int
    student_id: int
    subject_id: int
    term: str
    exam_type: str
    score: float
    grade: str | None
    remarks: str | None
    recorded_by: int | None = None
    subject_name: str | None = None


class ReportCardRow(BaseModel):
    subject_name: str
    score: float
    grade: str | None
    remarks: str | None


class ReportCardOut(BaseModel):
    school_name: str
    school_logo_url: str | None
    school_primary_color: str
    student_name: str
    admission_number: str
    class_name: str | None
    term: str
    rows: list[ReportCardRow]
    average: float | None
    overall_grade: str | None
    class_position: str | None
    attendance_rate: float | None
    class_teacher_remark: str | None
    principal_remark: str | None
    competency_assessments: list[CompetencyAssessmentOut] = []


class ReportCardRemarkUpdate(BaseModel):
    class_teacher_remark: str | None = None
    principal_remark: str | None = None


class BoardSubject(BaseModel):
    id: int
    name: str


class BoardStudent(BaseModel):
    student_id: int
    name: str
    admission_number: str
    scores: dict[int, float | None]
    levels: dict[int, str | None]
    total: float
    average: float | None
    level: str | None
    subjects_marked: int
    rank: int | None


class BoardBand(BaseModel):
    level_code: str
    label: str
    min_score: float
    max_score: float


class ResultsBoardOut(BaseModel):
    class_id: int
    class_name: str
    term: str
    selected_exam_types: list[str]
    available_exam_types: list[str]
    subjects: list[BoardSubject]
    students: list[BoardStudent]
    bands: list[BoardBand]
    ranked: bool
    class_average: float | None
