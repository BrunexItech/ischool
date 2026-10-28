from datetime import date, datetime, timedelta, timezone

from app.core.payroll_calc import compute_pay
from app.models.asset import AssetStatus, FixedAsset
from app.models.budget import Budget
from app.models.expense import Expense, ExpenseStatus
from app.models.fees import FeePayment
from app.models.ledger import Account, JournalEntry, JournalLine
from app.models.payroll import EmploymentType, PayRun, PayRunStatus, PayrollProfile, PayslipLine
from app.models.procurement import PurchaseOrder, PurchaseOrderStatus, PurchaseRequisition, RequisitionStatus
from app.models.store import StockItem, StockMovement, StockMovementType, StoreRequest, StoreRequestLine
from app.models.supplier import Supplier
from app.models.user import User, UserRole
from app.seed.academics import Ctx
from app.seed.core import Seeder


def _accounts(s: Seeder) -> dict:
    return {a.code: a for a in s.db.query(Account).filter_by(school_id=s.sid)}


def _at(d: date, h: int = 10) -> datetime:
    return datetime(d.year, d.month, d.day, h, 0, tzinfo=timezone.utc)


def _post(s: Seeder, when: date, ref: str, memo: str, source: str, lines: list[tuple], by) -> JournalEntry:
    entry = s.add(JournalEntry(school_id=s.sid, entry_date=when, reference=ref, memo=memo, source=source, posted_by=by.id if by else None))
    s.flush()
    for acc, debit, credit in lines:
        s.add(JournalLine(entry_id=entry.id, account_id=acc.id, debit=debit, credit=credit))
    return entry


def seed_ledger_and_expenses(s: Seeder, ctx: Ctx):
    acc = _accounts(s)
    head = s.db.query(User).filter_by(school_id=s.sid, role=UserRole.HEAD_OF_INSTITUTION).first()
    bursar = (ctx.staff.get(UserRole.BURSAR) or [head])[0]
    first_of_month = s.today.replace(day=1)
    # Opening balances: the school starts the year with cash at the bank and an accumulated fund behind it.
    _post(s, date(s.today.year, 1, 2), "OB-001", "Opening balances", "manual", [(acc["1010"], 2_400_000, 0), (acc["1040"], 60_000, 0), (acc["3000"], 0, 2_460_000)], bursar)
    # Fees banked: every payment is recorded in the ledger by month.
    by_month: dict = {}
    for paid_at, amount in s.db.query(FeePayment.paid_at, FeePayment.amount).filter(FeePayment.school_id == s.sid):
        key = (paid_at.year, paid_at.month)
        by_month[key] = by_month.get(key, 0) + float(amount)
    for i, ((y, m), total) in enumerate(sorted(by_month.items())):
        if total:
            _post(s, date(y, m, 28 if m != 2 else 27), f"FEE-{i + 1:03d}", "Fees received in the month", "fees", [(acc["1030"], total, 0), (acc["4010"], 0, total)], bursar)
    # Money going out.
    spend = [
        ("maintenance", "Repairs to classroom doors and windows", 38500, "5130"), ("utilities", "Electricity and water bills", 64200, "5150"),
        ("supplies", "Chalk, markers and exercise books", 27800, "5110"), ("catering", "Food supplies for the term", 215000, "5100"),
        ("fuel", "Diesel for school buses", 82400, "5140"), ("administration", "Printing and stationery", 21300, "5190"),
        ("maintenance", "Generator service", 148000, "5130"), ("supplies", "Laboratory chemicals", 56000, "5110"),
    ]
    threshold = float(getattr(s.school, "expense_approval_threshold", 100000) or 100000)
    for i, (cat, desc, amount, code) in enumerate(spend):
        when = s.today - timedelta(days=4 + i * 5)
        pending = amount >= threshold and i % 2 == 0
        s.add(Expense(
            school_id=s.sid, category=cat, description=desc, amount=amount, date=when,
            status=ExpenseStatus.PENDING if pending else ExpenseStatus.APPROVED, approved_by=None if pending else (head.id if head else None),
            approved_at=None if pending else _at(when), recorded_by=bursar.id if bursar else None,
        ))
        if not pending:
            _post(s, when, f"EXP-{i + 1:03d}", desc, "manual", [(acc[code], amount, 0), (acc["1010"], 0, amount)], bursar)
    s.flush()
    ctx.ledger = acc


def seed_budgets_and_assets(s: Seeder, ctx: Ctx):
    acc = ctx.ledger
    y = s.today.year
    for code, amount in (("5010", 9_600_000), ("5020", 3_200_000), ("5100", 2_400_000), ("5110", 900_000), ("5130", 800_000), ("5140", 650_000), ("5150", 520_000), ("5190", 300_000)):
        s.add(Budget(school_id=s.sid, account_id=acc[code].id, year=y, amount=amount))
    assets = [
        ("MV-001", "School bus: Isuzu NQR", "1500", date(y - 3, 2, 10), 4_800_000, 800_000, 8), ("MV-002", "Toyota Coaster minibus", "1500", date(y - 2, 6, 3), 6_200_000, 1_000_000, 8),
        ("IT-001", "Computer laboratory: 20 desktops", "1510", date(y - 2, 3, 15), 1_400_000, 100_000, 4), ("IT-002", "Projectors and smart board", "1510", date(y - 1, 8, 20), 460_000, 20_000, 4),
        ("FK-001", "Dining hall tables and benches", "1520", date(y - 3, 1, 12), 520_000, 40_000, 10), ("LB-001", "Science laboratory equipment", "1530", date(y - 2, 9, 9), 780_000, 60_000, 10),
    ]
    for code, name, account, bought, cost, residual, life in assets:
        years = max(0.1, (s.today - bought).days / 365)
        depreciation = round(min(cost - residual, (cost - residual) / life * years), 2)
        s.add(FixedAsset(school_id=s.sid, account_id=acc[account].id, code=code, name=name, acquisition_date=bought, cost=cost, residual_value=residual, useful_life_years=life, accumulated_depreciation=depreciation, status=AssetStatus.ACTIVE))
    s.flush()


def seed_payroll(s: Seeder, ctx: Ctx):
    acc = ctx.ledger
    head = s.db.query(User).filter_by(school_id=s.sid, role=UserRole.HEAD_OF_INSTITUTION).first()
    bursar = (ctx.staff.get(UserRole.BURSAR) or [head])[0]
    people = [(t, EmploymentType.TEACHING, s.rng.choice([52000, 58000, 64000, 72000])) for t, _ in ctx.teachers]
    for role, users in ctx.staff.items():
        for u in users:
            people.append((u, EmploymentType.NON_TEACHING, {UserRole.SECURITY: 24000, UserRole.TRANSPORT_ATTENDANT: 22000}.get(role, 38000)))
    profiles = []
    for u, kind, basic in people:
        profiles.append((u, kind, basic, s.add(PayrollProfile(
            school_id=s.sid, user_id=u.id, employment_type=kind, basic_salary=basic, house_allowance=round(basic * 0.15), transport_allowance=4000,
            kra_pin=f"A{s.rng.randint(100000000, 999999999)}Z", nssf_number=f"{s.rng.randint(10000000, 99999999)}", bank_name=s.rng.choice(["KCB", "Equity", "Co-operative Bank"]),
            bank_account=f"{s.rng.randint(1000000000, 9999999999)}",
        ))))
    s.flush()
    # Last month's pay run, already paid and posted to the ledger.
    last = (s.today.replace(day=1) - timedelta(days=1))
    period = f"{last.year}-{last.month:02d}"
    run = s.add(PayRun(school_id=s.sid, period=period, status=PayRunStatus.PAID, created_by=bursar.id if bursar else None, paid_by=head.id if head else None))
    s.flush()
    teach = non = paye = nssf = shif = ahl = net = 0.0
    for u, kind, basic, prof in profiles:
        house, transport = round(basic * 0.15), 4000
        c = compute_pay(basic, house, transport)
        s.add(PayslipLine(pay_run_id=run.id, school_id=s.sid, user_id=u.id, staff_name=u.full_name, employment_type=kind, basic=basic, house=house, transport=transport,
                          gross=c.gross, nssf=c.nssf, shif=c.shif, ahl=c.ahl, paye=c.paye, net=c.net))
        if kind == EmploymentType.TEACHING:
            teach += c.gross
        else:
            non += c.gross
        paye += c.paye; nssf += c.nssf; shif += c.shif; ahl += c.ahl; net += c.net
    entry = _post(s, last, f"PAY-{period}", f"Payroll for {period}", "payroll", [
        (acc["5010"], teach, 0), (acc["5020"], non, 0), (acc["2100"], 0, paye), (acc["2110"], 0, nssf), (acc["2120"], 0, shif), (acc["2130"], 0, ahl), (acc["1010"], 0, net),
    ], bursar)
    s.flush()
    run.journal_entry_id = entry.id


SUPPLIERS = [
    ("Eldoret Stationers Ltd", "Stationery", "info@eldoretstationers.co.ke"), ("Rift Valley Foods Suppliers", "Food and catering", "orders@riftfoods.co.ke"),
    ("Kapsoya Hardware", "Repairs and maintenance", "sales@kapsoyahardware.co.ke"), ("Uasin Gishu Fuel Depot", "Fuel", "accounts@ugfuel.co.ke"),
    ("Highland Scientific Supplies", "Laboratory", "sales@highlandscience.co.ke"), ("Moi Avenue Uniforms", "Uniforms", "hello@moiuniforms.co.ke"),
]


def seed_procurement(s: Seeder, ctx: Ctx, tag: str):
    acc = ctx.ledger
    officer = (ctx.staff.get(UserRole.PROCUREMENT_OFFICER) or [None])[0]
    head = s.db.query(User).filter_by(school_id=s.sid, role=UserRole.HEAD_OF_INSTITUTION).first()
    suppliers = []
    for i, (name, cat, email) in enumerate(SUPPLIERS):
        suppliers.append(s.add(Supplier(school_id=s.sid, name=name, kra_pin=f"P{s.rng.randint(100000000, 999999999)}K", category=cat, phone=s.phone(), email=email, bank_account=f"{s.rng.randint(100000000, 999999999)}", etims_registered=i % 3 != 0)))
    s.flush()
    reqs = [
        ("Academics", "5110", "Exercise books (200 pages)", 600, 45, RequisitionStatus.APPROVED, 0), ("Kitchen", "5100", "Maize flour 90 kg bags", 20, 3200, RequisitionStatus.APPROVED, 1),
        ("Maintenance", "5130", "Roofing sheets for the games store", 40, 1450, RequisitionStatus.APPROVED, 2), ("Science", "5110", "Test tubes and beakers", 120, 180, RequisitionStatus.SUBMITTED, None),
        ("Administration", "5190", "Printer toner cartridges", 6, 7800, RequisitionStatus.SUBMITTED, None), ("Sports", "5110", "Footballs and netballs", 18, 2400, RequisitionStatus.DECLINED, None),
    ]
    for i, (dept, code, desc, qty, unit, status, sup) in enumerate(reqs, start=1):
        total = qty * unit
        r = s.add(PurchaseRequisition(school_id=s.sid, reference=f"{tag}-PR-{i:03d}", department=dept, account_id=acc[code].id, description=desc, quantity=qty, unit_cost=unit, total=total,
                                      status=status, requested_by=officer.id if officer else None, approved_by=head.id if (head and status != RequisitionStatus.SUBMITTED) else None))
        s.flush()
        if sup is not None:
            s.add(PurchaseOrder(school_id=s.sid, requisition_id=r.id, supplier_id=suppliers[sup].id, reference=f"{tag}-PO-{i:03d}", delivery_date=s.today + timedelta(days=5 + i * 3), total=total,
                                status=PurchaseOrderStatus.RECEIVED if sup == 0 else PurchaseOrderStatus.ISSUED, created_by=officer.id if officer else None))
    s.flush()


STOCK = [
    ("ST-001", "Exercise books (200 pages)", "Stationery", "book", 1200, 400, 45), ("ST-002", "Chalk (box of 100)", "Stationery", "box", 60, 20, 320), ("ST-003", "Whiteboard markers", "Stationery", "pack", 80, 30, 280),
    ("ST-004", "Maize flour 90 kg", "Food", "bag", 14, 8, 3200), ("ST-005", "Rice 50 kg", "Food", "bag", 9, 6, 6800), ("ST-006", "Cooking oil 20 L", "Food", "jerrycan", 5, 4, 5200),
    ("ST-007", "Cleaning detergent 5 L", "Cleaning", "bottle", 18, 10, 650), ("ST-008", "Toilet paper (pack of 10)", "Cleaning", "pack", 40, 15, 380),
    ("ST-009", "Footballs", "Sports", "ball", 12, 6, 2400), ("ST-010", "Chemistry reagents set", "Laboratory", "set", 6, 3, 8500),
    ("ST-011", "Printer paper A4 (ream)", "Stationery", "ream", 90, 30, 690), ("ST-012", "First aid supplies", "Health", "kit", 4, 3, 3200),
]


def seed_stores(s: Seeder, ctx: Ctx, tag: str):
    acc = ctx.ledger
    keeper = (ctx.staff.get(UserRole.STORE_KEEPER) or [None])[0]
    items = []
    for code, name, cat, unit, qty, reorder, cost in STOCK:
        items.append(s.add(StockItem(school_id=s.sid, account_id=acc["1200"].id, code=code, name=name, category=cat, unit=unit, quantity=qty, reorder_level=reorder, unit_cost=cost)))
    s.flush()
    for it in items:
        s.add(StockMovement(school_id=s.sid, item_id=it.id, type=StockMovementType.RECEIPT, quantity=it.quantity + 20, note="Opening stock", recorded_by=keeper.id if keeper else None))
        s.add(StockMovement(school_id=s.sid, item_id=it.id, type=StockMovementType.ISSUE, quantity=20, department=s.rng.choice(["Academics", "Kitchen", "Sports", "Administration"]), note="Issued during the term", recorded_by=keeper.id if keeper else None))
    teacher = ctx.teachers[0][0]
    for i, (dept, status, lines) in enumerate([("Grade 4", "requested", [(0, 120), (1, 4)]), ("Kitchen", "issued", [(3, 5), (5, 2)]), ("Sports", "declined", [(8, 30)])], start=1):
        req = s.add(StoreRequest(school_id=s.sid, reference=f"{tag}-SR-{i:03d}", department=dept, note="Needed this week", status=status, requested_by=teacher.id,
                                 decided_by=keeper.id if (keeper and status != "requested") else None, decision_note="Not enough stock" if status == "declined" else None))
        s.flush()
        for idx, qty in lines:
            s.add(StoreRequestLine(request_id=req.id, item_id=items[idx].id, quantity_requested=qty, quantity_issued=qty if status == "issued" else 0))
    s.flush()
