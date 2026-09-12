from pydantic import BaseModel, ConfigDict


class TeacherAssignmentCreate(BaseModel):
    teacher_user_id: int
    class_id: int
    subject_id: int | None = None


class TeacherAssignmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: int
    teacher_user_id: int
    class_id: int
    subject_id: int | None
