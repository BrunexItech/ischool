import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.core.livekit import generate_room_token, livekit_admin
from app.models.live_classes import LiveClass, LiveClassGuestRequest, LiveClassJoin
from app.models.module import SchoolModule
from app.models.user import User, UserRole
from app.schemas.live_classes import (
    ControlResult,
    GuestRequestCreate,
    GuestRequestOut,
    GuestStatusOut,
    JoinRecordOut,
    JoinTokenOut,
    LiveClassCreate,
    LiveClassOut,
    PendingGuestOut,
    SpeakingSet,
)

router = APIRouter(prefix="/schools/{school_id}/live-classes", tags=["live classes"])
public_router = APIRouter(prefix="/live-classes", tags=["live classes"])

VIEW_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL, UserRole.TEACHER, UserRole.STAFF)
SCHEDULE_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL, UserRole.TEACHER)


@router.get(
    "",
    response_model=list[LiveClassOut],
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("live_classes"))],
)
def list_live_classes(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    return (
        db.query(LiveClass)
        .filter_by(school_id=school_id)
        .order_by(LiveClass.scheduled_start.desc())
        .all()
    )


@router.post(
    "",
    response_model=LiveClassOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*SCHEDULE_ROLES)), Depends(require_feature("live_classes"))],
)
def schedule_live_class(
    school_id: int,
    payload: LiveClassCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)

    live_class = LiveClass(
        school_id=school_id,
        class_id=payload.class_id,
        title=payload.title,
        scheduled_start=payload.scheduled_start,
        room_name=f"school{school_id}-{secrets.token_hex(6)}",
        join_code=secrets.token_urlsafe(8),
        created_by=current_user.id,
    )
    db.add(live_class)
    db.commit()
    db.refresh(live_class)
    return live_class


@router.post(
    "/{live_class_id}/host-token",
    response_model=JoinTokenOut,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("live_classes"))],
)
def get_host_token(
    school_id: int,
    live_class_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Anyone with staff-level access to the school can host/co-host — a teacher
    running the class, or an admin/staff member sitting in."""
    ensure_school_access(db, current_user, school_id)
    live_class = db.query(LiveClass).filter_by(school_id=school_id, id=live_class_id).first()
    if live_class is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Live class not found")

    token = generate_room_token(
        room=live_class.room_name,
        identity=f"user-{current_user.id}",
        name=current_user.full_name,
        can_publish=True,
    )
    record_join(db, live_class.id, f"user-{current_user.id}", current_user.full_name, "host")
    db.commit()
    return JoinTokenOut(token=token, url=settings.livekit_url, room_name=live_class.room_name, class_title=live_class.title)


def record_join(db: Session, live_class_id: int, identity: str, name: str, kind: str) -> None:
    """Notes the first time someone was let into a class (the who-came list)."""
    if db.query(LiveClassJoin).filter_by(live_class_id=live_class_id, identity=identity).first() is None:
        db.add(LiveClassJoin(live_class_id=live_class_id, identity=identity, name=name[:100], kind=kind))


def _host_class(db: Session, school_id: int, live_class_id: int) -> LiveClass:
    live_class = db.query(LiveClass).filter_by(school_id=school_id, id=live_class_id).first()
    if live_class is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Live class not found")
    return live_class


def _is_staff_identity(identity: str) -> bool:
    return identity.startswith("user-")


def _set_can_publish(room: str, identity: str, allowed: bool) -> None:
    livekit_admin(
        "UpdateParticipant",
        {"room": room, "identity": identity, "permission": {"can_subscribe": True, "can_publish": allowed, "can_publish_data": True}},
        room,
    )


@router.post(
    "/{live_class_id}/mute-all",
    response_model=ControlResult,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("live_classes"))],
)
def mute_everyone(school_id: int, live_class_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Turns off every learner's microphone and camera at once. Staff in the
    room are left alone."""
    ensure_school_access(db, current_user, school_id)
    live_class = _host_class(db, school_id, live_class_id)
    listing = livekit_admin("ListParticipants", {"room": live_class.room_name}, live_class.room_name)
    changed = 0
    for p in listing.get("participants", []):
        identity = p.get("identity", "")
        can_publish = p.get("permission", {}).get("can_publish", p.get("permission", {}).get("canPublish", False))
        if _is_staff_identity(identity) or not can_publish:
            continue
        _set_can_publish(live_class.room_name, identity, False)
        changed += 1
    return ControlResult(affected=changed)


@router.post(
    "/{live_class_id}/participants/{identity}/speaking",
    response_model=ControlResult,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("live_classes"))],
)
def set_speaking(
    school_id: int,
    live_class_id: int,
    identity: str,
    payload: SpeakingSet,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lets one learner speak (and show their camera), or takes that away again."""
    ensure_school_access(db, current_user, school_id)
    live_class = _host_class(db, school_id, live_class_id)
    if _is_staff_identity(identity):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot change a teacher's microphone here")
    _set_can_publish(live_class.room_name, identity, payload.allowed)
    return ControlResult(affected=1)


@router.post(
    "/{live_class_id}/participants/{identity}/remove",
    response_model=ControlResult,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("live_classes"))],
)
def remove_from_class(
    school_id: int, live_class_id: int, identity: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    live_class = _host_class(db, school_id, live_class_id)
    if _is_staff_identity(identity):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot remove a teacher from the class")
    livekit_admin("RemoveParticipant", {"room": live_class.room_name, "identity": identity}, live_class.room_name)
    return ControlResult(affected=1)


@router.get(
    "/{live_class_id}/requests",
    response_model=list[PendingGuestOut],
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("live_classes"))],
)
def waiting_room(school_id: int, live_class_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    live_class = _host_class(db, school_id, live_class_id)
    rows = db.query(LiveClassGuestRequest).filter_by(live_class_id=live_class.id, status="pending").order_by(LiveClassGuestRequest.created_at).all()
    return [PendingGuestOut(id=r.id, name=r.name, requested_at=r.created_at) for r in rows]


@router.post(
    "/{live_class_id}/requests/{request_id}/{decision}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("live_classes"))],
)
def decide_request(
    school_id: int, live_class_id: int, request_id: int, decision: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    live_class = _host_class(db, school_id, live_class_id)
    if decision not in ("admit", "deny"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    row = db.query(LiveClassGuestRequest).filter_by(live_class_id=live_class.id, id=request_id).first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found")
    row.status = "admitted" if decision == "admit" else "denied"
    db.commit()


@router.get(
    "/{live_class_id}/joins",
    response_model=list[JoinRecordOut],
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("live_classes"))],
)
def who_joined(school_id: int, live_class_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Everyone who was let into this class, with the time they first came in."""
    ensure_school_access(db, current_user, school_id)
    live_class = _host_class(db, school_id, live_class_id)
    return db.query(LiveClassJoin).filter_by(live_class_id=live_class.id).order_by(LiveClassJoin.joined_at).all()


def _public_class(db: Session, join_code: str) -> LiveClass:
    live_class = db.query(LiveClass).filter_by(join_code=join_code).first()
    if live_class is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found")
    module = db.query(SchoolModule).filter_by(school_id=live_class.school_id, module_key="live_classes").first()
    if module is None or not module.enabled:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Live classes are not enabled for this school")
    return live_class


@public_router.post("/join/{join_code}/request", response_model=GuestRequestOut, status_code=status.HTTP_201_CREATED)
def ask_to_join(join_code: str, payload: GuestRequestCreate, db: Session = Depends(get_db)):
    """Public — someone with the link asks to come in and waits for the teacher
    to admit them. Nobody gets into the room without being let in."""
    live_class = _public_class(db, join_code)
    name = payload.name.strip()
    if not name:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Name is required")
    waiting = db.query(LiveClassGuestRequest).filter_by(live_class_id=live_class.id, status="pending").count()
    if waiting >= 100:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many people are waiting. Please try again shortly.")
    row = LiveClassGuestRequest(live_class_id=live_class.id, name=name[:100], request_code=secrets.token_urlsafe(16))
    db.add(row)
    db.commit()
    return GuestRequestOut(request_code=row.request_code, status=row.status)


@public_router.get("/join/{join_code}/status", response_model=GuestStatusOut)
def waiting_status(join_code: str, request_code: str, db: Session = Depends(get_db)):
    """Public — the waiting person checks whether the teacher has let them in.
    A room token is handed out only once they have been admitted, and it never
    lets them speak until the teacher allows it."""
    live_class = _public_class(db, join_code)
    row = db.query(LiveClassGuestRequest).filter_by(live_class_id=live_class.id, request_code=request_code).first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found")
    if row.status != "admitted":
        return GuestStatusOut(status=row.status)
    identity = f"guest-{row.id}"
    token = generate_room_token(room=live_class.room_name, identity=identity, name=row.name, can_publish=False)
    record_join(db, live_class.id, identity, row.name, "guest")
    db.commit()
    return GuestStatusOut(
        status="admitted",
        join=JoinTokenOut(token=token, url=settings.livekit_url, room_name=live_class.room_name, class_title=live_class.title),
    )
