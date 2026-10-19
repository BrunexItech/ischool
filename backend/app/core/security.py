from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

MIN_PASSWORD_LENGTH = 8


def ensure_password_strength(password: str) -> None:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f"Password must be at least {MIN_PASSWORD_LENGTH} characters"
        )


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str, extra_claims: dict | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": subject, "exp": expire}
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        return None


ATTENDANCE_QR_PURPOSE = "staff_attendance_qr"


def create_attendance_qr_token(school_id: int) -> str:
    """A long-lived, printable token for one school's attendance QR sheet —
    deliberately has no short expiry, since it's meant to be laminated and
    stuck on a wall, not refreshed every login cycle."""
    expire = datetime.now(timezone.utc) + timedelta(days=3650)
    payload = {"purpose": ATTENDANCE_QR_PURPOSE, "school_id": school_id, "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_attendance_qr_token(token: str) -> int | None:
    """Returns the school_id encoded in a valid attendance QR token, or
    None if the token is malformed, expired, or not an attendance QR token."""
    try:
        claims = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        return None
    if claims.get("purpose") != ATTENDANCE_QR_PURPOSE:
        return None
    return claims.get("school_id")
