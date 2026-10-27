"""Every link a role sees in its sidebar must open for that role. The sidebar list is read from the frontend
file itself, so a role added there but left out on the server is caught here."""

import re
from pathlib import Path

import pytest

from app.models.user import UserRole
from tests.conftest import _login, _make_user, auth_headers

SIDEBAR = Path(__file__).resolve().parents[2] / "frontend" / "src" / "components" / "AppSidebar.tsx"

# The first thing each page asks the server for, by sidebar module.
FIRST_CALL = {
    "announcements": "/announcements",
    "calendar": "/calendar-events",
    "staff-attendance": "/staff-attendance/mine",
    "stores": "/stores/requests",
    "library": "/library/books",
    "finance": "/finance/summary",
    "ledger": "/ledger/accounts",
    "procurement": "/purchase-orders",
    "suppliers": "/suppliers",
    "security": "/security/visitors",
    "boarding": "/boarding/houses",
    "transport": "/transport/vehicles",
    "trips": "/trips",
    "meals": "/meals/weekly",
    "complaints": "/complaints",
}
# A role with no entry in FIRST_CALL for a module is not checked, so only list what the page really asks for.
EXTRA = {("fees", "bursar"): "/fees/balances", ("fees", "accountant"): "/fees/balances", ("analytics", "bursar"): "/analytics/insights?term=Term%201"}


def _sidebar() -> list[tuple[str, list[str]]]:
    text = SIDEBAR.read_text()
    block = text[text.index("const NAV_SECTIONS"): text.index("const G = ")]
    out = []
    for m in re.finditer(r'href: "/dashboard/([a-z-]+)", label: "[^"]+", icon: \w+, roles: \[([^\]]*)\]', block):
        out.append((m.group(1), re.findall(r'"([a-z_]+)"', m.group(2))))
    return out


def test_every_sidebar_link_opens_for_the_role_that_sees_it(client, db_session, school):
    users: dict[str, tuple] = {}
    failures = []
    for module, roles in _sidebar():
        for role in roles:
            if role in ("super_admin", "group_principal", "parent", "student"):
                continue
            path = EXTRA.get((module, role)) or FIRST_CALL.get(module)
            if path is None:
                continue
            if role not in users:
                user, pw = _make_user(db_session, school, UserRole(role), f"sweep.{role}@test-academy.test")
                users[role] = (user, pw)
            user, pw = users[role]
            r = client.get(f"/schools/{school.id}{path}", headers=auth_headers(_login(client, user.email, pw)))
            if r.status_code in (401, 403):
                failures.append(f"{role} cannot open {module} ({path}): {r.status_code}")
    assert not failures, "\n".join(failures)
