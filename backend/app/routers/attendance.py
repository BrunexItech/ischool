from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.models.attendance import AttendanceRecord
from app.models.user import User, UserRole
from app.schemas.attendance import AttendanceMarkRequest, AttendanceRecordOut

router = APIRouter(prefix="/schools/{school_id}/attendance", tags=["attendance"])

VIEW_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.TEACHER, UserRole.STAFF)
MARK_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.TEACHER, UserRole.STAFF)


@router.get(
    "",
    response_model=list[AttendanceRecordOut],
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("attendance"))],
)
def list_attendance(
    school_id: int,
    class_id: int | None = Query(default=None),
    date: date | None = Query(default=None),
    student_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(current_user, school_id)
    query = db.query(AttendanceRecord).filter_by(school_id=school_id)
    if class_id is not None:
        query = query.filter_by(class_id=class_id)
    if date is not None:
        query = query.filter_by(date=date)
    if student_id is not None:
        query = query.filter_by(student_id=student_id)
    return query.order_by(AttendanceRecord.date.desc()).all()


@router.post(
    "",
    response_model=list[AttendanceRecordOut],
    dependencies=[Depends(require_roles(*MARK_ROLES)), Depends(require_feature("attendance"))],
)
def mark_attendance(
    school_id: int,
    payload: AttendanceMarkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upserts one record per student for the given class/date — resubmitting
    the same day just corrects it, which is how a teacher actually uses this."""
    ensure_school_access(current_user, school_id)

    existing = {
        r.student_id: r
        for r in db.query(AttendanceRecord)
        .filter_by(school_id=school_id, class_id=payload.class_id, date=payload.date)
        .all()
    }

    results = []
    for entry in payload.records:
        record = existing.get(entry.student_id)
        if record:
            record.status = entry.status
            record.recorded_by = current_user.id
        else:
            record = AttendanceRecord(
                school_id=school_id,
                class_id=payload.class_id,
                student_id=entry.student_id,
                date=payload.date,
                status=entry.status,
                recorded_by=current_user.id,
            )
            db.add(record)
        results.append(record)

    db.commit()
    for r in results:
        db.refresh(r)
    return results
