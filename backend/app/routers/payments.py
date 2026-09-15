from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.crypto import encrypt_secret
from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_roles
from app.core.payments import apply_payment
from app.models.fees import FeeInvoice
from app.models.payment_config import SchoolPaymentConfig
from app.models.payment_transaction import PaymentTransaction, PaymentTransactionStatus
from app.models.user import User, UserRole
from app.schemas.payments import SchoolPaymentConfigOut, SchoolPaymentConfigUpdate

router = APIRouter(tags=["payments"])

ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)


@router.get(
    "/schools/{school_id}/payment-config",
    response_model=SchoolPaymentConfigOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES))],
)
def get_payment_config(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(current_user, school_id)
    config = db.query(SchoolPaymentConfig).filter_by(school_id=school_id).first()
    if config is None:
        return SchoolPaymentConfigOut(is_configured=False)
    return SchoolPaymentConfigOut(is_configured=True, mpesa_shortcode=config.mpesa_shortcode, mpesa_env=config.mpesa_env)


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
    """The school's own Daraja app credentials — money settles straight into
    their own paybill/till, never through any account we control."""
    ensure_school_access(current_user, school_id)

    config = db.query(SchoolPaymentConfig).filter_by(school_id=school_id).first()
    if config is None:
        config = SchoolPaymentConfig(school_id=school_id)
        db.add(config)

    config.mpesa_shortcode = payload.mpesa_shortcode
    config.mpesa_consumer_key = payload.mpesa_consumer_key
    config.mpesa_consumer_secret_encrypted = encrypt_secret(payload.mpesa_consumer_secret)
    config.mpesa_passkey_encrypted = encrypt_secret(payload.mpesa_passkey)
    config.mpesa_env = payload.mpesa_env

    db.commit()
    return SchoolPaymentConfigOut(is_configured=True, mpesa_shortcode=config.mpesa_shortcode, mpesa_env=config.mpesa_env)


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
