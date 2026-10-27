from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.core.notify import notify
from app.core.report_card import build_report_card
from app.core.grading import level_for_score
from app.core.teaching import ensure_can_grade
from app.core.grading import get_bands
from app.core.results_board import competition_ranks, parse_exam_types, subject_means
from app.models.academics import SchoolClass, Student
from app.models.grade_level import LevelGroup
from app.models.report_card_remark import ReportCardRemark
from app.models.teacher_assignment import TeacherAssignment
from app.core.subjects import ensure_subject_fits_class  # noqa: F401  (used by sibling routers)
from app.models.grade_level import GradeLevel
from app.models.results import Result, Subject, SubjectLevel
from app.models.user import User, UserRole
from app.schemas.results import (
    BoardBand,
    BoardStudent,
    BoardSubject,
    ReportCardOut,
    ReportCardRemarkUpdate,
    ResultOut,
    ResultsBoardOut,
    ResultUpsert,
    SubjectCreate,
    SubjectOut,
    SubjectUpdate,
)

router = APIRouter(prefix="/schools/{school_id}", tags=["results"])

VIEW_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL, UserRole.TEACHER, UserRole.STAFF, UserRole.SECRETARY)
MANAGE_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL)
RECORD_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL, UserRole.TEACHER)
# Entering a score is the teacher's own job — leadership can view the
# Gradebook but not fill it in; their own voice on a report card is the
# principal's remark, handled separately above (RECORD_ROLES there is
# fine since that endpoint enforces who may set which field itself).
GRADE_ENTRY_ROLES = (UserRole.SUPER_ADMIN, UserRole.TEACHER)
SUBJECT_ROLES = MANAGE_ROLES + (UserRole.SECRETARY,)


# --- Subjects ---


@router.get(
    "/subjects",
    response_model=list[SubjectOut],
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("results"))],
)
def list_subjects(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    return db.query(Subject).filter_by(school_id=school_id).all()


def _valid_levels(db: Session, ids: list[int]) -> list[int]:
    wanted = sorted(set(ids))
    found = {g.id for g in db.query(GradeLevel).filter(GradeLevel.id.in_(wanted))} if wanted else set()
    if found != set(wanted):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "One of the selected grades does not exist")
    return wanted


@router.post(
    "/subjects",
    response_model=SubjectOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*SUBJECT_ROLES)), Depends(require_feature("results"))],
)
def create_subject(
    school_id: int,
    payload: SubjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    name = payload.name.strip()
    if not name:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Give the subject a name")
    if db.query(Subject).filter(Subject.school_id == school_id, func.lower(Subject.name) == name.lower()).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That subject already exists")

    subject = Subject(school_id=school_id, name=name)
    subject.levels = [SubjectLevel(grade_level_id=g) for g in _valid_levels(db, payload.grade_level_ids)]
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject


@router.patch(
    "/subjects/{subject_id}",
    response_model=SubjectOut,
    dependencies=[Depends(require_roles(*SUBJECT_ROLES)), Depends(require_feature("results"))],
)
def update_subject(school_id: int, subject_id: int, payload: SubjectUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Rename a subject or change the grades it is taught in. Taking a grade
    away is refused while a class in that grade still has the subject assigned."""
    ensure_school_access(db, current_user, school_id)
    subject = db.query(Subject).filter_by(school_id=school_id, id=subject_id).first()
    if subject is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subject not found")
    if payload.name is not None:
        name = payload.name.strip()
        clash = db.query(Subject).filter(Subject.school_id == school_id, func.lower(Subject.name) == name.lower(), Subject.id != subject_id).first()
        if not name or clash:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "That name is empty or already used by another subject")
        subject.name = name
    if payload.grade_level_ids is not None:
        keep = _valid_levels(db, payload.grade_level_ids)
        if keep:
            in_use = (
                db.query(SchoolClass)
                .join(TeacherAssignment, TeacherAssignment.class_id == SchoolClass.id)
                .filter(TeacherAssignment.school_id == school_id, TeacherAssignment.subject_id == subject_id, SchoolClass.grade_level_id.notin_(keep))
                .first()
            )
            if in_use:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{subject.name} is still assigned in {in_use.name}. Remove that assignment first.")
        subject.levels = [l for l in subject.levels if l.grade_level_id in keep] + [
            SubjectLevel(grade_level_id=g) for g in keep if g not in subject.grade_level_ids
        ]
    db.commit()
    db.refresh(subject)
    return subject


@router.delete(
    "/subjects/{subject_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(*SUBJECT_ROLES)), Depends(require_feature("results"))],
)
def delete_subject(school_id: int, subject_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Only a subject nothing has been recorded against can be removed."""
    ensure_school_access(db, current_user, school_id)
    subject = db.query(Subject).filter_by(school_id=school_id, id=subject_id).first()
    if subject is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subject not found")
    if db.query(Result.id).filter_by(subject_id=subject_id).first() or db.query(TeacherAssignment.id).filter_by(subject_id=subject_id).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This subject has marks or teacher assignments, so it cannot be deleted")
    db.delete(subject)
    db.commit()


# The five official Pre-Primary learning areas — Kenya School Readiness
# Assessment Tool, Ministry of Education Assessors' Guide (April 2022),
# Foreword p.ii. Fixed, verified names; not teacher/admin-editable here,
# only seeded once per school on request.
PRE_PRIMARY_LEARNING_AREAS = [
    "Language Activities",
    "Mathematical Activities",
    "Environmental Activities",
    "Psychomotor and Creative Activities",
    "Religious Education Activities",
]


@router.post(
    "/subjects/seed-pre-primary-learning-areas",
    response_model=list[SubjectOut],
    dependencies=[Depends(require_roles(*MANAGE_ROLES, UserRole.TEACHER)), Depends(require_feature("results"))],
)
def seed_pre_primary_learning_areas(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Idempotent — adds any of the five official learning areas this
    school doesn't already have as a Subject, by case-insensitive name
    match. Never duplicates, never touches existing subjects. A teacher
    can only do this if they actually teach a PP1/PP2 class — it's not a
    general subject-management power for them, just this one shortcut."""
    ensure_school_access(db, current_user, school_id)

    if current_user.role == UserRole.TEACHER:
        teaches_pre_primary = (
            db.query(SchoolClass)
            .join(TeacherAssignment, TeacherAssignment.class_id == SchoolClass.id)
            .filter(
                SchoolClass.school_id == school_id,
                SchoolClass.grade.has(level_group=LevelGroup.PRE_PRIMARY),
                TeacherAssignment.teacher_user_id == current_user.id,
            )
            .first()
            is not None
            or db.query(SchoolClass)
            .filter(
                SchoolClass.school_id == school_id,
                SchoolClass.homeroom_teacher_id == current_user.id,
                SchoolClass.grade.has(level_group=LevelGroup.PRE_PRIMARY),
            )
            .first()
            is not None
        )
        if not teaches_pre_primary:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You don't teach a PP1/PP2 class")

    existing_names = {s.name.strip().lower() for s in db.query(Subject).filter_by(school_id=school_id).all()}
    created = []
    for name in PRE_PRIMARY_LEARNING_AREAS:
        if name.strip().lower() not in existing_names:
            subject = Subject(school_id=school_id, name=name)
            db.add(subject)
            created.append(subject)
    db.commit()
    for s in created:
        db.refresh(s)
    return db.query(Subject).filter_by(school_id=school_id).filter(Subject.name.in_(PRE_PRIMARY_LEARNING_AREAS)).all()


# --- Results ---


@router.get(
    "/results",
    response_model=list[ResultOut],
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("results"))],
)
def list_results(
    school_id: int,
    student_id: int | None = Query(default=None),
    subject_id: int | None = Query(default=None),
    term: str | None = Query(default=None),
    exam_type: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    query = db.query(Result).filter_by(school_id=school_id)
    if exam_type is not None:
        query = query.filter_by(exam_type=exam_type)
    if student_id is not None:
        query = query.filter_by(student_id=student_id)
    if subject_id is not None:
        query = query.filter_by(subject_id=subject_id)
    if term is not None:
        query = query.filter_by(term=term)
    return query.all()


@router.get(
    "/students/{student_id}/report-card",
    response_model=ReportCardOut,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("results"))],
)
def get_report_card(
    school_id: int,
    student_id: int,
    term: str,
    exam_types: str | None = Query(default=None, description="Comma-separated exam types to compile; all when empty"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    student = db.query(Student).filter_by(school_id=school_id, id=student_id).first()
    if student is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")
    return build_report_card(db, student, term, parse_exam_types(exam_types))


@router.patch(
    "/students/{student_id}/report-card-remarks",
    response_model=ReportCardOut,
    dependencies=[Depends(require_roles(*RECORD_ROLES)), Depends(require_feature("results"))],
)
def update_report_card_remarks(
    school_id: int,
    student_id: int,
    term: str,
    payload: ReportCardRemarkUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """A school_admin can set either comment; a teacher can only set the
    class-teacher comment, and only for a class they're the homeroom
    teacher of — the head teacher's word isn't a subject teacher's to give."""
    ensure_school_access(db, current_user, school_id)
    student = db.query(Student).filter_by(school_id=school_id, id=student_id).first()
    if student is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")

    is_admin = current_user.role in (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL)
    if not is_admin:
        if payload.principal_remark is not None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only a school admin can set the principal's remark")
        is_homeroom_teacher = (
            student.school_class is not None and student.school_class.homeroom_teacher_id == current_user.id
        )
        if not is_homeroom_teacher:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only this class's homeroom teacher can add a remark")

    remark = db.query(ReportCardRemark).filter_by(school_id=school_id, student_id=student_id, term=term).first()
    if remark is None:
        remark = ReportCardRemark(school_id=school_id, student_id=student_id, term=term)
        db.add(remark)

    if payload.class_teacher_remark is not None:
        remark.class_teacher_remark = payload.class_teacher_remark
    if payload.principal_remark is not None:
        remark.principal_remark = payload.principal_remark

    db.commit()
    return build_report_card(db, student, term)


@router.post(
    "/results",
    response_model=ResultOut,
    dependencies=[Depends(require_roles(*GRADE_ENTRY_ROLES)), Depends(require_feature("results"))],
)
def upsert_result(
    school_id: int,
    payload: ResultUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upserts a student's score for a subject/term — re-submitting corrects it,
    matching how a teacher actually enters grades over time."""
    ensure_school_access(db, current_user, school_id)

    student = db.query(Student).filter_by(school_id=school_id, id=payload.student_id).first()
    if student is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")
    ensure_can_grade(db, current_user, student.class_id, payload.subject_id)
    exam_type = payload.exam_type.strip() or "Not specified"

    result = (
        db.query(Result)
        .filter_by(
            school_id=school_id,
            student_id=payload.student_id,
            subject_id=payload.subject_id,
            term=payload.term,
            exam_type=exam_type,
        )
        .first()
    )
    grade = payload.grade or level_for_score(db, school_id, payload.score)

    # A class teacher reviews the whole class but does not own other
    # teachers' subjects: marks someone else entered are not theirs to change.
    if (
        result is not None
        and current_user.role == UserRole.TEACHER
        and result.recorded_by not in (None, current_user.id)
        and student.school_class is not None
        and student.school_class.homeroom_teacher_id == current_user.id
    ):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "These marks were entered by the subject teacher and can only be changed by them",
        )

    if result:
        before = {"score": float(result.score), "grade": result.grade, "remarks": result.remarks}
        result.score = payload.score
        result.grade = grade
        result.remarks = payload.remarks
        result.recorded_by = current_user.id
        action = "result.update"
    else:
        before = None
        result = Result(
            school_id=school_id,
            student_id=payload.student_id,
            subject_id=payload.subject_id,
            term=payload.term,
            exam_type=exam_type,
            score=payload.score,
            grade=grade,
            remarks=payload.remarks,
            recorded_by=current_user.id,
        )
        db.add(result)
        db.flush()
        action = "result.create"

    record_audit(
        db,
        school_id=school_id,
        actor_id=current_user.id,
        action=action,
        entity_type="result",
        entity_id=result.id,
        before=before,
        after={"score": payload.score, "grade": grade, "remarks": payload.remarks},
    )

    if student.guardian_user_id is not None:
        notify(
            db,
            school_id=school_id,
            user_id=student.guardian_user_id,
            title=f"New result for {student.first_name}",
            body=f"{student.first_name} {student.last_name} scored {payload.score} ({grade}) for {payload.term} ({exam_type}).",
        )

    db.commit()
    db.refresh(result)
    return result


# --- Class subjects & results board ---


def _class_or_404(db: Session, school_id: int, class_id: int) -> SchoolClass:
    school_class = db.query(SchoolClass).filter_by(school_id=school_id, id=class_id).first()
    if school_class is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found")
    return school_class


def _class_subject_ids(db: Session, school_id: int, class_id: int) -> list[int]:
    rows = (
        db.query(TeacherAssignment.subject_id)
        .filter(
            TeacherAssignment.school_id == school_id,
            TeacherAssignment.class_id == class_id,
            TeacherAssignment.subject_id.isnot(None),
        )
        .distinct()
        .all()
    )
    return [r[0] for r in rows]


@router.get(
    "/classes/{class_id}/subjects",
    response_model=list[SubjectOut],
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("results"))],
)
def list_class_subjects(school_id: int, class_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """The subjects allocated to a class. Every learner in the class takes
    them automatically — there is no separate per-learner subject enrolment."""
    ensure_school_access(db, current_user, school_id)
    _class_or_404(db, school_id, class_id)
    ids = _class_subject_ids(db, school_id, class_id)
    if not ids:
        return []
    return db.query(Subject).filter(Subject.school_id == school_id, Subject.id.in_(ids)).order_by(Subject.name).all()


@router.get(
    "/classes/{class_id}/results-board",
    response_model=ResultsBoardOut,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("results"))],
)
def class_results_board(
    school_id: int,
    class_id: int,
    term: str,
    exam_types: str | None = Query(default=None, description="Comma-separated exam types to compile; all when empty"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Every learner in the class against every subject of the class, best
    first. Read-only: the class teacher sees all subjects but marks are only
    ever entered by each subject's own teacher."""
    ensure_school_access(db, current_user, school_id)
    school_class = _class_or_404(db, school_id, class_id)
    is_admin = current_user.role in MANAGE_ROLES
    is_class_teacher = current_user.role == UserRole.TEACHER and school_class.homeroom_teacher_id == current_user.id
    if not (is_admin or is_class_teacher):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only this class's teacher or school leadership can see the class results board")

    selected = parse_exam_types(exam_types)
    students = (
        db.query(Student)
        .filter_by(school_id=school_id, class_id=class_id, is_active=True)
        .order_by(Student.first_name, Student.last_name)
        .all()
    )
    student_ids = [s.id for s in students]
    means = subject_means(db, school_id, student_ids, term, selected)

    available = sorted(
        {
            r[0]
            for r in db.query(Result.exam_type)
            .filter(Result.school_id == school_id, Result.term == term, Result.student_id.in_(student_ids or [0]))
            .distinct()
            .all()
        }
    )

    subject_ids = set(_class_subject_ids(db, school_id, class_id))
    for subs in means.values():
        subject_ids.update(subs.keys())
    subjects = (
        db.query(Subject).filter(Subject.school_id == school_id, Subject.id.in_(subject_ids or [0])).order_by(Subject.name).all()
    )

    grade = school_class.grade
    pre_primary = grade is not None and grade.level_group == LevelGroup.PRE_PRIMARY

    averages: dict[int, float] = {}
    for s in students:
        marks = list(means.get(s.id, {}).values())
        if marks:
            averages[s.id] = sum(marks) / len(marks)
    ranks = {} if pre_primary else competition_ranks(averages)

    out: list[BoardStudent] = []
    for s in students:
        mine = means.get(s.id, {})
        avg = averages.get(s.id)
        out.append(
            BoardStudent(
                student_id=s.id,
                name=f"{s.first_name} {s.last_name}",
                admission_number=s.admission_number,
                scores={sub.id: (round(mine[sub.id], 2) if sub.id in mine else None) for sub in subjects},
                levels={sub.id: (level_for_score(db, school_id, mine[sub.id]) if sub.id in mine else None) for sub in subjects},
                total=round(sum(mine.values()), 2),
                average=round(avg, 2) if avg is not None else None,
                level=level_for_score(db, school_id, avg) if avg is not None else None,
                subjects_marked=len(mine),
                rank=ranks.get(s.id),
            )
        )
    # Best first; learners with no marks go last. Pre-primary is never ranked
    # (see _class_position), so those classes stay alphabetical.
    if not pre_primary:
        out.sort(key=lambda b: (b.average is None, -(b.average or 0), b.name))

    bands = [
        BoardBand(level_code=b.level_code, label=b.label, min_score=float(b.min_score), max_score=float(b.max_score))
        for b in get_bands(db, school_id)
    ]
    class_avg = round(sum(averages.values()) / len(averages), 2) if averages else None
    return ResultsBoardOut(
        class_id=class_id,
        class_name=school_class.name,
        term=term,
        selected_exam_types=selected,
        available_exam_types=available,
        subjects=[BoardSubject(id=x.id, name=x.name) for x in subjects],
        students=out,
        bands=bands,
        ranked=not pre_primary,
        class_average=class_avg,
    )
