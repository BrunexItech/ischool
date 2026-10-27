"""Changes the secretary prepares and the head signs off.

A head's change is applied straight away. A secretary's is stored as a
pending request carrying the full proposal; approving it applies exactly
that. Each kind of change registers one `apply` function, so the head and
the approval path can never drift apart."""

from typing import Callable

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.notify import notify
from app.models.change_request import ChangeRequest, ChangeStatus
from app.models.user import User, UserRole

Applier = Callable[[Session, int, dict, User], None]
APPLIERS: dict[str, Applier] = {}
LINKS = {"bell_schedule": "/dashboard/timetable", "meal_menu": "/dashboard/meals", "fee_structure": "/dashboard/fees"}

DECIDERS = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL)


def register(kind: str):
    def wrap(fn: Applier) -> Applier:
        APPLIERS[kind] = fn
        return fn

    return wrap


def submit_or_apply(db: Session, school_id: int, user: User, *, kind: str, scope: str | None, title: str, summary: str, payload: dict, direct_roles: tuple = DECIDERS) -> ChangeRequest | None:
    """Apply now for the head; queue for approval for anyone else. Returns the
    request when one was queued, None when the change took effect."""
    if user.role in direct_roles:
        APPLIERS[kind](db, school_id, payload, user)
        return None
    # A newer proposal for the same thing replaces an older one still waiting.
    for old in db.query(ChangeRequest).filter_by(school_id=school_id, kind=kind, scope=scope, status=ChangeStatus.PENDING):
        old.status = ChangeStatus.REJECTED
        old.decision_note = "Replaced by a newer proposal"
    req = ChangeRequest(school_id=school_id, kind=kind, scope=scope, title=title, summary=summary, payload=payload, requested_by=user.id)
    db.add(req)
    db.flush()
    for head in db.query(User).filter(User.school_id == school_id, User.role == UserRole.HEAD_OF_INSTITUTION, User.is_active.is_(True)):
        notify(db, school_id=school_id, user_id=head.id, title="Awaiting your approval", body=f"{user.full_name} prepared: {title}", link=LINKS.get(kind))
    return req


def decide(db: Session, req: ChangeRequest, user: User, approve: bool, note: str | None) -> None:
    if req.status != ChangeStatus.PENDING:
        raise HTTPException(status.HTTP_409_CONFLICT, "This request has already been decided")
    if approve:
        APPLIERS[req.kind](db, req.school_id, req.payload, user)
    req.status = ChangeStatus.APPROVED if approve else ChangeStatus.REJECTED
    req.decided_by = user.id
    req.decision_note = note
    from datetime import datetime, timezone

    req.decided_at = datetime.now(timezone.utc)
    record_audit(db, school_id=req.school_id, actor_id=user.id, action=f"{req.kind}.{'approved' if approve else 'rejected'}", entity_type="change_request", entity_id=req.id, after={"title": req.title, "note": note})
    if req.requested_by:
        notify(
            db,
            school_id=req.school_id,
            user_id=req.requested_by,
            title=f"{'Approved' if approve else 'Declined'}: {req.title}",
            body=(note or ("The change is now in effect." if approve else "The head did not approve this change.")),
            link=LINKS.get(req.kind),
        )
