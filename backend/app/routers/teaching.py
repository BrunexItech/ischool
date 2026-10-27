from app.core.subjects import ensure_subject_fits_class
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dates import school_today
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.models.academics import SchoolClass, Student
from app.models.attendance import AttendanceRecord
from app.models.teacher_assignment import TeacherAssignment
from app.models.user import User, UserRole
from app.schemas.teaching import ClassTeacherRow, ClassTeacherSet, MyClassOut, MyClassSubjectOut, TeacherAssignmentCreate, TeacherAssignmentOut

router = APIRouter(prefix="/schools/{school_id}/teacher-assignments", tags=["teacher assignments"])

ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL, UserRole.SECRETARY)


@router.get(
    "/mine",
    response_model=list[MyClassOut],
    dependencies=[Depends(require_roles(UserRole.TEACHER)), Depends(require_feature("students_staff"))],
)
def list_my_classes(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """A teacher's own landing view: one card per class, listing every
    subject they teach there, plus whether they're its class teacher — a
    class teacher who also teaches a subject in their own class sees one
    card, not two."""
    ensure_school_access(db, current_user, school_id)
    today = school_today(db, school_id)

    rows: dict[int, MyClassOut] = {}

    def _row(cls: SchoolClass) -> MyClassOut:
        if cls.id not in rows:
            student_count = db.query(Student).filter_by(school_id=school_id, class_id=cls.id, is_active=True).count()
            marked_today = (
                db.query(AttendanceRecord.id).filter_by(school_id=school_id, class_id=cls.id, date=today).first()
                is not None
            )
            is_homeroom = cls.homeroom_teacher_id == current_user.id
            rows[cls.id] = MyClassOut(
                class_id=cls.id,
                class_name=cls.name,
                is_homeroom_teacher=is_homeroom,
                can_mark_attendance=is_homeroom,
                subjects=[],
                student_count=student_count,
                attendance_marked_today=marked_today,
            )
        return rows[cls.id]

    assignments = (
        db.query(TeacherAssignment)
        .filter_by(school_id=school_id, teacher_user_id=current_user.id)
        .all()
    )
    for a in assignments:
        row = _row(a.school_class)
        if a.subject_id is None:
            row.can_mark_attendance = True
        elif not any(s.subject_id == a.subject_id for s in row.subjects):
            row.subjects.append(MyClassSubjectOut(subject_id=a.subject_id, subject_name=a.subject.name if a.subject else f"#{a.subject_id}"))

    homeroom_classes = db.query(SchoolClass).filter_by(school_id=school_id, homeroom_teacher_id=current_user.id).all()
    for cls in homeroom_classes:
        _row(cls)

    for row in rows.values():
        row.subjects.sort(key=lambda s: s.subject_name)

    return sorted(rows.values(), key=lambda r: r.class_name)


@router.get(
    "",
    response_model=list[TeacherAssignmentOut],
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("students_staff"))],
)
def list_assignments(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    return db.query(TeacherAssignment).filter_by(school_id=school_id).all()


@router.post(
    "",
    response_model=TeacherAssignmentOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("students_staff"))],
)
def create_assignment(
    school_id: int,
    payload: TeacherAssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)

    teacher = db.query(User).filter_by(id=payload.teacher_user_id, school_id=school_id, role=UserRole.TEACHER).first()
    if teacher is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That user is not a teacher at this school")

    if payload.subject_id is not None:
        ensure_subject_fits_class(db, school_id, payload.subject_id, payload.class_id)

    existing = (
        db.query(TeacherAssignment)
        .filter_by(teacher_user_id=payload.teacher_user_id, class_id=payload.class_id, subject_id=payload.subject_id)
        .first()
    )
    if existing:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That assignment already exists")

    assignment = TeacherAssignment(school_id=school_id, **payload.model_dump())
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


@router.delete(
    "/{assignment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("students_staff"))],
)
def delete_assignment(
    school_id: int,
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    assignment = db.query(TeacherAssignment).filter_by(school_id=school_id, id=assignment_id).first()
    if assignment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assignment not found")
    db.delete(assignment)
    db.commit()


# --- Class teachers ---


def _class_teacher_rows(db: Session, school_id: int) -> list[ClassTeacherRow]:
    classes = db.query(SchoolClass).filter_by(school_id=school_id).all()
    classes.sort(key=lambda c: ((c.grade.sort_order if c.grade else 999), c.name))
    return [
        ClassTeacherRow(
            class_id=c.id,
            class_name=c.name,
            level=c.grade.level_group.value if c.grade else "other",
            teacher_user_id=c.homeroom_teacher_id,
            teacher_name=c.homeroom_teacher.full_name if c.homeroom_teacher else None,
            other_class_of_teacher=None,
        )
        for c in classes
    ]


@router.get(
    "/class-teachers",
    response_model=list[ClassTeacherRow],
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("students_staff"))],
)
def list_class_teachers(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Every class with its one class teacher (or none yet)."""
    ensure_school_access(db, current_user, school_id)
    return _class_teacher_rows(db, school_id)


@router.put(
    "/class-teachers/{class_id}",
    response_model=ClassTeacherRow,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("students_staff"))],
)
def set_class_teacher(school_id: int, class_id: int, payload: ClassTeacherSet, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """A class has exactly one class teacher. Naming someone when the class
    already has another is refused unless the caller says to replace them,
    and a teacher already running a different class is refused outright, so
    the change is always deliberate."""
    ensure_school_access(db, current_user, school_id)
    cls = db.query(SchoolClass).filter_by(school_id=school_id, id=class_id).first()
    if cls is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found")
    if payload.teacher_user_id is None:
        cls.homeroom_teacher_id = None
    else:
        teacher = db.query(User).filter_by(id=payload.teacher_user_id, school_id=school_id, role=UserRole.TEACHER, is_active=True).first()
        if teacher is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "That teacher was not found at this school")
        if cls.homeroom_teacher_id == teacher.id:
            return next(r for r in _class_teacher_rows(db, school_id) if r.class_id == class_id)
        elsewhere = db.query(SchoolClass).filter(SchoolClass.school_id == school_id, SchoolClass.homeroom_teacher_id == teacher.id, SchoolClass.id != class_id).first()
        if elsewhere:
            raise HTTPException(status.HTTP_409_CONFLICT, f"{teacher.full_name} is already the class teacher of {elsewhere.name}. A teacher can be class teacher of one class; remove them there first.")
        if cls.homeroom_teacher_id is not None and not payload.replace:
            raise HTTPException(status.HTTP_409_CONFLICT, f"{cls.name} already has a class teacher, {cls.homeroom_teacher.full_name}. Confirm to replace them.")
        cls.homeroom_teacher_id = teacher.id
    db.commit()
    return next(r for r in _class_teacher_rows(db, school_id) if r.class_id == class_id)
