import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.core.livekit import generate_room_token
from app.models.live_classes import LiveClass
from app.models.module import SchoolModule
from app.models.user import User, UserRole
from app.schemas.live_classes import JoinTokenOut, LiveClassCreate, LiveClassOut

router = APIRouter(prefix="/schools/{school_id}/live-classes", tags=["live classes"])
public_router = APIRouter(prefix="/live-classes", tags=["live classes"])

VIEW_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.TEACHER, UserRole.STAFF)
SCHEDULE_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.TEACHER)


@router.get(
    "",
    response_model=list[LiveClassOut],
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("live_classes"))],
)
def list_live_classes(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(current_user, school_id)
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
    ensure_school_access(current_user, school_id)

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
    ensure_school_access(current_user, school_id)
    live_class = db.query(LiveClass).filter_by(school_id=school_id, id=live_class_id).first()
    if live_class is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Live class not found")

    token = generate_room_token(
        room=live_class.room_name,
        identity=f"user-{current_user.id}",
        name=current_user.full_name,
        can_publish=True,
    )
    return JoinTokenOut(token=token, url=settings.livekit_url, room_name=live_class.room_name, class_title=live_class.title)


@public_router.get("/join/{join_code}", response_model=JoinTokenOut)
def join_by_code(join_code: str, name: str, db: Session = Depends(get_db)):
    """Public — a student follows the shared link and types their name, no
    platform login required. Scoped by an unguessable per-class join code."""
    live_class = db.query(LiveClass).filter_by(join_code=join_code).first()
    if live_class is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found")

    module = (
        db.query(SchoolModule)
        .filter_by(school_id=live_class.school_id, module_key="live_classes")
        .first()
    )
    if module is None or not module.enabled:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Live classes are not enabled for this school")

    if not name.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Name is required")

    token = generate_room_token(
        room=live_class.room_name,
        identity=f"guest-{secrets.token_hex(4)}",
        name=name.strip(),
        can_publish=True,
    )
    return JoinTokenOut(token=token, url=settings.livekit_url, room_name=live_class.room_name, class_title=live_class.title)
