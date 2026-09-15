import re
import secrets
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user, require_feature, require_roles
from app.core.mpesa import MpesaError, initiate_stk_push, query_stk_status
from app.core.payments import apply_payment
from app.core.pesapal import PesapalError, get_transaction_status, submit_order
from app.core.report_card import build_report_card
from app.models.academics import Student
from app.models.activity import Activity, ActivityParticipant
from app.models.attendance import AttendanceRecord
from app.models.award import Award
from app.models.exam import Exam, ExamAnswer, ExamQuestionType, ExamSubmission, ExamSubmissionStatus
from app.models.fees import FeeInvoice
from app.models.meals import MealMenu
from app.models.pickup_dropoff import PickupDropoffLog
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
)
from app.schemas.activity import StudentActivityOut
from app.schemas.award import AwardOut
from app.schemas.exam import (
    ExamForStudentListOut,
    ExamForStudentOut,
    ExamOut,
    ExamQuestionForStudent,
    ExamStartOut,
    ExamSubmissionCreate,
    ExamSubmissionOut,
)
from app.schemas.meals import MealMenuOut
from app.schemas.pickup_dropoff import PickupDropoffOut
from app.schemas.results import ReportCardOut, ResultOut
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
    "/students/{student_id}/report-card",
    response_model=ReportCardOut,
    dependencies=[Depends(require_roles(UserRole.PARENT, UserRole.STUDENT)), Depends(require_feature("results"))],
)
def get_child_report_card(
    student_id: int, term: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    student = _owned_student(db, current_user, student_id)
    return build_report_card(db, student, term)


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


@router.get(
    "/students/{student_id}/meal-menu",
    response_model=list[MealMenuOut],
    dependencies=[Depends(require_roles(UserRole.PARENT, UserRole.STUDENT)), Depends(require_feature("meals"))],
)
def get_child_meal_menu(
    student_id: int,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    student = _owned_student(db, current_user, student_id)
    query = db.query(MealMenu).filter_by(school_id=student.school_id)
    if date_from is not None:
        query = query.filter(MealMenu.date >= date_from)
    if date_to is not None:
        query = query.filter(MealMenu.date <= date_to)
    return query.order_by(MealMenu.date, MealMenu.meal_type).all()


@router.get(
    "/students/{student_id}/awards",
    response_model=list[AwardOut],
    dependencies=[Depends(require_roles(UserRole.PARENT, UserRole.STUDENT)), Depends(require_feature("awards"))],
)
def get_child_awards(student_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    student = _owned_student(db, current_user, student_id)
    return db.query(Award).filter_by(student_id=student.id).order_by(Award.date_awarded.desc()).all()


@router.get(
    "/students/{student_id}/activities",
    response_model=list[StudentActivityOut],
    dependencies=[Depends(require_roles(UserRole.PARENT, UserRole.STUDENT)), Depends(require_feature("activities"))],
)
def get_child_activities(student_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    student = _owned_student(db, current_user, student_id)
    rows = (
        db.query(ActivityParticipant, Activity)
        .join(Activity, ActivityParticipant.activity_id == Activity.id)
        .filter(ActivityParticipant.student_id == student.id)
        .order_by(Activity.date.desc())
        .all()
    )
    return [
        StudentActivityOut(activity_id=activity.id, activity_name=activity.name, category=activity.category, date=activity.date, role=participant.role)
        for participant, activity in rows
    ]


@router.get(
    "/students/{student_id}/pickup-dropoff",
    response_model=list[PickupDropoffOut],
    dependencies=[Depends(require_roles(UserRole.PARENT, UserRole.STUDENT)), Depends(require_feature("pickup_dropoff"))],
)
def get_child_pickup_dropoff(student_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    student = _owned_student(db, current_user, student_id)
    return (
        db.query(PickupDropoffLog)
        .filter_by(student_id=student.id)
        .order_by(PickupDropoffLog.occurred_at.desc())
        .all()
    )


@router.get(
    "/students/{student_id}/exams",
    response_model=list[ExamForStudentListOut],
    dependencies=[Depends(require_roles(UserRole.PARENT, UserRole.STUDENT)), Depends(require_feature("exams"))],
)
def list_child_exams(student_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    student = _owned_student(db, current_user, student_id)
    exams = (
        db.query(Exam)
        .filter(Exam.school_id == student.school_id, Exam.is_published.is_(True))
        .filter((Exam.class_id.is_(None)) | (Exam.class_id == student.class_id))
        .order_by(Exam.created_at.desc())
        .all()
    )
    out = []
    for exam in exams:
        submission = db.query(ExamSubmission).filter_by(exam_id=exam.id, student_id=student.id).first()
        out.append(
            ExamForStudentListOut(
                **ExamOut.model_validate(exam).model_dump(),
                subject_name=exam.subject.name,
                submission_status=submission.status.value if submission else None,
                score=submission.score if submission else None,
            )
        )
    return out


def _get_exam_for_student(db: Session, student: Student, exam_id: int) -> Exam:
    exam = (
        db.query(Exam)
        .filter(Exam.school_id == student.school_id, Exam.id == exam_id, Exam.is_published.is_(True))
        .filter((Exam.class_id.is_(None)) | (Exam.class_id == student.class_id))
        .first()
    )
    if exam is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exam not found")
    return exam


def _exam_for_student_out(exam: Exam) -> ExamForStudentOut:
    return ExamForStudentOut(
        **ExamOut.model_validate(exam).model_dump(),
        questions=[ExamQuestionForStudent.model_validate(q) for q in exam.questions],
    )


@router.post(
    "/students/{student_id}/exams/{exam_id}/start",
    response_model=ExamStartOut,
    dependencies=[Depends(require_roles(UserRole.STUDENT)), Depends(require_feature("exams"))],
)
def start_exam(student_id: int, exam_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    student = _owned_student(db, current_user, student_id)
    exam = _get_exam_for_student(db, student, exam_id)

    submission = db.query(ExamSubmission).filter_by(exam_id=exam.id, student_id=student.id).first()
    if submission is not None and submission.status != ExamSubmissionStatus.IN_PROGRESS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You have already submitted this exam")
    if submission is None:
        submission = ExamSubmission(exam_id=exam.id, student_id=student.id)
        db.add(submission)
        db.commit()
        db.refresh(submission)

    return ExamStartOut(exam=_exam_for_student_out(exam), submission=ExamSubmissionOut.model_validate(submission))


@router.post(
    "/students/{student_id}/exams/{exam_id}/submit",
    response_model=ExamSubmissionOut,
    dependencies=[Depends(require_roles(UserRole.STUDENT)), Depends(require_feature("exams"))],
)
def submit_exam(
    student_id: int,
    exam_id: int,
    payload: ExamSubmissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    student = _owned_student(db, current_user, student_id)
    exam = _get_exam_for_student(db, student, exam_id)

    submission = db.query(ExamSubmission).filter_by(exam_id=exam.id, student_id=student.id).first()
    if submission is None or submission.status != ExamSubmissionStatus.IN_PROGRESS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No exam session in progress — start the exam first")

    questions_by_id = {q.id: q for q in exam.questions}
    has_short_answer = False
    for answer_payload in payload.answers:
        question = questions_by_id.get(answer_payload.question_id)
        if question is None:
            continue

        awarded_marks = None
        if question.question_type == ExamQuestionType.MCQ:
            try:
                selected = int(answer_payload.answer_text)
            except ValueError:
                selected = None
            awarded_marks = float(question.marks) if selected == question.correct_option_index else 0.0
        else:
            has_short_answer = True

        db.add(
            ExamAnswer(
                submission_id=submission.id,
                question_id=question.id,
                answer_text=answer_payload.answer_text,
                awarded_marks=awarded_marks,
            )
        )

    submission.status = ExamSubmissionStatus.SUBMITTED if has_short_answer else ExamSubmissionStatus.GRADED
    submission.submitted_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(submission)
    return submission


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

    # Pesapal appends its own "OrderTrackingId"/"OrderMerchantReference" to
    # this URL on redirect, but the frontend doesn't need them — it already
    # knows which of our own transactions to poll for status.
    redirect_url = (
        f"{settings.frontend_url}/pay/callback"
        f"?local_transaction_id={transaction.id}&student_id={student_id}&invoice_id={invoice_id}"
    )

    try:
        order = submit_order(
            config,
            merchant_reference=merchant_reference,
            amount=amount,
            currency=currency,
            description=f"{invoice.term} fees",
            callback_url=redirect_url,
            customer_email=current_user.email,
            customer_name=current_user.full_name,
        )
    except PesapalError as exc:
        transaction.status = PaymentTransactionStatus.FAILED
        db.commit()
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc))

    transaction.order_tracking_id = order.get("order_tracking_id")
    db.commit()
    db.refresh(transaction)
    return CardPaymentInitiated(transaction=transaction, checkout_url=order["redirect_url"])


@router.get(
    "/students/{student_id}/fees/{invoice_id}/pay/card/{transaction_id}/status",
    response_model=PaymentTransactionOut,
    dependencies=[Depends(require_roles(UserRole.PARENT, UserRole.STUDENT)), Depends(require_feature("fees"))],
)
def check_card_payment_status(
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
        result = get_transaction_status(config, transaction.order_tracking_id)
    except PesapalError:
        return transaction

    # Never trust the status description alone — confirm this response is
    # for *our* transaction (merchant reference) and that the amount/currency
    # actually paid match what we asked for, before crediting the invoice.
    matches_reference = result.get("merchant_reference") == transaction.merchant_reference
    matches_amount = float(result.get("amount") or 0) >= float(transaction.amount)
    matches_currency = result.get("currency") == transaction.currency
    status_description = result.get("payment_status_description")

    if status_description == "Completed" and matches_reference and matches_amount and matches_currency:
        transaction.status = PaymentTransactionStatus.COMPLETED
        transaction.method = "card"
        transaction.completed_at = datetime.now(timezone.utc)
        apply_payment(
            db,
            invoice=invoice,
            amount=float(transaction.amount),
            method="card",
            reference=transaction.order_tracking_id,
            actor_id=transaction.initiated_by,
        )
        db.commit()
        db.refresh(transaction)
    elif status_description in ("Failed", "Invalid", "Reversed") or (status_description == "Completed" and not (matches_reference and matches_amount and matches_currency)):
        transaction.status = PaymentTransactionStatus.FAILED
        db.commit()
        db.refresh(transaction)

    return transaction
