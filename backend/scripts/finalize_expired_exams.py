"""Finalizes exam submissions whose time limit has passed but that never
got an explicit "Submit" call — e.g. the student closed the tab, lost their
connection, or the device died. Without this, such a submission would stay
IN_PROGRESS forever with no score, even though every answer they'd already
autosaved is sitting right there in the database.

Run frequently via cron (every 5 minutes is plenty, since exams are timed
in whole minutes).
"""

import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.core.exam_grading import finalize_submission
from app.models.exam import Exam, ExamSubmission, ExamSubmissionStatus


def main() -> None:
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        in_progress = (
            db.query(ExamSubmission)
            .join(Exam, ExamSubmission.exam_id == Exam.id)
            .filter(ExamSubmission.status == ExamSubmissionStatus.IN_PROGRESS)
            .all()
        )

        finalized = 0
        for submission in in_progress:
            deadline = submission.started_at + timedelta(minutes=submission.exam.duration_minutes)
            if now >= deadline:
                finalize_submission(db, submission.exam, submission)
                finalized += 1

        db.commit()
        print(f"Finalized {finalized} expired exam submission(s) out of {len(in_progress)} in progress.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
