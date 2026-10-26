"""Shared maths for turning many exam-type marks into one mark per subject.

A learner can have several marks for the same subject in a term (Opener,
CAT 1, Mid Term...). Anywhere a single figure is needed — report card, class
position, results board — the chosen exam types are averaged per subject
first, so a subject with three papers never counts three times."""

from sqlalchemy.orm import Session

from app.models.results import Result


def parse_exam_types(raw: str | None) -> list[str]:
    return [t.strip() for t in (raw or "").split(",") if t.strip()]


def subject_means(
    db: Session, school_id: int, student_ids: list[int], term: str, exam_types: list[str] | None
) -> dict[int, dict[int, float]]:
    """{student_id: {subject_id: mean score}} for the chosen exam types
    (all types when none are chosen)."""
    if not student_ids:
        return {}
    query = db.query(Result.student_id, Result.subject_id, Result.score).filter(
        Result.school_id == school_id, Result.term == term, Result.student_id.in_(student_ids)
    )
    if exam_types:
        query = query.filter(Result.exam_type.in_(exam_types))
    grouped: dict[int, dict[int, list[float]]] = {}
    for sid, subj, score in query.all():
        grouped.setdefault(sid, {}).setdefault(subj, []).append(float(score))
    return {sid: {subj: sum(v) / len(v) for subj, v in subjects.items()} for sid, subjects in grouped.items()}


def competition_ranks(totals: dict[int, float]) -> dict[int, int]:
    """Highest total first; equal totals share a rank (1, 2, 2, 4)."""
    ordered = sorted(totals.items(), key=lambda kv: kv[1], reverse=True)
    ranks: dict[int, int] = {}
    last_value: float | None = None
    last_rank = 0
    for i, (sid, value) in enumerate(ordered, start=1):
        if value != last_value:
            last_rank = i
            last_value = value
        ranks[sid] = last_rank
    return ranks
