from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.module import SchoolModule
from app.models.user import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Could not validate credentials")

    user = db.get(User, int(payload["sub"]))
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Could not validate credentials")
    return user


def require_roles(*roles: UserRole):
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not permitted for this role")
        return current_user

    return dependency


def ensure_school_access(current_user: User, school_id: int) -> None:
    """Non-super-admins may only act within their own school; super-admins manage any school."""
    if current_user.role != UserRole.SUPER_ADMIN and current_user.school_id != school_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not permitted for this school")


def require_feature(module_key: str):
    """Blocks access unless the current user's school has this module enabled.
    Super-admins bypass the check (they manage schools, not enrolled in one)."""

    def dependency(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
        if current_user.role == UserRole.SUPER_ADMIN:
            return current_user

        module = (
            db.query(SchoolModule)
            .filter_by(school_id=current_user.school_id, module_key=module_key)
            .first()
        )
        if module is None or not module.enabled:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, f"The '{module_key}' module is not enabled for your school"
            )
        return current_user

    return dependency
