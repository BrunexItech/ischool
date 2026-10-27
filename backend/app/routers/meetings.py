"""Live meetings with teachers. A head can meet teachers of their own school;
the group principal can meet teachers of any school they are attached to,
all of them or a chosen few. Teachers join from their own dashboard."""

import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, principal_school_ids, require_roles
from app.core.livekit import generate_room_token
from app.core.notify import notify
from app.models.meeting import MeetingJoin, StaffMeeting
from app.models.school import School, SchoolType
from app.models.user import User, UserRole
from app.schemas.live_classes import JoinTokenOut
from app.schemas.meeting import Candidate, CandidateSchool, MeetingAttendance, MeetingAttendee, MeetingCreate, MeetingOut

router = APIRouter(prefix="/meetings", tags=["meetings"])

HOSTS = (UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL)
ATTENDEES = HOSTS + (UserRole.TEACHER,)


def _hostable_school_ids(db: Session, user: User) -> list[int]:
    if user.role == UserRole.GROUP_PRINCIPAL:
        return principal_school_ids(db, user)
    ids = [user.school_id] if user.school_id else []
    # a head who owns a group can also meet the teachers of their branches
    ids += [sid for (sid,) in db.query(School.id).filter(School.parent_school_id == user.school_id, School.school_type == SchoolType.SCHOOL)] if user.school_id else []
    return ids


def _teachers_of(db: Session, school_ids: list[int]) -> list[User]:
    return db.query(User).filter(User.school_id.in_(school_ids or [-1]), User.role == UserRole.TEACHER, User.is_active.is_(True)).order_by(User.full_name).all()


def _invitees(db: Session, m: StaffMeeting) -> list[User]:
    teachers = _teachers_of(db, m.school_ids)
    return teachers if m.audience == "all" else [t for t in teachers if t.id in set(m.invitee_user_ids)]


def _can_see(db: Session, m: StaffMeeting, user: User) -> bool:
    if m.host_user_id == user.id:
        return True
    if user.role != UserRole.TEACHER or user.school_id not in m.school_ids:
        return False
    return m.audience == "all" or user.id in set(m.invitee_user_ids)


def _out(db: Session, m: StaffMeeting, user: User) -> MeetingOut:
    names = [n for (n,) in db.query(School.name).filter(School.id.in_(m.school_ids or [-1])).order_by(School.name)]
    return MeetingOut(
        id=m.id, title=m.title, agenda=m.agenda, scheduled_start=m.scheduled_start, status=m.status, host_name=m.host.full_name, is_host=m.host_user_id == user.id,
        school_names=names, audience=m.audience, invited=len(_invitees(db, m)), joined=len({j.user_id for j in m.joins if j.user_id != m.host_user_id}),
    )


def _meeting(db: Session, meeting_id: int, user: User) -> StaffMeeting:
    m = db.get(StaffMeeting, meeting_id)
    if m is None or not _can_see(db, m, user):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meeting not found")
    return m


@router.get("", response_model=list[MeetingOut], dependencies=[Depends(require_roles(*ATTENDEES))])
def my_meetings(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Meetings I am hosting or invited to, soonest first. Ended and cancelled ones come last."""
    rows = [m for m in db.query(StaffMeeting).order_by(StaffMeeting.scheduled_start.desc()).limit(300) if _can_see(db, m, user)]
    order = {"live": 0, "scheduled": 1, "ended": 2, "cancelled": 3}
    rows.sort(key=lambda m: (order.get(m.status, 4), m.scheduled_start.timestamp() if m.status in ("live", "scheduled") else -m.scheduled_start.timestamp()))
    return [_out(db, m, user) for m in rows]


@router.get("/candidates", response_model=list[CandidateSchool], dependencies=[Depends(require_roles(*HOSTS))])
def candidates(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """The schools this host may invite, with each school's teachers."""
    out = []
    for s in db.query(School).filter(School.id.in_(_hostable_school_ids(db, user) or [-1])).order_by(School.name):
        out.append(CandidateSchool(school_id=s.id, school_name=s.name, teachers=[Candidate(user_id=t.id, full_name=t.full_name) for t in _teachers_of(db, [s.id])]))
    return out


@router.post("", response_model=MeetingOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_roles(*HOSTS))])
def schedule(payload: MeetingCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    allowed = set(_hostable_school_ids(db, user))
    chosen = sorted(set(payload.school_ids))
    if not chosen or not set(chosen) <= allowed:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only invite teachers of schools you are responsible for")
    if payload.audience not in ("all", "selected"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Audience must be all or selected")
    pool = {t.id: t for t in _teachers_of(db, chosen)}
    picked = sorted(set(payload.teacher_ids))
    if payload.audience == "selected":
        if not picked:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Choose at least one teacher")
        if any(i not in pool for i in picked):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "One of the teachers is not at the chosen schools")
    if not pool:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "There are no teachers at the chosen schools to invite")
    m = StaffMeeting(
        host_user_id=user.id, title=payload.title.strip(), agenda=(payload.agenda or None), scheduled_start=payload.scheduled_start,
        room_name=f"meeting-{secrets.token_hex(8)}", school_ids=chosen, audience=payload.audience, invitee_user_ids=picked if payload.audience == "selected" else [],
    )
    db.add(m)
    db.flush()
    when = payload.scheduled_start.strftime("%a %d %b, %H:%M")
    for t in _invitees(db, m):
        notify(db, school_id=t.school_id, user_id=t.id, title="Meeting invitation", body=f"{user.full_name} has called a meeting: {m.title}, {when} UTC.", link="/dashboard/meetings")
    db.commit()
    db.refresh(m)
    return _out(db, m, user)


@router.post("/{meeting_id}/token", response_model=JoinTokenOut, dependencies=[Depends(require_roles(*ATTENDEES))])
def join(meeting_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    m = _meeting(db, meeting_id, user)
    if m.status in ("ended", "cancelled"):
        raise HTTPException(status.HTTP_409_CONFLICT, f"This meeting has {m.status}")
    if m.host_user_id == user.id and m.status == "scheduled":
        m.status = "live"
    elif m.status == "scheduled":
        raise HTTPException(status.HTTP_409_CONFLICT, "The meeting has not started yet. You can join once the host opens it.")
    if not any(j.user_id == user.id for j in m.joins):
        db.add(MeetingJoin(meeting_id=m.id, user_id=user.id))
    db.commit()
    token = generate_room_token(room=m.room_name, identity=f"user-{user.id}", name=user.full_name, can_publish=True)
    return JoinTokenOut(token=token, url=settings.livekit_url, room_name=m.room_name, class_title=m.title)


@router.post("/{meeting_id}/end", response_model=MeetingOut, dependencies=[Depends(require_roles(*HOSTS))])
def end(meeting_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    m = _meeting(db, meeting_id, user)
    if m.host_user_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the host can end the meeting")
    if m.status in ("scheduled",):
        m.status = "cancelled"
    elif m.status == "live":
        m.status, m.ended_at = "ended", datetime.now(timezone.utc)
    db.commit()
    return _out(db, m, user)


@router.get("/{meeting_id}/attendance", response_model=MeetingAttendance, dependencies=[Depends(require_roles(*HOSTS))])
def attendance(meeting_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    m = _meeting(db, meeting_id, user)
    if m.host_user_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the host can see who attended")
    joined = {j.user_id: j.joined_at for j in m.joins}
    schools = {s.id: s.name for s in db.query(School).filter(School.id.in_(m.school_ids or [-1]))}
    rows = [MeetingAttendee(user_id=t.id, name=t.full_name, school_name=schools.get(t.school_id), joined_at=joined.get(t.id)) for t in _invitees(db, m)]
    rows.sort(key=lambda r: (r.joined_at is None, r.name))
    return MeetingAttendance(meeting=_out(db, m, user), attendees=rows)
