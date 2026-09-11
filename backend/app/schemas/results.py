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
