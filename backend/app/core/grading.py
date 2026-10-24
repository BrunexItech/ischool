from sqlalchemy.orm import Session

from app.models.grading_band import GradingBand

DEFAULT_BANDS = [
    {"level_code": "EE", "label": "Exceeding Expectation", "min_score": 80, "max_score": 100, "points": 4, "sort_order": 1},
    {"level_code": "ME", "label": "Meeting Expectation", "min_score": 50, "max_score": 79, "points": 3, "sort_order": 2},
    {"level_code": "AE", "label": "Approaching Expectation", "min_score": 30, "max_score": 49, "points": 2, "sort_order": 3},
    {"level_code": "BE", "label": "Below Expectation", "min_score": 0, "max_score": 29, "points": 1, "sort_order": 4},
]


def get_bands(db: Session, school_id: int) -> list[GradingBand]:
    bands = db.query(GradingBand).filter_by(school_id=school_id).order_by(GradingBand.sort_order).all()
    if bands:
        return bands
    # No custom bands configured yet — seed the defaults for this school now,
    # so grading works immediately without an admin having to visit settings first.
    for b in DEFAULT_BANDS:
        db.add(GradingBand(school_id=school_id, **b))
    db.commit()
    return db.query(GradingBand).filter_by(school_id=school_id).order_by(GradingBand.sort_order).all()


def level_for_score(db: Session, school_id: int, score: float) -> str:
    """The school's own configured level code (e.g. "EE") for a score —
    same mechanism for every grade, PP1/PP2 included."""
    bands = get_bands(db, school_id)
    for band in bands:
        if float(band.min_score) <= score <= float(band.max_score):
            return band.level_code
    # Score outside every configured range (e.g. gap in custom bands) —
    # fall back to the nearest band rather than leaving it unset.
    return bands[-1].level_code if score < float(bands[-1].min_score) else bands[0].level_code
