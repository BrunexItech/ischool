from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_roles
from app.models.audit_log import AuditLog
from app.models.user import User, UserRole
from app.schemas.audit import AuditLogOut

router = APIRouter(prefix="/schools/{school_id}/audit-log", tags=["audit"])

ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)


@router.get("", response_model=list[AuditLogOut], dependencies=[Depends(require_roles(*ADMIN_ROLES))])
def list_audit_log(
    school_id: int,
    entity_type: str | None = None,
    entity_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(current_user, school_id)
    query = db.query(AuditLog).filter_by(school_id=school_id)
    if entity_type is not None:
        query = query.filter_by(entity_type=entity_type)
    if entity_id is not None:
        query = query.filter_by(entity_id=entity_id)

    rows = query.order_by(AuditLog.created_at.desc()).limit(200).all()
    return [
        AuditLogOut(
            id=r.id,
            action=r.action,
            entity_type=r.entity_type,
            entity_id=r.entity_id,
            actor_name=r.actor.full_name if r.actor else None,
            before=r.before,
            after=r.after,
            created_at=r.created_at,
        )
        for r in rows
    ]
