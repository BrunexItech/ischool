"""Kenya statutory payroll deductions, effective February 2026 — the same
bands and rates Milai Group of Schools' prototype uses. Pure functions, no DB access, so
they're trivial to unit test and to reuse from the pay-run endpoint."""

from dataclasses import dataclass

PAYE_BANDS = [(24000, 0.10), (8333, 0.25), (467667, 0.30), (300000, 0.325), (float("inf"), 0.35)]
RELIEF = 2400
NSSF_RATE = 0.06
NSSF_UPPER_LIMIT = 108000
SHIF_RATE = 0.0275
SHIF_MIN = 300
AHL_RATE = 0.015


@dataclass
class PayComputation:
    gross: float
    nssf: float
    shif: float
    ahl: float
    taxable: float
    paye: float
    net: float


def compute_pay(basic: float, house: float, transport: float) -> PayComputation:
    gross = basic + house + transport
    nssf = round(min(gross, NSSF_UPPER_LIMIT) * NSSF_RATE)
    shif = max(SHIF_MIN, round(gross * SHIF_RATE))
    ahl = round(gross * AHL_RATE)

    taxable = gross - nssf - shif - ahl
    tax = 0.0
    remaining = taxable
    for band, rate in PAYE_BANDS:
        amount = min(remaining, band)
        if amount <= 0:
            break
        tax += amount * rate
        remaining -= amount

    paye = max(0, round(tax - RELIEF))
    net = gross - nssf - shif - ahl - paye
    return PayComputation(gross=gross, nssf=nssf, shif=shif, ahl=ahl, taxable=taxable, paye=paye, net=net)
