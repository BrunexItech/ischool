from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_roles
from app.models.academics import SchoolClass
from app.models.grade_level import GradeLevel, SchoolEnabledGrade
from app.models.user import User, UserRole
from app.schemas.grade_level import GradeLevelOut, SchoolEnabledGradesUpdate

router = APIRouter(tags=["grade levels"])

CONFIGURE_ROLES = (UserRole.SUPER_ADMIN, UserRole.GROUP_PRINCIPAL, UserRole.HEAD_OF_INSTITUTION, UserRole.SECRETARY)


@router.get("/grade-levels", response_model=list[GradeLevelOut])
def list_grade_levels(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """The fixed national CBE catalogue — same for every school, not editable here."""
    return db.query(GradeLevel).order_by(GradeLevel.sort_order).all()


@router.get("/schools/{school_id}/enabled-grades", response_model=list[GradeLevelOut])
def list_enabled_grades(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    return (
        db.query(GradeLevel)
        .join(SchoolEnabledGrade, SchoolEnabledGrade.grade_level_id == GradeLevel.id)
        .filter(SchoolEnabledGrade.school_id == school_id)
        .order_by(GradeLevel.sort_order)
        .all()
    )


@router.put(
    "/schools/{school_id}/enabled-grades",
    response_model=list[GradeLevelOut],
    dependencies=[Depends(require_roles(*CONFIGURE_ROLES))],
)
def set_enabled_grades(
    school_id: int,
    payload: SchoolEnabledGradesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The head of institution (or the group principal) chooses which national
    grades this school actually has. Any selection is allowed: a junior school
    may offer only Grades 7 to 9, a primary school only PP1 to Grade 6. A grade
    that already has classes cannot be switched off."""
    ensure_school_access(db, current_user, school_id)

    all_grades = db.query(GradeLevel).order_by(GradeLevel.sort_order).all()
    requested = set(payload.grade_level_ids)
    if not requested.issubset({g.id for g in all_grades}):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown grade level in selection")

    in_use = {
        gid for (gid,) in db.query(SchoolClass.grade_level_id).filter(SchoolClass.school_id == school_id, SchoolClass.grade_level_id.isnot(None)).distinct()
    }
    blocked = sorted(g.display_name for g in all_grades if g.id in in_use and g.id not in requested)
    if blocked:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"{', '.join(blocked)} already has classes. Move or remove those classes before switching the grade off.",
        )

    db.query(SchoolEnabledGrade).filter_by(school_id=school_id).delete()
    for grade_id in requested:
        db.add(SchoolEnabledGrade(school_id=school_id, grade_level_id=grade_id))
    db.commit()

    return (
        db.query(GradeLevel)
        .join(SchoolEnabledGrade, SchoolEnabledGrade.grade_level_id == GradeLevel.id)
        .filter(SchoolEnabledGrade.school_id == school_id)
        .order_by(GradeLevel.sort_order)
        .all()
    )
