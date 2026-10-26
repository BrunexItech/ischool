"""Who may give an award to whom, and the shared way an award is created."""

from datetime import date

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.notify import notify
from app.models.academic_term import AcademicTerm
from app.models.academics import SchoolClass, Student
from app.models.award import Award
from app.models.teacher_assignment import TeacherAssignment
from app.models.user import User, UserRole

ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL)


def is_admin(user: User) -> bool:
    return user.role in ADMIN_ROLES


def teacher_class_ids(db: Session, school_id: int, user: User) -> set[int]:
    """Every class a teacher teaches in or runs as class teacher."""
    assigned = {a.class_id for a in db.query(TeacherAssignment).filter_by(school_id=school_id, teacher_user_id=user.id).all()}
    homeroom = {c.id for c in db.query(SchoolClass).filter_by(school_id=school_id, homeroom_teacher_id=user.id).all()}
    return assigned | homeroom


def homeroom_class_ids(db: Session, school_id: int, user: User) -> set[int]:
    return {c.id for c in db.query(SchoolClass).filter_by(school_id=school_id, homeroom_teacher_id=user.id).all()}


def term_for(db: Session, school_id: int, on: date) -> str | None:
    terms = db.query(AcademicTerm).filter_by(school_id=school_id).all()
    for t in terms:
        if t.start_date and t.end_date and t.start_date <= on <= t.end_date:
            return t.name
    current = next((t for t in terms if t.is_current), None)
    return current.name if current else None


def can_see_award(db: Session, school_id: int, user: User, award: Award) -> bool:
    if is_admin(user):
        return True
    if award.awarded_by == user.id:
        return True
    if award.scope == "school":
        return True
    if award.scope == "staff":
        return award.staff_user_id == user.id
    if user.role == UserRole.TEACHER:
        classes = teacher_class_ids(db, school_id, user)
        if award.scope == "class":
            return award.class_id in classes
        if award.scope == "student":
            return award.student is not None and award.student.class_id in classes
    return False


def notify_award(db: Session, award: Award, students: list[Student]) -> None:
    """Tell the guardians (and the learner, if they have a login). A school-wide
    award is announced through Announcements instead, not as thousands of alerts."""
    for s in students:
        for uid in {s.guardian_user_id, s.user_id} - {None}:
            notify(
                db,
                school_id=award.school_id,
                user_id=uid,
                title=f"{s.first_name} received an award" if uid == s.guardian_user_id else "You received an award",
                body=award.title,
                link=None,
            )


def create_award(
    db: Session,
    *,
    school_id: int,
    giver: User,
    scope: str,
    title: str,
    date_awarded: date,
    description: str | None = None,
    category: str | None = None,
    student: Student | None = None,
    staff_user_id: int | None = None,
    school_class: SchoolClass | None = None,
    subject_id: int | None = None,
    activity_id: int | None = None,
    notify_guardian: bool = True,
) -> Award:
    """Builds, stores and (optionally) announces one award. The caller has
    already checked the giver is allowed to make it."""
    award = Award(
        school_id=school_id,
        scope=scope,
        student_id=student.id if student else None,
        staff_user_id=staff_user_id,
        class_id=school_class.id if school_class else None,
        subject_id=subject_id,
        activity_id=activity_id,
        title=title.strip(),
        description=(description or "").strip() or None,
        category=(category or "").strip() or None,
        date_awarded=date_awarded,
        term=term_for(db, school_id, date_awarded),
        awarded_by=giver.id,
    )
    db.add(award)
    db.flush()
    if notify_guardian:
        if scope == "student" and student is not None:
            notify_award(db, award, [student])
        elif scope == "class" and school_class is not None:
            notify_award(db, award, db.query(Student).filter_by(school_id=school_id, class_id=school_class.id, is_active=True).all())
    return award


def deny(message: str):
    raise HTTPException(status.HTTP_403_FORBIDDEN, message)
