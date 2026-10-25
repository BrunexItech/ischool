from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.orm import Session

from app.models.school import School

DEFAULT_TIMEZONE = "Africa/Nairobi"


def school_today(db: Session, school_id: int, now: datetime | None = None) -> date:
    """Today's calendar date at the school, in the school's own timezone.

    The server runs in UTC, whose date is still "yesterday" in Kenya until
    03:00 — so `date.today()` would call a register taken at 01:00 on
    Thursday a Wednesday one. `now` is injectable so the boundary is testable."""
    school = db.get(School, school_id)
    name = school.timezone if school and school.timezone else DEFAULT_TIMEZONE
    try:
        tz = ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        tz = ZoneInfo(DEFAULT_TIMEZONE)
    return (now or datetime.now(timezone.utc)).astimezone(tz).date()
