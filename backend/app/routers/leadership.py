"""Changing who runs a school. Only the platform's own administrator (super
admin) can do this, never a principal or another head: it switches the old
head's login off and gives the new person the head's role. Nothing the school
has recorded is touched, because records belong to the school, not to a login."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.core.security import ensure_password_strength, hash_password
from app.models.school import School
from app.models.user import User, UserRole

router = APIRouter(prefix="/schools/{school_id}/leadership", tags=["leadership"], dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN))])

STAFF_LOGINS = (
    UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL, UserRole.SECRETARY, UserRole.TEACHER, UserRole.STAFF, UserRole.BURSAR, UserRole.ACCOUNTANT,
    UserRole.PROCUREMENT_OFFICER, UserRole.STORE_KEEPER, UserRole.LIBRARIAN, UserRole.TRANSPORT_STAFF, UserRole.TRANSPORT_ATTENDANT, UserRole.SECURITY, UserRole.BOARDING_STAFF,
)


class AccountOut(BaseModel):
    user_id: int
    full_name: str
    email: str
    role: str
    is_active: bool


class NewHead(BaseModel):
    full_name: str = Field(min_length=2)
    email: str
    password: str


class Handover(BaseModel):
    outgoing_user_id: int
    existing_user_id: int | None = None   # promote someone who already works at the school...
    new_head: NewHead | None = None       # ...or create a new account
    reason: str = Field(min_length=5, max_length=300)


class HandoverResult(BaseModel):
    outgoing: AccountOut
    incoming: AccountOut
    message: str


class ActiveIn(BaseModel):
    active: bool
    reason: str | None = Field(default=None, max_length=300)


def _out(u: User) -> AccountOut:
    return AccountOut(user_id=u.id, full_name=u.full_name, email=u.email, role=u.role.value, is_active=u.is_active)


def _school_or_404(db: Session, school_id: int) -> School:
    school = db.get(School, school_id)
    if school is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "School not found")
    return school


@router.get("/accounts", response_model=list[AccountOut])
def list_accounts(school_id: int, db: Session = Depends(get_db)):
    """Every staff login at the school, switched on or off."""
    _school_or_404(db, school_id)
    users = db.query(User).filter(User.school_id == school_id, User.role.in_(STAFF_LOGINS)).all()
    order = {r: i for i, r in enumerate(STAFF_LOGINS)}
    users.sort(key=lambda u: (order[u.role], u.full_name))
    return [_out(u) for u in users]


@router.post("/accounts/{user_id}/active", response_model=AccountOut)
def switch_account(school_id: int, user_id: int, payload: ActiveIn, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    """Switch a staff login off (they are signed out at once and cannot sign
    in) or back on. The account and everything it recorded are kept."""
    _school_or_404(db, school_id)
    user = db.query(User).filter(User.id == user_id, User.school_id == school_id, User.role.in_(STAFF_LOGINS)).first()
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found at this school")
    if user.is_active == payload.active:
        return _out(user)
    if not payload.active and user.role == UserRole.HEAD_OF_INSTITUTION:
        others = db.query(User).filter(User.school_id == school_id, User.role == UserRole.HEAD_OF_INSTITUTION, User.is_active.is_(True), User.id != user.id).count()
        if others == 0:
            raise HTTPException(status.HTTP_409_CONFLICT, "This is the school's only active head. Use Hand over to appoint the next head first.")
    user.is_active = payload.active
    record_audit(db, school_id=school_id, actor_id=me.id, action="account.switched_on" if payload.active else "account.switched_off", entity_type="user", entity_id=user.id, before={"is_active": not payload.active}, after={"is_active": payload.active, "reason": payload.reason})
    db.commit()
    return _out(user)


@router.post("/handover", response_model=HandoverResult)
def hand_over(school_id: int, payload: Handover, db: Session = Depends(get_db), me: User = Depends(get_current_user)):
    """Replace the head. The outgoing head's login is switched off and the
    incoming person becomes head, in one step, so the school is never left
    without someone in charge."""
    school = _school_or_404(db, school_id)
    if (payload.existing_user_id is None) == (payload.new_head is None):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Choose either an existing staff member or enter a new head's details")
    outgoing = db.query(User).filter_by(id=payload.outgoing_user_id, school_id=school_id, role=UserRole.HEAD_OF_INSTITUTION).first()
    if outgoing is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That head was not found at this school")

    if payload.existing_user_id is not None:
        incoming = db.query(User).filter(User.id == payload.existing_user_id, User.school_id == school_id, User.is_active.is_(True), User.role.in_(STAFF_LOGINS)).first()
        if incoming is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "That staff member was not found or is switched off")
        if incoming.id == outgoing.id:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "The new head must be a different person")
        old_role = incoming.role
        incoming.role = UserRole.HEAD_OF_INSTITUTION
    else:
        nh = payload.new_head
        if db.query(User.id).filter_by(email=nh.email.strip().lower()).first() or db.query(User.id).filter_by(email=nh.email).first():
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "That email is already registered")
        ensure_password_strength(nh.password)
        incoming = User(school_id=school_id, email=nh.email.strip(), full_name=nh.full_name.strip(), hashed_password=hash_password(nh.password), role=UserRole.HEAD_OF_INSTITUTION, must_change_password=True)
        db.add(incoming)
        old_role = None
        db.flush()

    outgoing.is_active = False
    record_audit(
        db, school_id=school_id, actor_id=me.id, action="leadership.handover", entity_type="user", entity_id=incoming.id,
        before={"head": outgoing.full_name, "head_user_id": outgoing.id},
        after={"head": incoming.full_name, "head_user_id": incoming.id, "previous_role": old_role.value if old_role else None, "reason": payload.reason},
    )
    db.commit()
    return HandoverResult(outgoing=_out(outgoing), incoming=_out(incoming), message=f"{incoming.full_name} now runs {school.name}. {outgoing.full_name}'s login is switched off; all school records are unchanged.")
