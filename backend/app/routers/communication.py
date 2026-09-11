from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.models.communication import Announcement
from app.models.user import User, UserRole
from app.schemas.communication import AnnouncementCreate, AnnouncementOut

router = APIRouter(prefix="/schools/{school_id}/announcements", tags=["communication"])

VIEW_ROLES = (
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.TEACHER,
    UserRole.STAFF,
    UserRole.STUDENT,
    UserRole.PARENT,
)
POST_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.TEACHER)


@router.get(
    "",
    response_model=list[AnnouncementOut],
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("communication"))],
)
def list_announcements(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(current_user, school_id)
    return (
        db.query(Announcement)
        .filter_by(school_id=school_id)
        .order_by(Announcement.created_at.desc())
        .all()
    )


@router.post(
    "",
    response_model=AnnouncementOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*POST_ROLES)), Depends(require_feature("communication"))],
)
def create_announcement(
    school_id: int,
    payload: AnnouncementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(current_user, school_id)
    announcement = Announcement(school_id=school_id, created_by=current_user.id, **payload.model_dump())
    db.add(announcement)
    db.commit()
    db.refresh(announcement)
    return announcement
