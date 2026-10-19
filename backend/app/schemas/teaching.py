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


class MyClassSubjectOut(BaseModel):
    subject_id: int
    subject_name: str


class MyClassOut(BaseModel):
    class_id: int
    class_name: str
    is_homeroom_teacher: bool
    can_mark_attendance: bool
    subjects: list[MyClassSubjectOut]
    student_count: int
    attendance_marked_today: bool
