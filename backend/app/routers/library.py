from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.dates import school_today
from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.core.notify import notify
from app.models.academics import SchoolClass, Student
from app.models.library import Book, BookCopy, Loan
from app.models.results import Subject
from app.models.user import User, UserRole
from app.schemas.library import (
    AddCopies,
    BookCreate,
    BookDetail,
    BookOut,
    BookUpdate,
    ClassSet,
    CopyOut,
    Holder,
    LibraryOverview,
    LoanIssue,
    LoanOut,
    LoanReturn,
    TeacherHoldings,
)

router = APIRouter(prefix="/schools/{school_id}/library", tags=["library"], dependencies=[Depends(require_feature("library"))])

KEEPERS = (UserRole.SUPER_ADMIN, UserRole.LIBRARIAN)
OVERSEERS = (UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL)
READERS = KEEPERS + OVERSEERS + (UserRole.TEACHER, UserRole.STAFF)
EVERYONE = READERS + (UserRole.STUDENT, UserRole.PARENT)
CONDITIONS = ("good", "fair", "poor")
STUDENT_DAYS, CLASS_SET_DAYS, MAX_STUDENT_BOOKS = 14, 90, 3


# --- helpers ---


def _is_active(l: Loan) -> bool:
    return l.returned_at is None


def _overdue(l: Loan, today: date) -> int:
    return max(0, (today - l.due_date).days) if _is_active(l) else 0


def _loan_out(l: Loan, today: date) -> LoanOut:
    parent = l.parent_loan_id and next((x for x in l.copy.loans if x.id == l.parent_loan_id), None)
    student = l.student
    return LoanOut(
        id=l.id,
        copy_number=l.copy.copy_number,
        title=l.copy.book.title,
        author=l.copy.book.author,
        borrower_kind="student" if student else "teacher",
        borrower_name=f"{student.first_name} {student.last_name}" if student else (l.teacher.full_name if l.teacher else "Unknown"),
        class_name=(student.school_class.name if student and student.school_class else None) if student else (l.school_class.name if l.school_class else None),
        via_teacher=(parent.teacher.full_name if parent and parent.teacher else None),
        issued_by_name=l.issuer.full_name if l.issuer else None,
        issued_at=l.issued_at,
        due_date=l.due_date,
        returned_at=l.returned_at,
        returned_to_name=None,
        overdue=_overdue(l, today) > 0,
        days_overdue=_overdue(l, today),
        parent_loan_id=l.parent_loan_id,
        active=_is_active(l),
    )


def _leaf_holder(copy: BookCopy) -> Loan | None:
    """Who has the book right now: the learner if a teacher handed it on,
    otherwise whoever the library lent it to."""
    active = [l for l in copy.loans if _is_active(l)]
    kids = [l for l in active if l.parent_loan_id]
    return kids[-1] if kids else (active[-1] if active else None)


def _holder(copy: BookCopy, today: date) -> Holder | None:
    l = _leaf_holder(copy)
    if l is None:
        return None
    out = _loan_out(l, today)
    return Holder(loan_id=l.id, kind=out.borrower_kind, name=out.borrower_name, class_name=out.class_name, via_teacher=out.via_teacher, due_date=l.due_date, overdue=out.overdue)


def _book_out(db: Session, b: Book) -> BookOut:
    counts = {"available": 0, "on_loan": 0, "lost": 0}
    for c in b.copies:
        if c.status in counts:
            counts[c.status] += 1
    subject = db.get(Subject, b.subject_id) if b.subject_id else None
    return BookOut(id=b.id, title=b.title, author=b.author, isbn=b.isbn, category=b.category, shelf=b.shelf, subject_name=subject.name if subject else None, total_copies=len(b.copies), **counts)


def _next_numbers(db: Session, school_id: int, count: int) -> list[str]:
    last = db.query(func.max(BookCopy.id)).filter(BookCopy.school_id == school_id).scalar() or 0
    taken = {r[0] for r in db.query(BookCopy.copy_number).filter_by(school_id=school_id)}
    out, n = [], last
    while len(out) < count:
        n += 1
        num = f"BK-{n:06d}"
        if num not in taken:
            out.append(num)
    return out


def _book_or_404(db: Session, school_id: int, book_id: int) -> Book:
    b = db.query(Book).filter_by(school_id=school_id, id=book_id).first()
    if b is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Book not found")
    return b


def _copy_by_number(db: Session, school_id: int, number: str) -> BookCopy:
    c = db.query(BookCopy).filter(BookCopy.school_id == school_id, func.upper(BookCopy.copy_number) == number.strip().upper()).first()
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No book has the number {number.strip()}")
    return c


def _my_students(db: Session, school_id: int, user: User) -> list[Student]:
    if user.role == UserRole.STUDENT:
        return db.query(Student).filter_by(school_id=school_id, user_id=user.id).all()
    if user.role == UserRole.PARENT:
        return db.query(Student).filter_by(school_id=school_id, guardian_user_id=user.id).all()
    return []


# --- catalogue ---


@router.get("/books", response_model=list[BookOut], dependencies=[Depends(require_roles(*EVERYONE))])
def list_books(school_id: int, q: str | None = None, category: str | None = None, available_only: bool = False, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    query = db.query(Book).filter_by(school_id=school_id)
    if q:
        like = f"%{q.strip()}%"
        copy_ids = db.query(BookCopy.book_id).filter(BookCopy.school_id == school_id, BookCopy.copy_number.ilike(like))
        query = query.filter((Book.title.ilike(like)) | (Book.author.ilike(like)) | (Book.isbn.ilike(like)) | (Book.id.in_(copy_ids)))
    if category:
        query = query.filter_by(category=category)
    out = [_book_out(db, b) for b in query.order_by(Book.title).limit(500)]
    return [b for b in out if b.available > 0] if available_only else out


@router.post("/books", response_model=BookDetail, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_roles(*KEEPERS))])
def add_book(school_id: int, payload: BookCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Add a title with any number of copies; each copy gets its own number to write inside the cover."""
    ensure_school_access(db, current_user, school_id)
    if payload.condition not in CONDITIONS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Condition must be good, fair or poor")
    if payload.subject_id and not db.query(Subject.id).filter_by(school_id=school_id, id=payload.subject_id).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That subject does not belong to this school")
    book = Book(school_id=school_id, title=payload.title.strip(), author=payload.author, isbn=payload.isbn, category=payload.category, subject_id=payload.subject_id, shelf=payload.shelf)
    for num in _next_numbers(db, school_id, payload.copies):
        book.copies.append(BookCopy(school_id=school_id, copy_number=num, condition=payload.condition))
    db.add(book)
    db.commit()
    db.refresh(book)
    return _detail(db, book)


def _detail(db: Session, book: Book) -> BookDetail:
    today = school_today(db, book.school_id)
    copies = sorted(book.copies, key=lambda c: c.copy_number)
    return BookDetail(book=_book_out(db, book), copies=[CopyOut(id=c.id, copy_number=c.copy_number, condition=c.condition, status=c.status, holder=_holder(c, today)) for c in copies])


@router.get("/books/{book_id}", response_model=BookDetail, dependencies=[Depends(require_roles(*EVERYONE))])
def get_book(school_id: int, book_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    detail = _detail(db, _book_or_404(db, school_id, book_id))
    if current_user.role in (UserRole.STUDENT, UserRole.PARENT):
        for c in detail.copies:
            c.holder = None  # learners see availability, not who has each copy
    return detail


@router.patch("/books/{book_id}", response_model=BookOut, dependencies=[Depends(require_roles(*KEEPERS))])
def update_book(school_id: int, book_id: int, payload: BookUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    book = _book_or_404(db, school_id, book_id)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(book, k, v)
    db.commit()
    db.refresh(book)
    return _book_out(db, book)


@router.post("/books/{book_id}/copies", response_model=BookDetail, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_roles(*KEEPERS))])
def add_copies(school_id: int, book_id: int, payload: AddCopies, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    book = _book_or_404(db, school_id, book_id)
    for num in _next_numbers(db, school_id, payload.count):
        book.copies.append(BookCopy(school_id=school_id, copy_number=num, condition=payload.condition if payload.condition in CONDITIONS else "good"))
    db.commit()
    db.refresh(book)
    return _detail(db, book)


@router.post("/copies/{copy_id}/withdraw", response_model=BookDetail, dependencies=[Depends(require_roles(*KEEPERS))])
def withdraw_copy(school_id: int, copy_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Take a damaged or lost copy out of circulation."""
    ensure_school_access(db, current_user, school_id)
    copy = db.query(BookCopy).filter_by(school_id=school_id, id=copy_id).first()
    if copy is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Copy not found")
    if copy.status == "on_loan":
        raise HTTPException(status.HTTP_409_CONFLICT, "This copy is on loan; take it back first")
    copy.status = "withdrawn"
    db.commit()
    return _detail(db, copy.book)


# --- lending ---


@router.get("/teachers", dependencies=[Depends(require_roles(*KEEPERS))])
def lendable_teachers(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Teachers the library can lend a class set to."""
    ensure_school_access(db, current_user, school_id)
    rows = db.query(User).filter_by(school_id=school_id, role=UserRole.TEACHER, is_active=True).order_by(User.full_name).all()
    return [{"user_id": u.id, "full_name": u.full_name} for u in rows]


@router.get("/copies/{number}", response_model=CopyOut, dependencies=[Depends(require_roles(*READERS))])
def look_up_copy(school_id: int, number: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Who has the book with this number?"""
    ensure_school_access(db, current_user, school_id)
    c = _copy_by_number(db, school_id, number)
    return CopyOut(id=c.id, copy_number=c.copy_number, condition=c.condition, status=c.status, holder=_holder(c, school_today(db, school_id)))


@router.post("/loans", response_model=LoanOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_roles(*KEEPERS, UserRole.TEACHER))])
def issue(school_id: int, payload: LoanIssue, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """The library lends to a learner or to a teacher for a class; a teacher
    hands a book they hold on to a learner in that class."""
    ensure_school_access(db, current_user, school_id)
    if (payload.student_id is None) == (payload.teacher_user_id is None):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Choose either a learner or a teacher to lend to")
    today = school_today(db, school_id)
    copy = _copy_by_number(db, school_id, payload.copy_number)
    teacher_acting = current_user.role == UserRole.TEACHER
    parent: Loan | None = None

    if teacher_acting:
        if payload.student_id is None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the library lends books to a teacher")
        parent = next((l for l in copy.loans if _is_active(l) and l.teacher_user_id == current_user.id and not l.parent_loan_id), None)
        if parent is None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"{copy.copy_number} is not one of the books the library lent you")
        if any(_is_active(l) and l.parent_loan_id == parent.id for l in copy.loans):
            raise HTTPException(status.HTTP_409_CONFLICT, f"{copy.copy_number} is already with a learner")
    else:
        if copy.status != "available":
            raise HTTPException(status.HTTP_409_CONFLICT, f"{copy.copy_number} is not on the shelf ({copy.status.replace('_', ' ')})")

    loan = Loan(school_id=school_id, copy_id=copy.id, issued_by=current_user.id, note=payload.note)
    if payload.student_id is not None:
        student = db.query(Student).filter_by(school_id=school_id, id=payload.student_id, is_active=True).first()
        if student is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Learner not found")
        if parent is not None and parent.for_class_id and student.class_id != parent.for_class_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "This book was borrowed for a different class")
        held = sum(1 for l in db.query(Loan).filter_by(school_id=school_id, student_id=student.id) if _is_active(l))
        if held >= MAX_STUDENT_BOOKS:
            raise HTTPException(status.HTTP_409_CONFLICT, f"{student.first_name} already has {held} books out. Ask for one back first.")
        loan.student_id = student.id
        loan.parent_loan_id = parent.id if parent else None
        loan.for_class_id = student.class_id
        loan.due_date = payload.due_date or today + timedelta(days=STUDENT_DAYS)
        if parent is not None:
            loan.due_date = min(loan.due_date, parent.due_date)
        if student.guardian_user_id:
            notify(db, school_id=school_id, user_id=student.guardian_user_id, title=f"{student.first_name} borrowed a book", body=f"{copy.book.title} ({copy.copy_number}), due {loan.due_date:%d %b}.", link="/dashboard/library")
    else:
        teacher = db.query(User).filter_by(id=payload.teacher_user_id, school_id=school_id, role=UserRole.TEACHER, is_active=True).first()
        if teacher is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Teacher not found")
        if payload.for_class_id and not db.query(SchoolClass.id).filter_by(school_id=school_id, id=payload.for_class_id).first():
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "That class does not belong to this school")
        loan.teacher_user_id = teacher.id
        loan.for_class_id = payload.for_class_id
        loan.due_date = payload.due_date or today + timedelta(days=CLASS_SET_DAYS)
    if loan.due_date < today:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "The due date is in the past")
    copy.status = "on_loan"
    db.add(loan)
    db.commit()
    db.refresh(loan)
    return _loan_out(loan, today)


@router.post("/loans/{loan_id}/return", response_model=LoanOut, dependencies=[Depends(require_roles(*KEEPERS, UserRole.TEACHER))])
def take_back(school_id: int, loan_id: int, payload: LoanReturn | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    loan = db.query(Loan).filter_by(school_id=school_id, id=loan_id).first()
    if loan is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Loan not found")
    if not _is_active(loan):
        raise HTTPException(status.HTTP_409_CONFLICT, "This book has already been returned")
    body = payload or LoanReturn()
    if body.condition not in (*CONDITIONS, "lost"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Condition must be good, fair, poor or lost")
    parent = next((l for l in loan.copy.loans if l.id == loan.parent_loan_id), None)
    if current_user.role == UserRole.TEACHER:
        if parent is None or parent.teacher_user_id != current_user.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only take back books you gave to learners")
    if loan.teacher_user_id and not loan.parent_loan_id and any(_is_active(l) and l.parent_loan_id == loan.id for l in loan.copy.loans):
        raise HTTPException(status.HTTP_409_CONFLICT, "A learner still has this book. Take it back from them first.")
    loan.returned_at = datetime.now(timezone.utc)
    loan.returned_to = current_user.id
    loan.return_condition = body.condition
    if body.note:
        loan.note = body.note
    copy = loan.copy
    if body.condition == "lost":
        copy.status = "lost"
    else:
        if body.condition in CONDITIONS:
            copy.condition = body.condition
        copy.status = "on_loan" if parent is not None and _is_active(parent) else "available"
    db.commit()
    db.refresh(loan)
    return _loan_out(loan, school_today(db, school_id))


# --- who has what ---


@router.get("/loans", response_model=list[LoanOut], dependencies=[Depends(require_roles(*KEEPERS, *OVERSEERS))])
def list_loans(school_id: int, state: str = "active", student_id: int | None = None, class_id: int | None = None, q: str | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """state: active | overdue | returned | all."""
    ensure_school_access(db, current_user, school_id)
    today = school_today(db, school_id)
    query = db.query(Loan).filter_by(school_id=school_id)
    if student_id:
        query = query.filter_by(student_id=student_id)
    rows = query.order_by(Loan.issued_at.desc()).limit(600).all()
    out = [_loan_out(l, today) for l in rows]
    if state == "active":
        out = [l for l in out if l.active]
    elif state == "overdue":
        out = [l for l in out if l.overdue]
    elif state == "returned":
        out = [l for l in out if not l.active]
    if class_id:
        cls = db.query(SchoolClass).filter_by(school_id=school_id, id=class_id).first()
        out = [l for l in out if cls and l.class_name == cls.name]
    if q:
        needle = q.strip().lower()
        out = [l for l in out if needle in f"{l.title} {l.copy_number} {l.borrower_name} {l.via_teacher or ''}".lower()]
    return out


def _class_sets(db: Session, school_id: int, today: date, teacher_id: int | None = None) -> list[ClassSet]:
    q = db.query(Loan).filter(Loan.school_id == school_id, Loan.teacher_user_id.isnot(None), Loan.parent_loan_id.is_(None), Loan.returned_at.is_(None))
    if teacher_id:
        q = q.filter(Loan.teacher_user_id == teacher_id)
    groups: dict[tuple[int, int | None, date], list[Loan]] = {}
    for l in q.order_by(Loan.issued_at):
        groups.setdefault((l.teacher_user_id, l.for_class_id, l.due_date), []).append(l)
    out = []
    for (tid, cid, due), loans in groups.items():
        with_kids = sum(1 for l in loans if any(_is_active(c) and c.parent_loan_id == l.id for c in l.copy.loans))
        out.append(
            ClassSet(
                loan_id=loans[0].id,
                teacher_id=tid,
                teacher_name=loans[0].teacher.full_name if loans[0].teacher else "Unknown",
                class_name=loans[0].school_class.name if loans[0].school_class else None,
                titles=sorted({l.copy.book.title for l in loans}),
                copies=len(loans),
                with_learners=with_kids,
                due_date=due,
                overdue=due < today,
                copy_numbers=sorted(l.copy.copy_number for l in loans),
            )
        )
    out.sort(key=lambda s: (s.teacher_name, s.class_name or ""))
    return out


@router.get("/mine", response_model=TeacherHoldings, dependencies=[Depends(require_roles(UserRole.TEACHER))])
def my_holdings(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """The books the library lent this teacher for their class, and which learner has each."""
    ensure_school_access(db, current_user, school_id)
    today = school_today(db, school_id)
    mine = {l.id for l in db.query(Loan).filter_by(school_id=school_id, teacher_user_id=current_user.id)}
    kids = [_loan_out(l, today) for l in db.query(Loan).filter(Loan.school_id == school_id, Loan.parent_loan_id.in_(mine or [-1]), Loan.returned_at.is_(None))]
    return TeacherHoldings(sets=_class_sets(db, school_id, today, current_user.id), learner_loans=kids)


@router.get("/students/{student_id}/loans", response_model=list[LoanOut], dependencies=[Depends(require_roles(*EVERYONE))])
def student_loans(school_id: int, student_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """A learner's books, current and past. Learners and parents see only their own."""
    ensure_school_access(db, current_user, school_id)
    if current_user.role in (UserRole.STUDENT, UserRole.PARENT) and student_id not in {s.id for s in _my_students(db, school_id, current_user)}:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "That is not your record")
    today = school_today(db, school_id)
    return [_loan_out(l, today) for l in db.query(Loan).filter_by(school_id=school_id, student_id=student_id).order_by(Loan.issued_at.desc()).limit(200)]


@router.get("/my-books", response_model=list[LoanOut], dependencies=[Depends(require_roles(UserRole.STUDENT, UserRole.PARENT))])
def my_books(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Books the signed-in learner (or their children) have out or had."""
    ensure_school_access(db, current_user, school_id)
    ids = [s.id for s in _my_students(db, school_id, current_user)]
    today = school_today(db, school_id)
    return [_loan_out(l, today) for l in db.query(Loan).filter(Loan.school_id == school_id, Loan.student_id.in_(ids or [-1])).order_by(Loan.issued_at.desc()).limit(200)]


@router.get("/overview", response_model=LibraryOverview, dependencies=[Depends(require_roles(*KEEPERS, *OVERSEERS))])
def overview(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    today = school_today(db, school_id)
    copies = db.query(BookCopy).filter_by(school_id=school_id).all()
    loans = db.query(Loan).filter_by(school_id=school_id).order_by(Loan.issued_at.desc()).limit(1000).all()
    active = [l for l in loans if _is_active(l)]
    leaf = [l for l in active if l.student_id or not any(_is_active(c) and c.parent_loan_id == l.id for c in l.copy.loans)]
    overdue = [_loan_out(l, today) for l in leaf if _overdue(l, today) > 0]
    overdue.sort(key=lambda l: -l.days_overdue)
    titles: dict[str, int] = {}
    for l in loans:
        titles[l.copy.book.title] = titles.get(l.copy.book.title, 0) + 1
    return LibraryOverview(
        titles=db.query(Book).filter_by(school_id=school_id).count(),
        copies=len(copies),
        available=sum(1 for c in copies if c.status == "available"),
        on_loan=sum(1 for c in copies if c.status == "on_loan"),
        lost=sum(1 for c in copies if c.status == "lost"),
        overdue=len(overdue),
        borrowers_now=len({l.student_id for l in active if l.student_id}),
        class_sets=_class_sets(db, school_id, today),
        overdue_loans=overdue[:30],
        recent=[_loan_out(l, today) for l in loans[:15]],
        popular=[{"title": t, "loans": n} for t, n in sorted(titles.items(), key=lambda kv: -kv[1])[:8]],
    )
