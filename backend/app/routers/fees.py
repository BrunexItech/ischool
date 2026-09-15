from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.core.notify import notify
from app.core.payments import apply_payment
from app.models.academics import Student
from app.models.fees import FeeInvoice
from app.models.user import User, UserRole
from app.schemas.fees import FeeInvoiceCreate, FeeInvoiceDetailOut, FeeInvoiceOut, FeePaymentCreate, FeePaymentOut

router = APIRouter(prefix="/schools/{school_id}/fees", tags=["fees"])

VIEW_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.STAFF, UserRole.TEACHER)
MANAGE_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.STAFF)


def _status_for(amount_due: float, amount_paid: float) -> str:
    if amount_paid <= 0:
        return "unpaid"
    if amount_paid >= amount_due:
        return "paid"
    return "partial"


def _invoice_out(invoice: FeeInvoice) -> FeeInvoiceOut:
    amount_due = float(invoice.amount_due)
    amount_paid = float(invoice.amount_paid)
    return FeeInvoiceOut(
        id=invoice.id,
        school_id=invoice.school_id,
        student_id=invoice.student_id,
        term=invoice.term,
        category=invoice.category,
        amount_due=amount_due,
        amount_paid=amount_paid,
        balance=amount_due - amount_paid,
        status=_status_for(amount_due, amount_paid),
        due_date=invoice.due_date,
    )


@router.get(
    "/invoices",
    response_model=list[FeeInvoiceOut],
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("fees"))],
)
def list_invoices(
    school_id: int,
    student_id: int | None = Query(default=None),
    term: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(current_user, school_id)
    query = db.query(FeeInvoice).filter_by(school_id=school_id)
    if student_id is not None:
        query = query.filter_by(student_id=student_id)
    if term is not None:
        query = query.filter_by(term=term)
    return [_invoice_out(inv) for inv in query.all()]


@router.post(
    "/invoices",
    response_model=FeeInvoiceOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*MANAGE_ROLES)), Depends(require_feature("fees"))],
)
def create_invoice(
    school_id: int,
    payload: FeeInvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(current_user, school_id)
    invoice = FeeInvoice(school_id=school_id, **payload.model_dump())
    db.add(invoice)
    db.flush()

    record_audit(
        db,
        school_id=school_id,
        actor_id=current_user.id,
        action="fee_invoice.create",
        entity_type="fee_invoice",
        entity_id=invoice.id,
        after={"student_id": invoice.student_id, "term": invoice.term, "amount_due": float(invoice.amount_due)},
    )

    student = db.query(Student).filter_by(id=invoice.student_id).first()
    if student is not None and student.guardian_user_id is not None:
        notify(
            db,
            school_id=school_id,
            user_id=student.guardian_user_id,
            title=f"New invoice for {student.first_name}",
            body=f"A new invoice of KES {float(invoice.amount_due):,.2f} was issued for {invoice.term}.",
        )

    db.commit()
    db.refresh(invoice)
    return _invoice_out(invoice)


@router.get(
    "/invoices/{invoice_id}",
    response_model=FeeInvoiceDetailOut,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("fees"))],
)
def get_invoice(
    school_id: int,
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(current_user, school_id)
    invoice = db.query(FeeInvoice).filter_by(school_id=school_id, id=invoice_id).first()
    if invoice is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")

    base = _invoice_out(invoice)
    return FeeInvoiceDetailOut(**base.model_dump(), payments=[FeePaymentOut.model_validate(p) for p in invoice.payments])


@router.post(
    "/invoices/{invoice_id}/payments",
    response_model=FeeInvoiceDetailOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*MANAGE_ROLES)), Depends(require_feature("fees"))],
)
def record_payment(
    school_id: int,
    invoice_id: int,
    payload: FeePaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(current_user, school_id)
    invoice = db.query(FeeInvoice).filter_by(school_id=school_id, id=invoice_id).first()
    if invoice is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")

    apply_payment(
        db,
        invoice=invoice,
        amount=payload.amount,
        method=payload.method,
        reference=payload.reference,
        actor_id=current_user.id,
    )

    db.commit()
    db.refresh(invoice)

    base = _invoice_out(invoice)
    return FeeInvoiceDetailOut(**base.model_dump(), payments=[FeePaymentOut.model_validate(p) for p in invoice.payments])
