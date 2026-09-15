from pydantic import BaseModel, ConfigDict


class SubjectCreate(BaseModel):
    name: str


class SubjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: int
    name: str


class ResultUpsert(BaseModel):
    student_id: int
    subject_id: int
    term: str
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
    score: float
    grade: str | None
    remarks: str | None


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
