import re
import secrets
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user, require_feature, require_roles
from app.core.flutterwave import FlutterwaveError, create_payment_link, verify_transaction
from app.core.mpesa import MpesaError, initiate_stk_push, query_stk_status
from app.core.payments import apply_payment
from app.models.academics import Student
from app.models.attendance import AttendanceRecord
from app.models.fees import FeeInvoice
from app.models.payment_config import SchoolPaymentConfig
from app.models.payment_transaction import PaymentTransaction, PaymentTransactionStatus
from app.models.results import Result
from app.models.user import User, UserRole
from app.schemas.academics import StudentOut
from app.schemas.attendance import AttendanceRecordOut
from app.schemas.fees import FeeInvoiceOut
from app.schemas.payments import (
    CardPaymentInitiated,
    InitiateCardPaymentRequest,
    InitiateMpesaPaymentRequest,
    PaymentTransactionOut,
    VerifyCardPaymentRequest,
)
from app.schemas.results import ResultOut
from app.schemas.transport import StudentTransportOut
from app.routers.fees import _invoice_out

router = APIRouter(prefix="/portal", tags=["portal"])


def _normalize_kenyan_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    if digits.startswith("0") and len(digits) == 10:
        return "254" + digits[1:]
    if digits.startswith("254"):
        return digits
    if digits.startswith("7") or digits.startswith("1"):
        return "254" + digits
    raise HTTPException(status.HTTP_400_BAD_REQUEST, "Enter a valid Kenyan phone number, e.g. 0712345678")


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


@router.get(
    "/students/{student_id}/transport",
    response_model=StudentTransportOut,
    dependencies=[Depends(require_roles(UserRole.PARENT, UserRole.STUDENT)), Depends(require_feature("transport"))],
)
def get_child_transport(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    student = _owned_student(db, current_user, student_id)
    if student.transport_route is None:
        return StudentTransportOut(assigned=False)

    vehicle = student.transport_route.vehicle
    return StudentTransportOut(
        assigned=True,
        route_name=student.transport_route.name,
        stop_name=student.transport_stop.name if student.transport_stop else None,
        pickup_time=student.transport_stop.pickup_time if student.transport_stop else None,
        vehicle_registration=vehicle.registration_number if vehicle else None,
        driver_name=vehicle.driver_name if vehicle else None,
        driver_phone=vehicle.driver_phone if vehicle else None,
    )


def _owned_invoice(db: Session, student: Student, invoice_id: int) -> FeeInvoice:
    invoice = db.query(FeeInvoice).filter_by(id=invoice_id, student_id=student.id).first()
    if invoice is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
    return invoice


@router.post(
    "/students/{student_id}/fees/{invoice_id}/pay/mpesa",
    response_model=PaymentTransactionOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(UserRole.PARENT, UserRole.STUDENT)), Depends(require_feature("fees"))],
)
def pay_invoice_with_mpesa(
    student_id: int,
    invoice_id: int,
    payload: InitiateMpesaPaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    student = _owned_student(db, current_user, student_id)
    invoice = _owned_invoice(db, student, invoice_id)

    config = db.query(SchoolPaymentConfig).filter_by(school_id=student.school_id).first()
    if config is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "This school hasn't set up M-Pesa payments yet — contact the school office."
        )

    balance = float(invoice.amount_due) - float(invoice.amount_paid)
    if balance <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This invoice is already fully paid")
    amount = payload.amount if payload.amount is not None else balance
    if amount <= 0 or amount > balance:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Amount must be between 1 and the balance of {balance}")

    phone = _normalize_kenyan_phone(payload.phone_number)
    merchant_reference = f"INV{invoice.id}-{secrets.token_hex(4)}"

    transaction = PaymentTransaction(
        school_id=student.school_id,
        invoice_id=invoice.id,
        merchant_reference=merchant_reference,
        amount=amount,
        status=PaymentTransactionStatus.PENDING,
        initiated_by=current_user.id,
    )
    db.add(transaction)
    db.flush()

    try:
        result = initiate_stk_push(
            config,
            phone_number=phone,
            amount=amount,
            account_reference=merchant_reference,
            description=f"{invoice.term} fees",
            callback_url=f"{settings.backend_url}/payments/mpesa/callback/{merchant_reference}",
        )
    except MpesaError as exc:
        transaction.status = PaymentTransactionStatus.FAILED
        db.commit()
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc))

    transaction.order_tracking_id = result.get("CheckoutRequestID")
    db.commit()
    db.refresh(transaction)
    return transaction


@router.get(
    "/students/{student_id}/fees/{invoice_id}/pay/mpesa/{transaction_id}/status",
    response_model=PaymentTransactionOut,
    dependencies=[Depends(require_roles(UserRole.PARENT, UserRole.STUDENT)), Depends(require_feature("fees"))],
)
def check_mpesa_payment_status(
    student_id: int,
    invoice_id: int,
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    student = _owned_student(db, current_user, student_id)
    invoice = _owned_invoice(db, student, invoice_id)
    transaction = db.query(PaymentTransaction).filter_by(id=transaction_id, invoice_id=invoice.id).first()
    if transaction is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Transaction not found")

    if transaction.status != PaymentTransactionStatus.PENDING:
        return transaction

    config = db.query(SchoolPaymentConfig).filter_by(school_id=student.school_id).first()
    if config is None or not transaction.order_tracking_id:
        return transaction

    try:
        result = query_stk_status(config, transaction.order_tracking_id)
    except MpesaError:
        return transaction

    # Safaricom omits ResultCode entirely while the push is still awaiting the
    # user's PIN — that's "still pending", not a specific code to special-case.
    if "ResultCode" not in result:
        return transaction

    result_code = str(result.get("ResultCode"))
    if result_code == "0":
        transaction.status = PaymentTransactionStatus.COMPLETED
        transaction.method = "mpesa"
        transaction.completed_at = datetime.now(timezone.utc)
        apply_payment(
            db,
            invoice=invoice,
            amount=float(transaction.amount),
            method="mpesa",
            reference=transaction.order_tracking_id,
            actor_id=transaction.initiated_by,
        )
        db.commit()
        db.refresh(transaction)
    else:
        transaction.status = PaymentTransactionStatus.FAILED
        db.commit()
        db.refresh(transaction)

    return transaction


@router.post(
    "/students/{student_id}/fees/{invoice_id}/pay/card",
    response_model=CardPaymentInitiated,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(UserRole.PARENT, UserRole.STUDENT)), Depends(require_feature("fees"))],
)
def pay_invoice_with_card(
    student_id: int,
    invoice_id: int,
    payload: InitiateCardPaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    student = _owned_student(db, current_user, student_id)
    invoice = _owned_invoice(db, student, invoice_id)

    config = db.query(SchoolPaymentConfig).filter_by(school_id=student.school_id).first()
    if config is None or not config.card_configured:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "This school hasn't set up card payments yet — contact the school office."
        )

    balance = float(invoice.amount_due) - float(invoice.amount_paid)
    if balance <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This invoice is already fully paid")
    amount = payload.amount if payload.amount is not None else balance
    if amount <= 0 or amount > balance:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Amount must be between 1 and the balance of {balance}")

    merchant_reference = f"INV{invoice.id}-{secrets.token_hex(4)}"
    currency = student.school.currency

    transaction = PaymentTransaction(
        school_id=student.school_id,
        invoice_id=invoice.id,
        merchant_reference=merchant_reference,
        amount=amount,
        currency=currency,
        status=PaymentTransactionStatus.PENDING,
        initiated_by=current_user.id,
    )
    db.add(transaction)
    db.flush()

    # Flutterwave appends its own "transaction_id" (and "status"/"tx_ref") to
    # this URL on redirect — ours is named differently so the two never collide.
    redirect_url = (
        f"{settings.frontend_url}/pay/callback"
        f"?local_transaction_id={transaction.id}&student_id={student_id}&invoice_id={invoice_id}"
    )

    try:
        checkout_url = create_payment_link(
            config,
            tx_ref=merchant_reference,
            amount=amount,
            currency=currency,
            redirect_url=redirect_url,
            customer_email=current_user.email,
            customer_name=current_user.full_name,
            description=f"{invoice.term} fees",
        )
    except FlutterwaveError as exc:
        transaction.status = PaymentTransactionStatus.FAILED
        db.commit()
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc))

    db.commit()
    db.refresh(transaction)
    return CardPaymentInitiated(transaction=transaction, checkout_url=checkout_url)


@router.post(
    "/students/{student_id}/fees/{invoice_id}/pay/card/{transaction_id}/verify",
    response_model=PaymentTransactionOut,
    dependencies=[Depends(require_roles(UserRole.PARENT, UserRole.STUDENT)), Depends(require_feature("fees"))],
)
def verify_card_payment(
    student_id: int,
    invoice_id: int,
    transaction_id: int,
    payload: VerifyCardPaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    student = _owned_student(db, current_user, student_id)
    invoice = _owned_invoice(db, student, invoice_id)
    transaction = db.query(PaymentTransaction).filter_by(id=transaction_id, invoice_id=invoice.id).first()
    if transaction is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Transaction not found")

    if transaction.status != PaymentTransactionStatus.PENDING:
        return transaction

    config = db.query(SchoolPaymentConfig).filter_by(school_id=student.school_id).first()
    if config is None or not config.card_configured:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Card payments aren't configured for this school")

    try:
        result = verify_transaction(config, payload.flutterwave_transaction_id)
    except FlutterwaveError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc))

    data = result.get("data") or {}

    # Never trust "successful" alone — confirm this verify response is for
    # *our* transaction (matching tx_ref), and that the amount/currency
    # actually paid match what we asked for, before crediting the invoice.
    matches_reference = data.get("tx_ref") == transaction.merchant_reference
    matches_amount = float(data.get("amount") or 0) >= float(transaction.amount)
    matches_currency = data.get("currency") == transaction.currency
    is_successful = result.get("status") == "success" and data.get("status") == "successful"

    if not (matches_reference and matches_amount and matches_currency and is_successful):
        transaction.status = PaymentTransactionStatus.FAILED
        db.commit()
        db.refresh(transaction)
        return transaction

    transaction.status = PaymentTransactionStatus.COMPLETED
    transaction.method = "card"
    transaction.completed_at = datetime.now(timezone.utc)
    apply_payment(
        db,
        invoice=invoice,
        amount=float(transaction.amount),
        method="card",
        reference=str(data.get("id") or payload.flutterwave_transaction_id),
        actor_id=transaction.initiated_by,
    )
    db.commit()
    db.refresh(transaction)
    return transaction
