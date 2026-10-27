"""A dependency-free weekly-tick scheduler. No task-queue package is
available in this environment, so this runs as a single daemon thread that
wakes up hourly and fires the weekly report run once it crosses the
configured day/hour — tracking the ISO week it last ran so it never double
-sends within the same week even if the process restarts mid-hour."""

import logging
import threading
import time
from datetime import datetime, timezone

from app.core.database import SessionLocal

logger = logging.getLogger("ischool.scheduler")

CHECK_INTERVAL_SECONDS = 3600  # hourly tick is plenty for a once-a-week job
REPORT_WEEKDAY = 5  # Saturday — the school week is over and the head reads it over the weekend
REPORT_HOUR_UTC = 4  # 07:00 Africa/Nairobi (UTC+3)

_started = False
_lock = threading.Lock()


def _due(now: datetime, last_run_iso_week: tuple[int, int] | None) -> bool:
    """Saturday morning onwards. If the server was down at the hour, the report
    is caught up on the next tick (later Saturday or Sunday); the
    per-school run log keeps it from ever going twice in the same week."""
    if now.isocalendar()[:2] == last_run_iso_week:
        return False
    return now.weekday() > REPORT_WEEKDAY or (now.weekday() == REPORT_WEEKDAY and now.hour >= REPORT_HOUR_UTC)


def _run_loop() -> None:
    from app.services.principal_report import send_all_principal_reports
    from app.services.weekly_reports import send_all_weekly_reports  # avoid import cycle at module load

    last_run_iso_week: tuple[int, int] | None = None
    while True:
        try:
            now = datetime.now(timezone.utc)
            if _due(now, last_run_iso_week):
                db = SessionLocal()
                try:
                    result = send_all_weekly_reports(db, once_per_week=True)
                    logger.info("Weekly reports sent: %s", result)
                    # The principal's report follows the heads', so the group picture is complete.
                    logger.info("Principal reports sent: %s", send_all_principal_reports(db, once_per_week=True))
                finally:
                    db.close()
                last_run_iso_week = now.isocalendar()[:2]
        except Exception:
            logger.exception("Weekly report scheduler tick failed")
        time.sleep(CHECK_INTERVAL_SECONDS)


def start() -> None:
    """Idempotent — safe to call on every app startup (e.g. once per
    TestClient in the test suite); only ever spawns one thread per process."""
    global _started
    with _lock:
        if _started:
            return
        _started = True
    threading.Thread(target=_run_loop, name="weekly-reports-scheduler", daemon=True).start()
    logger.info("Weekly report scheduler started (Saturdays %02d:00 UTC)", REPORT_HOUR_UTC)
