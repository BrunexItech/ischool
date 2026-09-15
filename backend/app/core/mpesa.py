import base64
from datetime import datetime

import httpx

from app.core.crypto import decrypt_secret
from app.models.payment_config import SchoolPaymentConfig

SANDBOX_BASE = "https://sandbox.safaricom.co.ke"
PRODUCTION_BASE = "https://api.safaricom.co.ke"


class MpesaError(Exception):
    pass


def _base_url(config: SchoolPaymentConfig) -> str:
    return PRODUCTION_BASE if config.mpesa_env == "production" else SANDBOX_BASE


def _password(config: SchoolPaymentConfig, passkey: str, timestamp: str) -> str:
    raw = f"{config.mpesa_shortcode}{passkey}{timestamp}"
    return base64.b64encode(raw.encode()).decode()


def get_access_token(config: SchoolPaymentConfig) -> str:
    """OAuth token from Safaricom, using this school's own app credentials."""
    consumer_secret = decrypt_secret(config.mpesa_consumer_secret_encrypted)
    try:
        response = httpx.get(
            f"{_base_url(config)}/oauth/v1/generate",
            params={"grant_type": "client_credentials"},
            auth=(config.mpesa_consumer_key, consumer_secret),
            timeout=15,
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise MpesaError(f"Failed to authenticate with Safaricom: {exc}") from exc

    data = response.json()
    if "access_token" not in data:
        raise MpesaError(f"Unexpected Safaricom auth response: {data}")
    return data["access_token"]


def initiate_stk_push(
    config: SchoolPaymentConfig,
    *,
    phone_number: str,
    amount: float,
    account_reference: str,
    description: str,
    callback_url: str,
) -> dict:
    """Triggers the "enter your M-Pesa PIN" prompt on the payer's phone.
    Returns Safaricom's response including CheckoutRequestID, used to poll
    status afterward."""
    token = get_access_token(config)
    passkey = decrypt_secret(config.mpesa_passkey_encrypted)
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")

    payload = {
        "BusinessShortCode": config.mpesa_shortcode,
        "Password": _password(config, passkey, timestamp),
        "Timestamp": timestamp,
        "TransactionType": "CustomerPayBillOnline",
        "Amount": int(round(amount)),
        "PartyA": phone_number,
        "PartyB": config.mpesa_shortcode,
        "PhoneNumber": phone_number,
        "CallBackURL": callback_url,
        "AccountReference": account_reference[:12],
        "TransactionDesc": description[:13],
    }

    try:
        response = httpx.post(
            f"{_base_url(config)}/mpesa/stkpush/v1/processrequest",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise MpesaError(f"Safaricom rejected the STK push request: {exc.response.text}") from exc
    except httpx.HTTPError as exc:
        raise MpesaError(f"Failed to reach Safaricom: {exc}") from exc

    data = response.json()
    if data.get("ResponseCode") != "0":
        raise MpesaError(data.get("ResponseDescription", "STK push was not accepted"))
    return data


def query_stk_status(config: SchoolPaymentConfig, checkout_request_id: str) -> dict:
    """Polls the result of a previously initiated STK push — lets the UI
    show a live status without depending on Safaricom's callback reaching us,
    which needs a publicly reachable URL."""
    token = get_access_token(config)
    passkey = decrypt_secret(config.mpesa_passkey_encrypted)
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")

    payload = {
        "BusinessShortCode": config.mpesa_shortcode,
        "Password": _password(config, passkey, timestamp),
        "Timestamp": timestamp,
        "CheckoutRequestID": checkout_request_id,
    }

    try:
        response = httpx.post(
            f"{_base_url(config)}/mpesa/stkpushquery/v1/query",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise MpesaError(f"Safaricom rejected the status query: {exc.response.text}") from exc
    except httpx.HTTPError as exc:
        raise MpesaError(f"Failed to reach Safaricom: {exc}") from exc

    return response.json()
