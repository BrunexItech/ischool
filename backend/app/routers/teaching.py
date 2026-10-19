from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.models.academics import SchoolClass, Student
from app.models.attendance import AttendanceRecord
from app.models.teacher_assignment import TeacherAssignment
from app.models.user import User, UserRole
from app.schemas.teaching import MyClassOut, TeacherAssignmentCreate, TeacherAssignmentOut

router = APIRouter(prefix="/schools/{school_id}/teacher-assignments", tags=["teacher assignments"])

ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SUPERVISOR)


@router.get(
    "/mine",
    response_model=list[MyClassOut],
    dependencies=[Depends(require_roles(UserRole.TEACHER)), Depends(require_feature("students_staff"))],
)
def list_my_classes(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """A teacher's own landing view: every class/subject they're assigned to
    teach, plus every class they're the homeroom teacher of (even without an
    explicit TeacherAssignment row) — so 'my classes' never misses the one
    class a homeroom teacher is most responsible for."""
    ensure_school_access(db, current_user, school_id)
    today = date.today()

    rows: dict[tuple[int, int | None], MyClassOut] = {}

    def _add(cls: SchoolClass, subject_id: int | None, subject_name: str | None):
        key = (cls.id, subject_id)
        if key in rows:
            return
        student_count = db.query(Student).filter_by(school_id=school_id, class_id=cls.id, is_active=True).count()
        marked_today = (
            db.query(AttendanceRecord.id).filter_by(school_id=school_id, class_id=cls.id, date=today).first() is not None
        )
        is_homeroom = cls.homeroom_teacher_id == current_user.id
        rows[key] = MyClassOut(
            class_id=cls.id,
            class_name=cls.name,
            subject_id=subject_id,
            subject_name=subject_name,
            is_homeroom_teacher=is_homeroom,
            can_mark_attendance=is_homeroom or subject_id is None,
            student_count=student_count,
            attendance_marked_today=marked_today,
        )

    assignments = (
        db.query(TeacherAssignment)
        .filter_by(school_id=school_id, teacher_user_id=current_user.id)
        .all()
    )
    for a in assignments:
        _add(a.school_class, a.subject_id, a.subject.name if a.subject else None)

    homeroom_classes = db.query(SchoolClass).filter_by(school_id=school_id, homeroom_teacher_id=current_user.id).all()
    for cls in homeroom_classes:
        _add(cls, None, None)

    return sorted(rows.values(), key=lambda r: (r.class_name, r.subject_name or ""))


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
