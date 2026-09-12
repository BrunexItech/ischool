from datetime import date

from pydantic import BaseModel, ConfigDict

from app.models.user import UserRole


class SchoolClassCreate(BaseModel):
    name: str
    grade_level: str | None = None
    homeroom_teacher_id: int | None = None


class SchoolClassOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: int
    name: str
    grade_level: str | None
    homeroom_teacher_id: int | None


class StudentCreate(BaseModel):
    admission_number: str
    first_name: str
    last_name: str
    date_of_birth: date | None = None
    gender: str | None = None
    class_id: int | None = None
    guardian_name: str | None = None
    guardian_phone: str | None = None
    guardian_email: str | None = None


class StudentUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    date_of_birth: date | None = None
    gender: str | None = None
    class_id: int | None = None
    guardian_name: str | None = None
    guardian_phone: str | None = None
    guardian_email: str | None = None
    is_active: bool | None = None


class StudentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: int
    admission_number: str
    first_name: str
    last_name: str
    date_of_birth: date | None
    gender: str | None
    class_id: int | None
    guardian_name: str | None
    guardian_phone: str | None
    guardian_email: str | None
    is_active: bool
    has_student_account: bool
    has_guardian_account: bool
    user_id: int | None
    guardian_user_id: int | None


class StudentAccountCreate(BaseModel):
    email: str
    password: str


class GuardianAccountCreate(BaseModel):
    email: str
    password: str
    full_name: str | None = None


class StaffCreate(BaseModel):
    email: str
    full_name: str
    password: str
    role: UserRole
    staff_number: str
    department: str | None = None
    phone: str | None = None


class StaffOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    school_id: int
    email: str
    full_name: str
    role: UserRole
    staff_number: str
    department: str | None
    phone: str | None
