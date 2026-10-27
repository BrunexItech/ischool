from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.approvals import DECIDERS, decide
from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_roles
from app.models.change_request import ChangeRequest, ChangeStatus
from app.models.user import User, UserRole

router = APIRouter(prefix="/schools/{school_id}/approvals", tags=["approvals"])

SEE = DECIDERS + (UserRole.SECRETARY,)


class ChangeRequestOut(BaseModel):
    id: int
    kind: str
    scope: str | None
    title: str
    summary: str
    status: str
    requested_by_name: str | None
    requested_at: str
    decision_note: str | None


class Decision(BaseModel):
    note: str | None = None


def _out(r: ChangeRequest) -> ChangeRequestOut:
    return ChangeRequestOut(
        id=r.id,
        kind=r.kind,
        scope=r.scope,
        title=r.title,
        summary=r.summary,
        status=r.status.value,
        requested_by_name=r.requester.full_name if r.requester else None,
        requested_at=r.requested_at.isoformat(),
        decision_note=r.decision_note,
    )


@router.get("", response_model=list[ChangeRequestOut], dependencies=[Depends(require_roles(*SEE))])
def list_requests(school_id: int, kind: str | None = None, pending_only: bool = False, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """The head sees every request; the secretary sees only their own."""
    ensure_school_access(db, current_user, school_id)
    q = db.query(ChangeRequest).filter_by(school_id=school_id)
    if kind:
        q = q.filter_by(kind=kind)
    if pending_only:
        q = q.filter_by(status=ChangeStatus.PENDING)
    if current_user.role == UserRole.SECRETARY:
        q = q.filter_by(requested_by=current_user.id)
    return [_out(r) for r in q.order_by(ChangeRequest.requested_at.desc()).limit(50)]


def _get(db: Session, school_id: int, request_id: int) -> ChangeRequest:
    req = db.query(ChangeRequest).filter_by(school_id=school_id, id=request_id).first()
    if req is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found")
    return req


@router.post("/{request_id}/approve", response_model=ChangeRequestOut, dependencies=[Depends(require_roles(*DECIDERS))])
def approve(school_id: int, request_id: int, payload: Decision | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    req = _get(db, school_id, request_id)
    decide(db, req, current_user, True, payload.note if payload else None)
    db.commit()
    return _out(req)


@router.post("/{request_id}/reject", response_model=ChangeRequestOut, dependencies=[Depends(require_roles(*DECIDERS))])
def reject(school_id: int, request_id: int, payload: Decision | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    req = _get(db, school_id, request_id)
    decide(db, req, current_user, False, payload.note if payload else None)
    db.commit()
    return _out(req)
