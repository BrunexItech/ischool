import httpx

from app.core.crypto import decrypt_secret
from app.models.communication_config import SchoolCommunicationConfig

BASE_URL = "https://api.mobilesasa.com/v1"


class MobileSasaError(Exception):
    pass


def _headers(config: SchoolCommunicationConfig) -> dict:
    token = decrypt_secret(config.mobilesasa_api_token_encrypted)
    return {"Authorization": f"Bearer {token}", "Accept": "application/json", "Content-Type": "application/json"}


def _call(method: str, path: str, config: SchoolCommunicationConfig, **kwargs) -> dict:
    try:
        response = httpx.request(method, f"{BASE_URL}{path}", headers=_headers(config), timeout=20, **kwargs)
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise MobileSasaError(f"MobileSasa rejected the request: {exc.response.text}") from exc
    except httpx.HTTPError as exc:
        raise MobileSasaError(f"Failed to reach MobileSasa: {exc}") from exc

    data = response.json()
    if not data.get("status"):
        raise MobileSasaError(data.get("message", "MobileSasa reported a failure"))
    return data


def get_balance(config: SchoolCommunicationConfig) -> int:
    """Doubles as a credentials check — called when a school saves its
    MobileSasa token, the same way Pesapal's IPN registration validates
    credentials on save."""
    data = _call("GET", "/get-balance/", config)
    return data["balance"]


def send_sms(config: SchoolCommunicationConfig, *, phone: str, message: str) -> str:
    """Returns MobileSasa's messageId."""
    data = _call(
        "POST", "/send/message", config,
        json={"senderID": config.mobilesasa_sender_id, "phone": phone, "message": message},
    )
    return data["messageId"]


def send_bulk_sms(config: SchoolCommunicationConfig, *, phones: list[str], message: str) -> str:
    """Returns MobileSasa's bulkId. phones may be at most a few thousand —
    MobileSasa takes one comma-separated string, not an array."""
    data = _call(
        "POST", "/send/bulk", config,
        json={"senderID": config.mobilesasa_sender_id, "phones": ",".join(phones), "message": message},
    )
    return data["bulkId"]
