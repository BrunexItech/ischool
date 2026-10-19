from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.core.payroll_calc import compute_pay
from app.models.ledger import Account, JournalEntry, JournalLine
from app.models.payroll import EmploymentType, PayRun, PayRunStatus, PayrollProfile, PayslipLine
from app.models.user import User, UserRole
from app.schemas.payroll import PayRunCreate, PayRunOut, PayrollProfileCreate, PayrollProfileOut, PayrollProfileUpdate

router = APIRouter(prefix="/schools/{school_id}/payroll", tags=["payroll"])

ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SUPERVISOR)
PAYROLL_ELIGIBLE_ROLES = (UserRole.TEACHER, UserRole.STAFF, UserRole.SCHOOL_ADMIN)

TEACHING_SALARY_CODE = "5010"
NON_TEACHING_SALARY_CODE = "5020"
STATUTORY_COST_CODE = "5030"
PAYE_PAYABLE_CODE = "2100"
NSSF_PAYABLE_CODE = "2110"
SHIF_PAYABLE_CODE = "2120"
AHL_PAYABLE_CODE = "2130"
BANK_CODE = "1020"


def _profile_out(profile: PayrollProfile) -> dict:
    return {
        "id": profile.id,
        "user_id": profile.user_id,
        "staff_name": profile.user.full_name,
        "employment_type": profile.employment_type,
        "basic_salary": float(profile.basic_salary),
        "house_allowance": float(profile.house_allowance),
        "transport_allowance": float(profile.transport_allowance),
        "kra_pin": profile.kra_pin,
        "nssf_number": profile.nssf_number,
        "is_active": profile.is_active,
    }


@router.get(
    "/profiles",
    response_model=list[PayrollProfileOut],
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("erp_finance"))],
)
def list_profiles(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    profiles = db.query(PayrollProfile).filter_by(school_id=school_id).all()
    return [_profile_out(p) for p in profiles]


@router.post(
    "/profiles",
    response_model=PayrollProfileOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("erp_finance"))],
)
def create_profile(
    school_id: int, payload: PayrollProfileCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    staff = db.query(User).filter_by(school_id=school_id, id=payload.user_id).first()
    if staff is None or staff.role not in PAYROLL_ELIGIBLE_ROLES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only teachers, staff or the school admin can be put on payroll")
    if db.query(PayrollProfile).filter_by(school_id=school_id, user_id=payload.user_id).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This staff member already has a payroll profile")

    profile = PayrollProfile(school_id=school_id, **payload.model_dump())
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return _profile_out(profile)


@router.patch(
    "/profiles/{profile_id}",
    response_model=PayrollProfileOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("erp_finance"))],
)
def update_profile(
    school_id: int,
    profile_id: int,
    payload: PayrollProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    profile = db.query(PayrollProfile).filter_by(school_id=school_id, id=profile_id).first()
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payroll profile not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return _profile_out(profile)


# --- Pay runs ---


@router.get(
    "/runs",
    response_model=list[PayRunOut],
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("erp_finance"))],
)
def list_runs(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    return db.query(PayRun).filter_by(school_id=school_id).order_by(PayRun.period.desc()).all()


@router.post(
    "/runs",
    response_model=PayRunOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("erp_finance"))],
)
def create_run(school_id: int, payload: PayRunCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    if db.query(PayRun).filter_by(school_id=school_id, period=payload.period).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"A pay run for {payload.period} already exists")

    profiles = db.query(PayrollProfile).filter_by(school_id=school_id, is_active=True).all()
    if not profiles:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No active staff on payroll")

    run = PayRun(school_id=school_id, period=payload.period, created_by=current_user.id)
    db.add(run)
    db.flush()

    for profile in profiles:
        calc = compute_pay(float(profile.basic_salary), float(profile.house_allowance), float(profile.transport_allowance))
        db.add(
            PayslipLine(
                pay_run_id=run.id,
                school_id=school_id,
                user_id=profile.user_id,
                staff_name=profile.user.full_name,
                employment_type=profile.employment_type,
                basic=profile.basic_salary,
                house=profile.house_allowance,
                transport=profile.transport_allowance,
                gross=calc.gross,
                nssf=calc.nssf,
                shif=calc.shif,
                ahl=calc.ahl,
                paye=calc.paye,
                net=calc.net,
            )
        )
    db.commit()
    db.refresh(run)
    return run


@router.get(
    "/runs/{run_id}",
    response_model=PayRunOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("erp_finance"))],
)
def get_run(school_id: int, run_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    run = db.query(PayRun).filter_by(school_id=school_id, id=run_id).first()
    if run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pay run not found")
    return run


@router.post(
    "/runs/{run_id}/pay",
    response_model=PayRunOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("erp_finance"))],
)
def pay_run(school_id: int, run_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    run = db.query(PayRun).filter_by(school_id=school_id, id=run_id).first()
    if run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pay run not found")
    if run.status != PayRunStatus.DRAFT:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only a draft pay run can be paid")

    g_teach = sum(float(l.gross) for l in run.lines if l.employment_type == EmploymentType.TEACHING)
    g_non = sum(float(l.gross) for l in run.lines if l.employment_type == EmploymentType.NON_TEACHING)
    total_nssf = sum(float(l.nssf) for l in run.lines)
    total_shif = sum(float(l.shif) for l in run.lines)
    total_ahl = sum(float(l.ahl) for l in run.lines)
    total_paye = sum(float(l.paye) for l in run.lines)
    total_net = sum(float(l.net) for l in run.lines)
    employer_statutory = total_nssf + total_ahl

    codes = [TEACHING_SALARY_CODE, NON_TEACHING_SALARY_CODE, STATUTORY_COST_CODE, PAYE_PAYABLE_CODE, NSSF_PAYABLE_CODE, SHIF_PAYABLE_CODE, AHL_PAYABLE_CODE, BANK_CODE]
    accounts = {a.code: a for a in db.query(Account).filter(Account.school_id == school_id, Account.code.in_(codes)).all()}

    entry = JournalEntry(
        school_id=school_id,
        entry_date=date.today(),
        reference=f"PAY-{run.period}",
        memo=f"Salaries for {run.period}",
        source="payroll",
        posted_by=current_user.id,
    )
    db.add(entry)
    db.flush()

    def line(code: str, debit: float = 0, credit: float = 0):
        if debit or credit:
            db.add(JournalLine(entry_id=entry.id, account_id=accounts[code].id, debit=debit, credit=credit))

    line(TEACHING_SALARY_CODE, debit=g_teach)
    line(NON_TEACHING_SALARY_CODE, debit=g_non)
    line(STATUTORY_COST_CODE, debit=employer_statutory)
    line(PAYE_PAYABLE_CODE, credit=total_paye)
    line(NSSF_PAYABLE_CODE, credit=total_nssf * 2)
    line(SHIF_PAYABLE_CODE, credit=total_shif)
    line(AHL_PAYABLE_CODE, credit=total_ahl * 2)
    line(BANK_CODE, credit=total_net)

    run.status = PayRunStatus.PAID
    run.paid_by = current_user.id
    run.journal_entry_id = entry.id
    db.commit()
    db.refresh(run)
    return run
