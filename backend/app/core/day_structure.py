"""The school day: lessons, breaks, lunch and prep, set once per level.

Teachers only choose a subject and a teacher for a lesson block, so the times
come from here and cannot clash or drift. A level's day is replaced as a
whole; lessons already on the timetable follow their block by position."""

from datetime import time

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.approvals import register
from app.models.school_period import PERIOD_KINDS, SchoolPeriod
from app.models.timetable import TimetableSlot
from app.models.user import User

LEVELS = ("pre_primary", "primary", "junior_school", "senior_school")


def _t(h: int, m: int = 0) -> time:
    return time(h, m)


def default_day(level_group: str, with_prep: bool) -> list[dict]:
    """A sensible starting day for the level, to adjust rather than type from scratch."""
    if level_group == "pre_primary":
        rows = [
            ("Circle time", "assembly", _t(8, 30), _t(9, 0)),
            ("Session 1", "lesson", _t(9, 0), _t(9, 30)),
            ("Session 2", "lesson", _t(9, 30), _t(10, 0)),
            ("Snack break", "break", _t(10, 0), _t(10, 30)),
            ("Session 3", "lesson", _t(10, 30), _t(11, 0)),
            ("Session 4", "lesson", _t(11, 0), _t(11, 30)),
            ("Lunch", "lunch", _t(12, 0), _t(13, 0)),
        ]
    else:
        rows = [
            ("Assembly", "assembly", _t(7, 45), _t(8, 0)),
            ("Lesson 1", "lesson", _t(8, 0), _t(8, 40)),
            ("Lesson 2", "lesson", _t(8, 40), _t(9, 20)),
            ("Lesson 3", "lesson", _t(9, 20), _t(10, 0)),
            ("Short break", "break", _t(10, 0), _t(10, 30)),
            ("Lesson 4", "lesson", _t(10, 30), _t(11, 10)),
            ("Lesson 5", "lesson", _t(11, 10), _t(11, 50)),
            ("Lesson 6", "lesson", _t(11, 50), _t(12, 30)),
            ("Lunch break", "lunch", _t(12, 30), _t(13, 30)),
            ("Lesson 7", "lesson", _t(13, 30), _t(14, 10)),
            ("Lesson 8", "lesson", _t(14, 10), _t(14, 50)),
            ("Games and clubs", "games", _t(14, 50), _t(15, 30)),
        ]
        if with_prep:
            rows.append(("Evening prep", "prep", _t(16, 30), _t(18, 0)))
    return [{"name": n, "kind": k, "start_time": a.isoformat(), "end_time": b.isoformat(), "days": [0, 1, 2, 3, 4]} for n, k, a, b in rows]


def validate_day(periods: list[dict]) -> list[dict]:
    if not periods:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Add at least one block to the day")
    cleaned = []
    for p in periods:
        name = str(p.get("name", "")).strip()
        if not name:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Every block needs a name")
        if p.get("kind") not in PERIOD_KINDS:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"{name}: choose what kind of block this is")
        start, end = time.fromisoformat(str(p["start_time"])), time.fromisoformat(str(p["end_time"]))
        if end <= start:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"{name} must end after it starts")
        days = sorted({int(d) for d in p.get("days", [])})
        if not days or any(d < 0 or d > 6 for d in days):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"{name}: choose the days it runs")
        cleaned.append({"name": name, "kind": p["kind"], "start_time": start, "end_time": end, "days": days})
    cleaned.sort(key=lambda p: p["start_time"])
    for a, b in zip(cleaned, cleaned[1:]):
        if b["start_time"] < a["end_time"] and set(a["days"]) & set(b["days"]):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"{a['name']} and {b['name']} overlap")
    return cleaned


def apply_day(db: Session, school_id: int, level_group: str, periods: list[dict]) -> None:
    cleaned = validate_day(periods)
    old = db.query(SchoolPeriod).filter_by(school_id=school_id, level_group=level_group).order_by(SchoolPeriod.position).all()
    lessons_by_position: dict[int, list[TimetableSlot]] = {}
    for o in old:
        lessons_by_position[o.position] = db.query(TimetableSlot).filter_by(school_id=school_id, period_id=o.id).all()
    for o in old:
        db.delete(o)
    db.flush()
    created: list[SchoolPeriod] = []
    for i, p in enumerate(cleaned, start=1):
        row = SchoolPeriod(school_id=school_id, level_group=level_group, position=i, **p)
        db.add(row)
        created.append(row)
    db.flush()
    for i, row in enumerate(created, start=1):
        for slot in lessons_by_position.get(i, []):
            if row.kind in ("lesson", "prep") and slot.day_of_week in row.days:
                slot.period_id, slot.start_time, slot.end_time = row.id, row.start_time, row.end_time
            else:
                db.delete(slot)  # the block it sat in no longer exists on that day


@register("bell_schedule")
def _apply_bell_schedule(db: Session, school_id: int, payload: dict, actor: User) -> None:
    apply_day(db, school_id, payload["level_group"], payload["periods"])
