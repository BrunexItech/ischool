from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.core.security import ensure_password_strength, hash_password
from app.models.academics import SchoolClass, StaffProfile, Student
from app.models.teacher_assignment import TeacherAssignment
from app.models.user import User, UserRole
from app.schemas.academics import (
    GuardianAccountCreate,
    PromoteClassRequest,
    PromoteClassResult,
    SchoolClassCreate,
    SchoolClassOut,
    SchoolClassUpdate,
    StaffCreate,
    StaffOut,
    StudentAccountCreate,
    StudentCreate,
    StudentOut,
    StudentUpdate,
)
from app.schemas.user import AdminResetPasswordRequest, UserOut

router = APIRouter(prefix="/schools/{school_id}", tags=["students & staff"])

# Anyone with a login at the school can look students/classes up (teachers need
# rosters, staff need records); only admins manage enrollment/HR records.
VIEW_ROLES = (
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.TEACHER,
    UserRole.STAFF,
    UserRole.SECURITY,
    UserRole.BOARDING_STAFF,
    UserRole.TRANSPORT_STAFF,
    UserRole.BURSAR,
    UserRole.SUPERVISOR,
)
ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SUPERVISOR)
# A supervisor may register staff in a school they're linked to (their one
# named "edit" power) without getting the rest of ADMIN_ROLES' reach
# (class management, password resets).
STAFF_MANAGE_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SUPERVISOR)
ENROLL_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SUPERVISOR, UserRole.STAFF)
# Job-function roles an admin may hand out when adding a staff account —
# each narrows that login to its own working view (see require_roles usage
# in security.py / boarding.py / transport.py / finance.py / fees.py).
STAFF_CREATABLE_ROLES = (
    UserRole.TEACHER,
    UserRole.STAFF,
    UserRole.SECURITY,
    UserRole.BOARDING_STAFF,
    UserRole.TRANSPORT_STAFF,
    UserRole.BURSAR,
)


# --- Classes ---


@router.get(
    "/classes",
    response_model=list[SchoolClassOut],
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("students_staff"))],
)
def list_classes(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    return db.query(SchoolClass).filter_by(school_id=school_id).all()


@router.post(
    "/classes",
    response_model=SchoolClassOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("students_staff"))],
)
def create_class(
    school_id: int,
    payload: SchoolClassCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)

    if db.query(SchoolClass).filter_by(school_id=school_id, name=payload.name).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A class with that name already exists")

    school_class = SchoolClass(school_id=school_id, **payload.model_dump())
    db.add(school_class)
    db.commit()
    db.refresh(school_class)
    return school_class


@router.patch(
    "/classes/{class_id}",
    response_model=SchoolClassOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("students_staff"))],
)
def update_class(
    school_id: int,
    class_id: int,
    payload: SchoolClassUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    school_class = db.query(SchoolClass).filter_by(school_id=school_id, id=class_id).first()
    if school_class is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found")

    updates = payload.model_dump(exclude_unset=True)
    if "homeroom_teacher_id" in updates and updates["homeroom_teacher_id"] is not None:
        teacher = db.query(User).filter_by(id=updates["homeroom_teacher_id"], school_id=school_id, role=UserRole.TEACHER).first()
        if teacher is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "That teacher was not found at this school")
    if "name" in updates and updates["name"] != school_class.name:
        if db.query(SchoolClass).filter_by(school_id=school_id, name=updates["name"]).first():
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "A class with that name already exists")

    for field, value in updates.items():
        setattr(school_class, field, value)
    db.commit()
    db.refresh(school_class)
    return school_class


@router.post(
    "/classes/{class_id}/promote",
    response_model=PromoteClassResult,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("students_staff"))],
)
def promote_class(
    school_id: int,
    class_id: int,
    payload: PromoteClassRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bulk-moves every active student out of a class at year-end. Pass
    to_class_id to promote them into the next class, or omit it to graduate
    them (cleared class, marked inactive) — e.g. a final-year class leaving
    the school."""
    ensure_school_access(db, current_user, school_id)

    source = db.query(SchoolClass).filter_by(school_id=school_id, id=class_id).first()
    if source is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found")

    target = None
    if payload.to_class_id is not None:
        target = db.query(SchoolClass).filter_by(school_id=school_id, id=payload.to_class_id).first()
        if target is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Target class not found")
        if target.id == source.id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Target class must be different from the source class")

    students = db.query(Student).filter_by(school_id=school_id, class_id=class_id, is_active=True).all()
    graduated = payload.to_class_id is None
    for student in students:
        student.class_id = payload.to_class_id
        if graduated:
            student.is_active = False

    record_audit(
        db,
        school_id=school_id,
        actor_id=current_user.id,
        action="class.graduate" if graduated else "class.promote",
        entity_type="school_class",
        entity_id=source.id,
        after={"to_class_id": payload.to_class_id, "moved_count": len(students)},
    )

    db.commit()
    return PromoteClassResult(
        moved_count=len(students), from_class_id=class_id, to_class_id=payload.to_class_id, graduated=graduated
    )


# --- Students ---


@router.get(
    "/students",
    response_model=list[StudentOut],
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("students_staff"))],
)
def list_students(
    school_id: int,
    class_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Every other role sees the whole school; a teacher only ever sees
    students in classes they actually teach or are class teacher of — never
    the full roster of a school they merely work at."""
    ensure_school_access(db, current_user, school_id)

    if current_user.role == UserRole.TEACHER:
        assigned_class_ids = {
            row[0]
            for row in db.query(TeacherAssignment.class_id).filter_by(school_id=school_id, teacher_user_id=current_user.id)
        }
        homeroom_class_ids = {
            row[0]
            for row in db.query(SchoolClass.id).filter_by(school_id=school_id, homeroom_teacher_id=current_user.id)
        }
        allowed_class_ids = assigned_class_ids | homeroom_class_ids
        if class_id is not None and class_id not in allowed_class_ids:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You don't teach this class")
        if not allowed_class_ids:
            return []

    query = db.query(Student).filter_by(school_id=school_id)
    if class_id is not None:
        query = query.filter_by(class_id=class_id)
    elif current_user.role == UserRole.TEACHER:
        query = query.filter(Student.class_id.in_(allowed_class_ids))
    return query.all()


@router.post(
    "/students",
    response_model=StudentOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*ENROLL_ROLES)), Depends(require_feature("students_staff"))],
)
def enroll_student(
    school_id: int,
    payload: StudentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)

    if db.query(Student).filter_by(school_id=school_id, admission_number=payload.admission_number).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That admission number is already in use")

    student = Student(school_id=school_id, **payload.model_dump())
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


@router.get(
    "/students/{student_id}",
    response_model=StudentOut,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("students_staff"))],
)
def get_student(
    school_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    student = db.query(Student).filter_by(school_id=school_id, id=student_id).first()
    if student is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")
    return student


@router.patch(
    "/students/{student_id}",
    response_model=StudentOut,
    dependencies=[Depends(require_roles(*ENROLL_ROLES)), Depends(require_feature("students_staff"))],
)
def update_student(
    school_id: int,
    student_id: int,
    payload: StudentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    student = db.query(Student).filter_by(school_id=school_id, id=student_id).first()
    if student is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(student, field, value)

    db.commit()
    db.refresh(student)
    return student


@router.post(
    "/students/{student_id}/student-account",
    response_model=StudentOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*ENROLL_ROLES)), Depends(require_feature("students_staff"))],
)
def create_student_account(
    school_id: int,
    student_id: int,
    payload: StudentAccountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Issues the student their own portal login."""
    ensure_school_access(db, current_user, school_id)
    student = db.query(Student).filter_by(school_id=school_id, id=student_id).first()
    if student is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")
    if student.user_id is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This student already has a portal account")
    if db.query(User).filter_by(email=payload.email).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That email is already registered")
    ensure_password_strength(payload.password)

    user = User(
        school_id=school_id,
        email=payload.email,
        full_name=f"{student.first_name} {student.last_name}",
        hashed_password=hash_password(payload.password),
        role=UserRole.STUDENT,
        must_change_password=True,
    )
    db.add(user)
    db.flush()
    student.user_id = user.id
    db.commit()
    db.refresh(student)
    return student


@router.post(
    "/students/{student_id}/guardian-account",
    response_model=StudentOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*ENROLL_ROLES)), Depends(require_feature("students_staff"))],
)
def create_guardian_account(
    school_id: int,
    student_id: int,
    payload: GuardianAccountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Issues a parent/guardian portal login. If a guardian account with this
    email already exists at the school (a sibling already enrolled it), this
    just links this student to that same account instead of erroring."""
    ensure_school_access(db, current_user, school_id)
    student = db.query(Student).filter_by(school_id=school_id, id=student_id).first()
    if student is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")
    if student.guardian_user_id is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This student already has a linked guardian account")

    existing = db.query(User).filter_by(email=payload.email).first()
    if existing is not None:
        if existing.role != UserRole.PARENT or existing.school_id != school_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "That email is already registered to a different account")
        guardian = existing
    else:
        ensure_password_strength(payload.password)
        guardian = User(
            school_id=school_id,
            email=payload.email,
            full_name=payload.full_name or student.guardian_name or "Guardian",
            hashed_password=hash_password(payload.password),
            role=UserRole.PARENT,
            must_change_password=True,
        )
        db.add(guardian)
        db.flush()

    student.guardian_user_id = guardian.id
    db.commit()
    db.refresh(student)
    return student


# --- Staff ---


def _staff_out(profile: StaffProfile) -> StaffOut:
    return StaffOut(
        id=profile.id,
        user_id=profile.user_id,
        school_id=profile.school_id,
        email=profile.user.email,
        full_name=profile.user.full_name,
        role=profile.user.role,
        staff_number=profile.staff_number,
        department=profile.department,
        phone=profile.phone,
        tsc_number=profile.tsc_number,
    )


@router.get(
    "/staff",
    response_model=list[StaffOut],
    dependencies=[Depends(require_roles(*STAFF_MANAGE_ROLES)), Depends(require_feature("students_staff"))],
)
def list_staff(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    profiles = db.query(StaffProfile).filter_by(school_id=school_id).all()
    return [_staff_out(p) for p in profiles]


@router.post(
    "/staff",
    response_model=StaffOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*STAFF_MANAGE_ROLES)), Depends(require_feature("students_staff"))],
)
def create_staff(
    school_id: int,
    payload: StaffCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)

    if payload.role not in STAFF_CREATABLE_ROLES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Not a valid staff role")
    if db.query(User).filter_by(email=payload.email).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That email is already registered")
    if db.query(StaffProfile).filter_by(school_id=school_id, staff_number=payload.staff_number).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That staff number is already in use")
    ensure_password_strength(payload.password)

    user = User(
        school_id=school_id,
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        must_change_password=True,
    )
    db.add(user)
    db.flush()  # get user.id before creating the profile row

    profile = StaffProfile(
        school_id=school_id,
        user_id=user.id,
        staff_number=payload.staff_number,
        department=payload.department,
        phone=payload.phone,
        tsc_number=payload.tsc_number,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return _staff_out(profile)


# --- Account management ---


@router.post(
    "/users/{user_id}/reset-password",
    response_model=UserOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("students_staff"))],
)
def admin_reset_password(
    school_id: int,
    user_id: int,
    payload: AdminResetPasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """A school admin sets a new password directly for an account they manage
    (staff, student, or guardian) — e.g. when someone is locked out and can't
    self-serve a reset. The user must change it again at next login."""
    ensure_school_access(db, current_user, school_id)
    target = db.query(User).filter_by(id=user_id, school_id=school_id).first()
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    ensure_password_strength(payload.new_password)
    target.hashed_password = hash_password(payload.new_password)
    target.must_change_password = True
    db.commit()
    db.refresh(target)
    return target
