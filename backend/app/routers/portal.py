from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_feature, require_roles
from app.models.academics import Student
from app.models.attendance import AttendanceRecord
from app.models.fees import FeeInvoice
from app.models.results import Result
from app.models.user import User, UserRole
from app.schemas.academics import StudentOut
from app.schemas.attendance import AttendanceRecordOut
from app.schemas.fees import FeeInvoiceOut
from app.schemas.results import ResultOut
from app.routers.fees import _invoice_out

router = APIRouter(prefix="/portal", tags=["portal"])


def _owned_student(db: Session, current_user: User, student_id: int) -> Student:
    """A parent may only reach their own children; a student may only reach themself."""
    student = db.query(Student).filter_by(id=student_id).first()
    owns_as_parent = student is not None and student.guardian_user_id == current_user.id
    owns_as_self = student is not None and student.user_id == current_user.id
    if student is None or not (owns_as_parent or owns_as_self):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")
    return student


@router.get(
    "/children",
    response_model=list[StudentOut],
    dependencies=[Depends(require_roles(UserRole.PARENT))],
)
def list_my_children(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Student).filter_by(guardian_user_id=current_user.id).all()


@router.get(
    "/me",
    response_model=StudentOut,
    dependencies=[Depends(require_roles(UserRole.STUDENT))],
)
def get_my_student_record(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    student = db.query(Student).filter_by(user_id=current_user.id).first()
    if student is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No student record linked to this account")
    return student


@router.get(
    "/students/{student_id}/attendance",
    response_model=list[AttendanceRecordOut],
    dependencies=[Depends(require_roles(UserRole.PARENT, UserRole.STUDENT)), Depends(require_feature("attendance"))],
)
def get_child_attendance(
    student_id: int,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    student = _owned_student(db, current_user, student_id)
    query = db.query(AttendanceRecord).filter_by(student_id=student.id)
    if date_from is not None:
        query = query.filter(AttendanceRecord.date >= date_from)
    if date_to is not None:
        query = query.filter(AttendanceRecord.date <= date_to)
    return query.order_by(AttendanceRecord.date.desc()).all()


@router.get(
    "/students/{student_id}/results",
    response_model=list[ResultOut],
    dependencies=[Depends(require_roles(UserRole.PARENT, UserRole.STUDENT)), Depends(require_feature("results"))],
)
def get_child_results(
    student_id: int,
    term: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    student = _owned_student(db, current_user, student_id)
    query = db.query(Result).filter_by(student_id=student.id)
    if term is not None:
        query = query.filter_by(term=term)
    return query.all()


@router.get(
    "/students/{student_id}/fees",
    response_model=list[FeeInvoiceOut],
    dependencies=[Depends(require_roles(UserRole.PARENT, UserRole.STUDENT)), Depends(require_feature("fees"))],
)
def get_child_fees(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    student = _owned_student(db, current_user, student_id)
    invoices = db.query(FeeInvoice).filter_by(student_id=student.id).all()
    return [_invoice_out(inv) for inv in invoices]
