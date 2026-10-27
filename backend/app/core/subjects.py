"""Which subjects belong in which classes.

A subject lists the grades it is taught in. Teaching assignments and the
timetable check it, so Chemistry cannot end up on a Grade 3 timetable. A
subject with no grades listed is open to every class."""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.academics import SchoolClass
from app.models.results import Subject


def ensure_subject_fits_class(db: Session, school_id: int, subject_id: int, class_id: int) -> None:
    subject = db.query(Subject).filter_by(school_id=school_id, id=subject_id).first()
    school_class = db.query(SchoolClass).filter_by(school_id=school_id, id=class_id).first()
    if subject is None or school_class is None:
        return  # the caller reports missing records in its own words
    allowed = subject.grade_level_ids
    if allowed and school_class.grade_level_id not in allowed:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"{subject.name} is not taught in {school_class.name}. Add that grade to the subject first.",
        )
