from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.notify import notify
from app.models.academics import Student
from app.models.fees import FeeInvoice, FeePayment


def apply_payment(
    db: Session,
    *,
    invoice: FeeInvoice,
    amount: float,
    method: str,
    reference: str | None,
    actor_id: int | None,
) -> FeePayment:
    """Records a payment against an invoice, updates its balance, audits it,
    and notifies the guardian — the single path both a staff-recorded manual
    payment and a completed M-Pesa transaction go through, so they can never
    drift out of sync with each other."""
    payment = FeePayment(
        school_id=invoice.school_id,
        invoice_id=invoice.id,
        amount=amount,
        method=method,
        reference=reference,
        recorded_by=actor_id,
    )
    invoice.amount_paid = float(invoice.amount_paid) + amount
    db.add(payment)
    db.flush()

    record_audit(
        db,
        school_id=invoice.school_id,
        actor_id=actor_id,
        action="fee_payment.create",
        entity_type="fee_payment",
        entity_id=payment.id,
        after={"invoice_id": invoice.id, "amount": amount, "method": method, "reference": reference},
    )

    student = db.query(Student).filter_by(id=invoice.student_id).first()
    if student is not None and student.guardian_user_id is not None:
        notify(
            db,
            school_id=invoice.school_id,
            user_id=student.guardian_user_id,
            title=f"Payment received for {student.first_name}",
            body=f"KES {amount:,.2f} received via {method} for {invoice.term}.",
        )

    return payment
