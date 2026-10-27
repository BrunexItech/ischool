"""The school's weekly menu and meal times.

Menus repeat week after week, so the school sets its meals and what is served
each weekday once. A change the secretary prepares waits for the head's
approval; applying it replaces the whole menu so it can never half-update."""

from datetime import time

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.approvals import register
from app.models.meals import MealTime, WeeklyMenuItem
from app.models.user import User

AUDIENCES = ("all", "boarders")


def default_menu() -> list[dict]:
    plain = {str(d): "" for d in range(5)}
    return [
        {"name": "Breakfast", "start_time": "07:00", "end_time": "07:30", "audience": "boarders", "items": dict(plain)},
        {"name": "Morning tea", "start_time": "10:00", "end_time": "10:30", "audience": "all", "items": dict(plain)},
        {"name": "Lunch", "start_time": "12:30", "end_time": "13:30", "audience": "all", "items": dict(plain)},
        {"name": "Afternoon snack", "start_time": "15:30", "end_time": "15:50", "audience": "boarders", "items": dict(plain)},
        {"name": "Supper", "start_time": "18:30", "end_time": "19:15", "audience": "boarders", "items": dict(plain)},
    ]


def validate_menu(slots: list[dict]) -> list[dict]:
    cleaned = []
    names = set()
    for s in slots:
        name = str(s.get("name", "")).strip()
        if not name:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Every meal needs a name")
        if name.lower() in names:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"{name} is listed twice")
        names.add(name.lower())
        start, end = time.fromisoformat(str(s["start_time"])), time.fromisoformat(str(s["end_time"]))
        if end <= start:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"{name} must end after it starts")
        audience = s.get("audience", "all")
        if audience not in AUDIENCES:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"{name}: audience must be all or boarders")
        items = {}
        for day, text in (s.get("items") or {}).items():
            d = int(day)
            if d < 0 or d > 6:
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Weekday must be 0 (Monday) to 6 (Sunday)")
            text = str(text).strip()
            if text:
                items[d] = text[:1000]
        cleaned.append({"name": name, "start_time": start, "end_time": end, "audience": audience, "items": items})
    cleaned.sort(key=lambda s: s["start_time"])
    return cleaned


def apply_menu(db: Session, school_id: int, slots: list[dict]) -> None:
    cleaned = validate_menu(slots)
    for old in db.query(MealTime).filter_by(school_id=school_id):
        db.delete(old)
    db.flush()
    for i, s in enumerate(cleaned, start=1):
        row = MealTime(school_id=school_id, position=i, name=s["name"], start_time=s["start_time"], end_time=s["end_time"], audience=s["audience"])
        for d, text in s["items"].items():
            row.items.append(WeeklyMenuItem(weekday=d, description=text))
        db.add(row)


@register("meal_menu")
def _apply_meal_menu(db: Session, school_id: int, payload: dict, actor: User) -> None:
    apply_menu(db, school_id, payload["slots"])
