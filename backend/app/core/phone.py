import re

from fastapi import HTTPException, status


def normalize_kenyan_phone(phone: str) -> str:
    """Accepts 07XXXXXXXX, 01XXXXXXXX, 2547XXXXXXXX, or +254... and returns
    the 254-prefixed form every provider we integrate with (Daraja,
    MobileSasa) accepts."""
    digits = re.sub(r"\D", "", phone)
    if digits.startswith("0") and len(digits) == 10:
        return "254" + digits[1:]
    if digits.startswith("254"):
        return digits
    if digits.startswith("7") or digits.startswith("1"):
        return "254" + digits
    raise HTTPException(status.HTTP_400_BAD_REQUEST, "Enter a valid Kenyan phone number, e.g. 0712345678")
