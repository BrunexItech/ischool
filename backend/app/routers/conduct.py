from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.core.notify import notify
from app.models.academics import SchoolClass, Student
from app.models.conduct_report import ConductReport, ConductStatus
from app.models.teacher_assignment import TeacherAssignment
from app.models.user import User, UserRole
from app.schemas.conduct_report import ConductReportCreate, ConductReportOut, ConductReportRespond

router = APIRouter(prefix="/schools/{school_id}/conduct-reports", tags=["conduct"])

REPORT_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL, UserRole.TEACHER, UserRole.STAFF)
ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL)
VIEW_ROLES = REPORT_ROLES + (UserRole.STUDENT, UserRole.PARENT)


def _out(report: ConductReport) -> ConductReportOut:
    return ConductReportOut(
        id=report.id,
        school_id=report.school_id,
        student_id=report.student_id,
        class_id=report.class_id,
        reported_by=report.reported_by,
        reported_by_name=report.reported_by_name,
        category=report.category,
        description=report.description,
        action_taken=report.action_taken,
        incident_date=report.incident_date,
        status=report.status,
        response=report.response,
        responded_by=report.responded_by,
        responded_at=report.responded_at,
        created_at=report.created_at,
        student_name=f"{report.student.first_name} {report.student.last_name}",
    )


@router.post(
    "",
    response_model=ConductReportOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*REPORT_ROLES)), Depends(require_feature("conduct"))],
)
def create_conduct_report(
    school_id: int, payload: ConductReportCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """A teacher can only report a student they actually teach (same reach
    as awarding one); staff/admin can report anyone at the school."""
    ensure_school_access(db, current_user, school_id)

    student = db.query(Student).filter_by(school_id=school_id, id=payload.student_id).first()
    if student is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That student does not belong to this school")

    if current_user.role == UserRole.TEACHER:
        is_assigned = (
            db.query(TeacherAssignment).filter_by(school_id=school_id, teacher_user_id=current_user.id, class_id=student.class_id).first()
            is not None
        )
        is_homeroom = (
            student.class_id is not None
            and db.query(SchoolClass).filter_by(id=student.class_id, homeroom_teacher_id=current_user.id).first() is not None
        )
        if not (is_assigned or is_homeroom):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You don't teach this student")

    report = ConductReport(
        school_id=school_id,
        student_id=student.id,
        class_id=student.class_id,
        reported_by=current_user.id,
        reported_by_name=current_user.full_name,
        category=payload.category,
        description=payload.description,
        action_taken=payload.action_taken,
        incident_date=payload.incident_date,
    )
    db.add(report)
    db.flush()

    for user_id in {student.user_id, student.guardian_user_id}:
        if user_id is None:
            continue
        notify(
            db,
            school_id=school_id,
            user_id=user_id,
            title="A conduct report was filed",
            body=f"{current_user.full_name} filed a conduct report for {student.first_name} {student.last_name} on {payload.incident_date}.",
        )

    db.commit()
    db.refresh(report)
    return _out(report)


@router.get(
    "",
    response_model=list[ConductReportOut],
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("conduct"))],
)
def list_conduct_reports(
    school_id: int,
    student_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Leadership sees every report; a teacher sees the ones they filed; a
    student or parent sees only their own (child's) record."""
    ensure_school_access(db, current_user, school_id)
    query = db.query(ConductReport).filter_by(school_id=school_id)

    if current_user.role in ADMIN_ROLES:
        pass
    elif current_user.role in (UserRole.TEACHER, UserRole.STAFF):
        query = query.filter_by(reported_by=current_user.id)
    elif current_user.role == UserRole.STUDENT:
        own_student = db.query(Student).filter_by(school_id=school_id, user_id=current_user.id).first()
        query = query.filter_by(student_id=own_student.id if own_student else -1)
    else:  # PARENT
        child_ids = [s.id for s in db.query(Student).filter_by(school_id=school_id, guardian_user_id=current_user.id).all()]
        query = query.filter(ConductReport.student_id.in_(child_ids or [-1]))

    if student_id is not None:
        query = query.filter_by(student_id=student_id)

    reports = query.order_by(ConductReport.incident_date.desc(), ConductReport.created_at.desc()).all()
    return [_out(r) for r in reports]


@router.post(
    "/{report_id}/respond",
    response_model=ConductReportOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("conduct"))],
)
def respond_to_conduct_report(
    school_id: int, report_id: int, payload: ConductReportRespond, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    report = db.query(ConductReport).filter_by(school_id=school_id, id=report_id).first()
    if report is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conduct report not found")

    report.response = payload.response
    report.status = ConductStatus.REVIEWED
    report.responded_by = current_user.id
    report.responded_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(report)
    return _out(report)
