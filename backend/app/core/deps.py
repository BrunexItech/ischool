import re

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.module import SchoolModule
from app.models.school import School
from app.models.supervisor_link import SupervisorSchoolLink
from app.models.user import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# The group principal oversees: they look at every school but never change a
# school's records. These are the only writes they may make, none of which edit a
# school's own data: signing in, reading notifications, feedback to heads, their
# own meetings and report, the critical expense decisions, and which grades a
# school offers.
PRINCIPAL_MAY_WRITE = [
    re.compile(p)
    for p in (
        r"^/auth/",
        r"^/notifications",
        r"^/group/",
        r"^/meetings",
        r"^/schools/\d+/feedback",
        r"^/schools/\d+/enabled-grades$",  # which grades a school offers is the principal's call, not the head's
        r"^/schools/\d+/finance/expenses/\d+/(approve|reject)$",
    )
]
READ_ONLY_MESSAGE = "The group principal can view a school but not change its records. Ask the head of institution to make this change."


def get_current_user(request: Request, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Could not validate credentials")

    user = db.get(User, int(payload["sub"]))
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Could not validate credentials")
    if user.role == UserRole.GROUP_PRINCIPAL and request.method not in ("GET", "HEAD", "OPTIONS") and not any(p.match(request.url.path) for p in PRINCIPAL_MAY_WRITE):
        raise HTTPException(status.HTTP_403_FORBIDDEN, READ_ONLY_MESSAGE)
    return user


def principal_school_ids(db: Session, user: User) -> list[int]:
    """The real schools a group principal is attached to: those the platform
    administrator linked them to, plus any operating school under their
    umbrella. They never see anything outside this list."""
    from app.models.school import SchoolType

    ids = {l.school_id for l in db.query(SupervisorSchoolLink).filter_by(supervisor_user_id=user.id)}
    if user.school_id is not None:
        for (sid,) in db.query(School.id).filter(School.parent_school_id == user.school_id, School.school_type == SchoolType.SCHOOL):
            ids.add(sid)
    return sorted(ids)


def require_roles(*roles: UserRole):
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not permitted for this role")
        return current_user

    return dependency


def ensure_school_access(db: Session, current_user: User, school_id: int) -> None:
    """Non-super-admins may only act within their own school — except:
    - a group owner (a HEAD_OF_INSTITUTION whose own school is the *parent*
      of the target school) may also act within any of their own branches;
    - a GROUP_PRINCIPAL's own school_id is the umbrella's GROUP-type row, so
      the same parent-match check gives them every real school under it —
      the Milai Group hierarchy reuses the existing branch-access mechanism,
      it isn't a separate system;
    - a legacy-linked GROUP_PRINCIPAL (formerly SUPERVISOR) may also act
      within any school the super-admin explicitly linked them to.
    Super-admins manage any school."""
    if current_user.role == UserRole.SUPER_ADMIN or current_user.school_id == school_id:
        return
    if current_user.role in (UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL) and current_user.school_id is not None:
        target = db.get(School, school_id)
        if target is not None and target.parent_school_id == current_user.school_id:
            return
    if current_user.role == UserRole.GROUP_PRINCIPAL:
        linked = db.query(SupervisorSchoolLink).filter_by(supervisor_user_id=current_user.id, school_id=school_id).first()
        if linked is not None:
            return
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Not permitted for this school")


def require_feature(module_key: str):
    """Blocks access unless the target school has this module enabled. The
    target is the `school_id` path parameter when the route has one (so a
    group owner viewing a branch is correctly gated on that branch's own
    modules); routes with no `school_id` in their path (e.g. /portal/...,
    which is scoped by the caller's own identity) fall back to the caller's
    own school. Super-admins bypass the check."""

    def dependency(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
        school_id: int | None = None,
    ) -> User:
        if current_user.role == UserRole.SUPER_ADMIN:
            return current_user

        target_school_id = school_id if school_id is not None else current_user.school_id
        module = db.query(SchoolModule).filter_by(school_id=target_school_id, module_key=module_key).first()
        if module is None or not module.enabled:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, f"The '{module_key}' module is not enabled for your school"
            )
        return current_user

    return dependency
