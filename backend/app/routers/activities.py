from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.models.academics import Student
from app.models.activity import Activity, ActivityParticipant
from app.models.user import User, UserRole
from app.schemas.activity import ActivityCreate, ActivityDetailOut, ActivityOut, ParticipantAdd, ParticipantOut

router = APIRouter(prefix="/schools/{school_id}/activities", tags=["activities"])

VIEW_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.TEACHER, UserRole.STAFF)
ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)


@router.get(
    "",
    response_model=list[ActivityOut],
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("activities"))],
)
def list_activities(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(current_user, school_id)
    return db.query(Activity).filter_by(school_id=school_id).order_by(Activity.date.desc()).all()


@router.post(
    "",
    response_model=ActivityOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("activities"))],
)
def create_activity(
    school_id: int, payload: ActivityCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(current_user, school_id)
    activity = Activity(school_id=school_id, **payload.model_dump())
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity


@router.get(
    "/{activity_id}",
    response_model=ActivityDetailOut,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("activities"))],
)
def get_activity(school_id: int, activity_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(current_user, school_id)
    activity = db.query(Activity).filter_by(school_id=school_id, id=activity_id).first()
    if activity is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Activity not found")
    return ActivityDetailOut(
        **ActivityOut.model_validate(activity).model_dump(),
        participants=[ParticipantOut.model_validate(p) for p in activity.participants],
    )


@router.post(
    "/{activity_id}/participants",
    response_model=ParticipantOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("activities"))],
)
def add_participant(
    school_id: int,
    activity_id: int,
    payload: ParticipantAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(current_user, school_id)
    activity = db.query(Activity).filter_by(school_id=school_id, id=activity_id).first()
    if activity is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Activity not found")

    student = db.query(Student).filter_by(school_id=school_id, id=payload.student_id).first()
    if student is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That student does not belong to this school")

    if db.query(ActivityParticipant).filter_by(activity_id=activity_id, student_id=payload.student_id).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This student is already recorded for this activity")

    participant = ActivityParticipant(activity_id=activity_id, student_id=payload.student_id, role=payload.role)
    db.add(participant)
    db.commit()
    db.refresh(participant)
    return participant


@router.delete(
    "/{activity_id}/participants/{student_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("activities"))],
)
def remove_participant(
    school_id: int,
    activity_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(current_user, school_id)
    participant = (
        db.query(ActivityParticipant)
        .join(Activity)
        .filter(Activity.school_id == school_id, ActivityParticipant.activity_id == activity_id, ActivityParticipant.student_id == student_id)
        .first()
    )
    if participant is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Participant record not found")

    db.delete(participant)
    db.commit()


@router.delete(
    "/{activity_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("activities"))],
)
def delete_activity(school_id: int, activity_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(current_user, school_id)
    activity = db.query(Activity).filter_by(school_id=school_id, id=activity_id).first()
    if activity is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Activity not found")

    db.delete(activity)
    db.commit()
