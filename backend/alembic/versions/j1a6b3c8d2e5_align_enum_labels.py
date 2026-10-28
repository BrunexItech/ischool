"""align_enum_labels

Some databases were built when an enum's labels were written in lower case, while the application writes them by
name (CLASS_TEACHER). Any such label is renamed in place, so existing rows keep their meaning, and any label that is
simply missing is added. Safe to run on a database that is already aligned: it then does nothing.

Revision ID: j1a6b3c8d2e5
Revises: i9f5a2d7b1e4
Create Date: 2026-11-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'j1a6b3c8d2e5'
down_revision: Union[str, None] = 'i9f5a2d7b1e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    import importlib
    import pkgutil

    import app.models as models_pkg
    from app.core.database import Base

    for module in pkgutil.iter_modules(models_pkg.__path__):   # every model, so every enum is known
        importlib.import_module(f"app.models.{module.name}")

    conn = op.get_bind()
    wanted: dict[str, list[str]] = {}
    for table in Base.metadata.tables.values():
        for col in table.columns:
            if isinstance(col.type, sa.Enum) and col.type.name:
                wanted[col.type.name] = list(col.type.enums)

    missing_by_type: dict[str, list[str]] = {}
    for typ, labels in wanted.items():
        rows = conn.execute(
            sa.text("SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = :n"), {"n": typ}
        ).fetchall()
        have = [r[0] for r in rows]
        if not have:
            continue   # this database has no such type
        for label in labels:
            if label in have:
                continue
            twin = next((h for h in have if h.lower() == label.lower() and h not in labels), None)
            if twin is not None:
                conn.execute(sa.text(f'ALTER TYPE "{typ}" RENAME VALUE \'{twin}\' TO \'{label}\''))
                have[have.index(twin)] = label
        left = [l for l in labels if l not in have]
        if left:
            missing_by_type[typ] = left

    if missing_by_type:
        with op.get_context().autocommit_block():
            for typ, labels in missing_by_type.items():
                for label in labels:
                    op.execute(f'ALTER TYPE "{typ}" ADD VALUE IF NOT EXISTS \'{label}\'')


def downgrade() -> None:
    pass
