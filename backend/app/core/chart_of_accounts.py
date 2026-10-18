"""The default chart of accounts every school gets — seeded once at
onboarding (see schools.py) and backfilled for existing schools in the
erp_finance migration. Codes and groupings follow standard Kenyan school
accounting practice."""

from sqlalchemy.orm import Session

from app.models.ledger import Account, AccountType

CHART_OF_ACCOUNTS: list[tuple[str, str, AccountType]] = [
    ("1010", "KCB fees collection account", AccountType.ASSET),
    ("1020", "Equity operations account", AccountType.ASSET),
    ("1030", "M-Pesa Paybill collection", AccountType.ASSET),
    ("1040", "Petty cash", AccountType.ASSET),
    ("1100", "Fees receivable", AccountType.ASSET),
    ("1200", "Inventory: stores", AccountType.ASSET),
    ("1500", "Motor vehicles", AccountType.ASSET),
    ("1510", "Computers and ICT equipment", AccountType.ASSET),
    ("1520", "Furniture and kitchen equipment", AccountType.ASSET),
    ("1530", "Laboratory equipment", AccountType.ASSET),
    ("1540", "Buildings", AccountType.ASSET),
    ("1590", "Accumulated depreciation", AccountType.ASSET),
    ("2010", "Accounts payable", AccountType.LIABILITY),
    ("2100", "PAYE payable", AccountType.LIABILITY),
    ("2110", "NSSF payable", AccountType.LIABILITY),
    ("2120", "SHIF payable", AccountType.LIABILITY),
    ("2130", "Housing levy payable", AccountType.LIABILITY),
    ("3000", "Accumulated fund", AccountType.EQUITY),
    ("4010", "Tuition fees", AccountType.INCOME),
    ("4020", "Boarding fees", AccountType.INCOME),
    ("4030", "Transport fees", AccountType.INCOME),
    ("4040", "Trips and activity fees", AccountType.INCOME),
    ("4100", "Other income", AccountType.INCOME),
    ("5010", "Teaching staff salaries", AccountType.EXPENSE),
    ("5020", "Non-teaching staff salaries", AccountType.EXPENSE),
    ("5030", "Employer statutory costs", AccountType.EXPENSE),
    ("5100", "Food and catering", AccountType.EXPENSE),
    ("5110", "Teaching and learning materials", AccountType.EXPENSE),
    ("5130", "Repairs and maintenance", AccountType.EXPENSE),
    ("5140", "Fuel and transport running", AccountType.EXPENSE),
    ("5150", "Electricity, water and conservancy", AccountType.EXPENSE),
    ("5190", "Administration and stationery", AccountType.EXPENSE),
    ("5200", "Depreciation", AccountType.EXPENSE),
]


def seed_chart_of_accounts(db: Session, school_id: int) -> None:
    existing = {code for (code,) in db.query(Account.code).filter_by(school_id=school_id).all()}
    for code, name, type_ in CHART_OF_ACCOUNTS:
        if code not in existing:
            db.add(Account(school_id=school_id, code=code, name=name, type=type_))
