import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.mailer import send_email
from app.core.rate_limit import clear_attempts, is_locked_out, record_failed_attempt
from app.core.security import create_access_token, ensure_password_strength, hash_password, verify_password
from app.core.config import settings
from app.models.auth_token import AuthToken, AuthTokenType
from app.models.user import User
from app.schemas.user import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    Token,
)

router = APIRouter(prefix="/auth", tags=["auth"])

RESET_TOKEN_TTL = timedelta(hours=1)


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    rate_limit_key = form_data.username.strip().lower()
    if is_locked_out(rate_limit_key):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS, "Too many failed attempts. Try again in a few minutes."
        )

    user = db.query(User).filter_by(email=form_data.username).first()
    if user is None or not verify_password(form_data.password, user.hashed_password):
        record_failed_attempt(rate_limit_key)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account is disabled")

    clear_attempts(rate_limit_key)
    token = create_access_token(subject=str(user.id))
    return Token(access_token=token, user=user)


@router.patch("/change-password", response_model=Token)
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    ensure_password_strength(payload.new_password)

    current_user.hashed_password = hash_password(payload.new_password)
    current_user.must_change_password = False
    db.commit()

    token = create_access_token(subject=str(current_user.id))
    return Token(access_token=token, user=current_user)


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Always returns the same generic message, whether or not the email
    exists — a different response would let an attacker enumerate accounts."""
    user = db.query(User).filter_by(email=payload.email.strip().lower()).first()
    if user is not None:
        token_value = secrets.token_urlsafe(32)
        db.add(
            AuthToken(
                user_id=user.id,
                token=token_value,
                token_type=AuthTokenType.PASSWORD_RESET,
                expires_at=datetime.now(timezone.utc) + RESET_TOKEN_TTL,
            )
        )
        db.commit()

        reset_link = f"{settings.frontend_url}/reset-password?token={token_value}"
        send_email(
            to=user.email,
            subject="Reset your iSchool password",
            body=f"Hi {user.full_name},\n\nReset your password here (valid for 1 hour):\n{reset_link}\n\nIf you didn't request this, ignore this email.",
        )

    return {"message": "If an account exists for that email, a reset link has been sent."}


@router.post("/reset-password", response_model=Token)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    record = (
        db.query(AuthToken)
        .filter_by(token=payload.token, token_type=AuthTokenType.PASSWORD_RESET, used_at=None)
        .first()
    )
    if record is None or record.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This reset link is invalid or has expired")

    ensure_password_strength(payload.new_password)

    user = db.get(User, record.user_id)
    user.hashed_password = hash_password(payload.new_password)
    user.must_change_password = False
    record.used_at = datetime.now(timezone.utc)
    db.commit()

    token = create_access_token(subject=str(user.id))
    return Token(access_token=token, user=user)
