from datetime import date, datetime

from pydantic import BaseModel, Field, model_validator

from app.models.ledger import AccountType


class AccountOut(BaseModel):
    id: int
    code: str
    name: str
    type: AccountType
    balance: float = 0

    model_config = {"from_attributes": True}


class JournalLineIn(BaseModel):
    account_id: int
    debit: float = Field(default=0, ge=0)
    credit: float = Field(default=0, ge=0)

    @model_validator(mode="after")
    def exactly_one_side(self):
        if (self.debit > 0) == (self.credit > 0):
            raise ValueError("Each line must have either a debit or a credit, not both or neither")
        return self


class JournalEntryCreate(BaseModel):
    entry_date: date
    reference: str
    memo: str = Field(min_length=3)
    lines: list[JournalLineIn] = Field(min_length=2)

    @model_validator(mode="after")
    def balanced(self):
        total_debit = sum(line.debit for line in self.lines)
        total_credit = sum(line.credit for line in self.lines)
        if round(total_debit, 2) != round(total_credit, 2):
            raise ValueError(f"Entry does not balance: debits {total_debit} vs credits {total_credit}")
        return self


class JournalLineOut(BaseModel):
    id: int
    account_id: int
    account_code: str
    account_name: str
    debit: float
    credit: float

    model_config = {"from_attributes": True}


class JournalEntryOut(BaseModel):
    id: int
    entry_date: date
    reference: str
    memo: str
    source: str
    created_at: datetime
    lines: list[JournalLineOut]

    model_config = {"from_attributes": True}


class TrialBalanceRow(BaseModel):
    account_code: str
    account_name: str
    type: AccountType
    debit: float
    credit: float


class IncomeStatementOut(BaseModel):
    income_total: float
    expense_total: float
    surplus: float
    income_lines: list[TrialBalanceRow]
    expense_lines: list[TrialBalanceRow]


class BalanceSheetOut(BaseModel):
    assets_total: float
    liabilities_total: float
    equity_total: float
    period_surplus: float
    asset_lines: list[TrialBalanceRow]
    liability_lines: list[TrialBalanceRow]
    equity_lines: list[TrialBalanceRow]
