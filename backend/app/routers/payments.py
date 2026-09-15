from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.crypto import encrypt_secret
from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.core.payments import apply_payment
from app.core.pesapal import PesapalError, get_transaction_status, register_ipn
from app.models.academics import Student
from app.models.fees import FeeInvoice
from app.models.payment_config import SchoolPaymentConfig
from app.models.payment_transaction import PaymentTransaction, PaymentTransactionStatus
from app.models.user import User, UserRole
from app.schemas.payments import PaymentMethodsOut, SchoolPaymentConfigOut, SchoolPaymentConfigUpdate

router = APIRouter(tags=["payments"])

ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)


def _config_out(config: SchoolPaymentConfig | None) -> SchoolPaymentConfigOut:
    if config is None:
        return SchoolPaymentConfigOut(mpesa_configured=False, card_configured=False)
    return SchoolPaymentConfigOut(
        mpesa_configured=config.mpesa_configured,
        mpesa_shortcode=config.mpesa_shortcode,
        mpesa_env=config.mpesa_env,
        card_configured=config.card_configured,
        pesapal_env=config.pesapal_env,
    )


@router.get(
    "/schools/{school_id}/payment-config",
    response_model=SchoolPaymentConfigOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES))],
)
def get_payment_config(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(current_user, school_id)
    config = db.query(SchoolPaymentConfig).filter_by(school_id=school_id).first()
    return _config_out(config)


@router.put(
    "/schools/{school_id}/payment-config",
    response_model=SchoolPaymentConfigOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES))],
)
def set_payment_config(
    school_id: int,
    payload: SchoolPaymentConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Each provider's fields are independently optional — saving card
    credentials doesn't require re-entering M-Pesa's, and vice versa."""
    ensure_school_access(current_user, school_id)

    config = db.query(SchoolPaymentConfig).filter_by(school_id=school_id).first()
    if config is None:
        config = SchoolPaymentConfig(school_id=school_id)
        db.add(config)

    if payload.mpesa_shortcode is not None:
        config.mpesa_shortcode = payload.mpesa_shortcode
    if payload.mpesa_consumer_key is not None:
        config.mpesa_consumer_key = payload.mpesa_consumer_key
    if payload.mpesa_consumer_secret is not None:
        config.mpesa_consumer_secret_encrypted = encrypt_secret(payload.mpesa_consumer_secret)
    if payload.mpesa_passkey is not None:
        config.mpesa_passkey_encrypted = encrypt_secret(payload.mpesa_passkey)
    if payload.mpesa_env is not None:
        config.mpesa_env = payload.mpesa_env

    pesapal_touched = False
    if payload.pesapal_consumer_key is not None:
        config.pesapal_consumer_key = payload.pesapal_consumer_key
        pesapal_touched = True
    if payload.pesapal_consumer_secret is not None:
        config.pesapal_consumer_secret_encrypted = encrypt_secret(payload.pesapal_consumer_secret)
        pesapal_touched = True
    if payload.pesapal_env is not None:
        config.pesapal_env = payload.pesapal_env
        pesapal_touched = True

    if pesapal_touched and config.pesapal_consumer_key and config.pesapal_consumer_secret_encrypted:
        # Re-register on every credential/env change — Pesapal ties the IPN id
        # to the merchant account and environment it was registered under.
        try:
            config.pesapal_ipn_id = register_ipn(config, f"{settings.backend_url}/payments/pesapal/ipn")
        except PesapalError as exc:
            db.rollback()
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Failed to register with Pesapal: {exc}")

    db.commit()
    return _config_out(config)


@router.get(
    "/portal/students/{student_id}/payment-methods",
    response_model=PaymentMethodsOut,
    dependencies=[Depends(require_roles(UserRole.PARENT, UserRole.STUDENT)), Depends(require_feature("fees"))],
)
def get_available_payment_methods(
    student_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Tells the portal which payment buttons to show — never exposes
    credentials, just which providers this school has actually connected."""
    student = db.query(Student).filter_by(id=student_id).first()
    owns = student is not None and (student.guardian_user_id == current_user.id or student.user_id == current_user.id)
    if not owns:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")

    config = db.query(SchoolPaymentConfig).filter_by(school_id=student.school_id).first()
    if config is None:
        return PaymentMethodsOut(mpesa=False, card=False)
    return PaymentMethodsOut(mpesa=config.mpesa_configured, card=config.card_configured)


@router.post("/payments/mpesa/callback/{merchant_reference}")
async def mpesa_callback(merchant_reference: str, request: Request, db: Session = Depends(get_db)):
    """Safaricom calls this once a push resolves — only reachable when this
    backend has a public URL (production). Our own status-polling endpoint
    is the primary mechanism since it works regardless; this is a bonus for
    when the callback can actually reach us, and updates state idempotently."""
    body = await request.json()
    stk_callback = body.get("Body", {}).get("stkCallback", {})
    result_code = stk_callback.get("ResultCode")

    transaction = db.query(PaymentTransaction).filter_by(merchant_reference=merchant_reference).first()
    if transaction is None or transaction.status != PaymentTransactionStatus.PENDING:
        return {"ResultCode": 0, "ResultDesc": "Accepted"}

    if result_code == 0:
        invoice = db.query(FeeInvoice).filter_by(id=transaction.invoice_id).first()
        if invoice is not None:
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
    else:
        transaction.status = PaymentTransactionStatus.FAILED

    db.commit()
    return {"ResultCode": 0, "ResultDesc": "Accepted"}


@router.get("/payments/pesapal/ipn")
def pesapal_ipn(OrderTrackingId: str, OrderMerchantReference: str, db: Session = Depends(get_db)):
    """Pesapal calls this once an order resolves — only reachable when this
    backend has a public URL. Our own status-polling endpoint
    (portal.check_card_payment_status) is the primary mechanism since it
    works regardless; this is a bonus path that updates state idempotently
    when Pesapal can actually reach us."""
    transaction = db.query(PaymentTransaction).filter_by(merchant_reference=OrderMerchantReference).first()
    if transaction is None or transaction.status != PaymentTransactionStatus.PENDING:
        return {"orderNotificationType": "IPNCHANGE", "orderTrackingId": OrderTrackingId, "status": 200}

    config = db.query(SchoolPaymentConfig).filter_by(school_id=transaction.school_id).first()
    if config is None:
        return {"orderNotificationType": "IPNCHANGE", "orderTrackingId": OrderTrackingId, "status": 200}

    try:
        result = get_transaction_status(config, OrderTrackingId)
    except PesapalError:
        return {"orderNotificationType": "IPNCHANGE", "orderTrackingId": OrderTrackingId, "status": 200}

    if result.get("payment_status_description") == "Completed":
        invoice = db.query(FeeInvoice).filter_by(id=transaction.invoice_id).first()
        if invoice is not None:
            transaction.status = PaymentTransactionStatus.COMPLETED
            transaction.method = "card"
            transaction.completed_at = datetime.now(timezone.utc)
            apply_payment(
                db,
                invoice=invoice,
                amount=float(transaction.amount),
                method="card",
                reference=OrderTrackingId,
                actor_id=transaction.initiated_by,
            )
    elif result.get("payment_status_description") in ("Failed", "Invalid", "Reversed"):
        transaction.status = PaymentTransactionStatus.FAILED

    db.commit()
    return {"orderNotificationType": "IPNCHANGE", "orderTrackingId": OrderTrackingId, "status": 200}
