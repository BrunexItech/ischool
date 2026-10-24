from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_roles
from app.core.grading import get_bands
from app.models.grading_band import GradingBand
from app.models.user import User, UserRole
from app.schemas.grading_band import GradingBandOut, GradingBandsUpdate

router = APIRouter(prefix="/schools/{school_id}/grading-bands", tags=["grading bands"])

CONFIGURE_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL)


@router.get("", response_model=list[GradingBandOut])
def list_grading_bands(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    return get_bands(db, school_id)


@router.put("", response_model=list[GradingBandOut], dependencies=[Depends(require_roles(*CONFIGURE_ROLES))])
def set_grading_bands(
    school_id: int,
    payload: GradingBandsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    if len(payload.bands) == 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "At least one grading band is required")

    db.query(GradingBand).filter_by(school_id=school_id).delete()
    for i, band in enumerate(payload.bands, start=1):
        db.add(GradingBand(school_id=school_id, sort_order=i, **band.model_dump()))
    db.commit()
    return get_bands(db, school_id)
