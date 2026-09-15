"""Deletes pickup/dropoff log entries older than RETENTION_DAYS (default 365).

A school can delete any entry itself at any time via the API; this script
only enforces the default upper bound so the log doesn't grow forever.
Run daily via cron (see the crontab entry alongside backup_db.sh).
"""

import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.pickup_dropoff import PickupDropoffLog

RETENTION_DAYS = int(os.environ.get("PICKUP_LOG_RETENTION_DAYS", "365"))


def main() -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
    db = SessionLocal()
    try:
        deleted = db.query(PickupDropoffLog).filter(PickupDropoffLog.occurred_at < cutoff).delete()
        db.commit()
        print(f"Purged {deleted} pickup/dropoff log entries older than {RETENTION_DAYS} days.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
