import httpx

from app.core.crypto import decrypt_secret
from app.models.payment_config import SchoolPaymentConfig

SANDBOX_BASE = "https://cybqa.pesapal.com/pesapalv3/api"
PRODUCTION_BASE = "https://pay.pesapal.com/v3/api"


class PesapalError(Exception):
    pass


def _base_url(config: SchoolPaymentConfig) -> str:
    return PRODUCTION_BASE if config.pesapal_env == "production" else SANDBOX_BASE


def get_access_token(config: SchoolPaymentConfig) -> str:
    """Bearer token from this school's own Pesapal merchant credentials."""
    consumer_secret = decrypt_secret(config.pesapal_consumer_secret_encrypted)
    try:
        response = httpx.post(
            f"{_base_url(config)}/Auth/RequestToken",
            json={"consumer_key": config.pesapal_consumer_key, "consumer_secret": consumer_secret},
            headers={"Accept": "application/json", "Content-Type": "application/json"},
            timeout=15,
        )
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise PesapalError(f"Pesapal rejected the auth request: {exc.response.text}") from exc
    except httpx.HTTPError as exc:
        raise PesapalError(f"Failed to reach Pesapal: {exc}") from exc

    data = response.json()
    if data.get("error") or "token" not in data:
        raise PesapalError(data.get("error", {}).get("message") if isinstance(data.get("error"), dict) else "Pesapal authentication failed")
    return data["token"]


def register_ipn(config: SchoolPaymentConfig, notification_url: str) -> str:
    """Registers our callback URL with Pesapal and returns the notification
    (IPN) id required on every order — a one-time step done when a school
    saves its Pesapal credentials."""
    token = get_access_token(config)
    try:
        response = httpx.post(
            f"{_base_url(config)}/URLSetup/RegisterIPN",
            json={"url": notification_url, "ipn_notification_type": "GET"},
            headers={"Authorization": f"Bearer {token}", "Accept": "application/json", "Content-Type": "application/json"},
            timeout=15,
        )
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise PesapalError(f"Pesapal rejected the IPN registration: {exc.response.text}") from exc
    except httpx.HTTPError as exc:
        raise PesapalError(f"Failed to reach Pesapal: {exc}") from exc

    data = response.json()
    if not data.get("ipn_id"):
        raise PesapalError(data.get("error", {}).get("message", "Pesapal did not return an IPN id"))
    return data["ipn_id"]


def submit_order(
    config: SchoolPaymentConfig,
    *,
    merchant_reference: str,
    amount: float,
    currency: str,
    description: str,
    callback_url: str,
    customer_email: str,
    customer_name: str,
) -> dict:
    """Creates a hosted checkout order — the payer enters card or mobile
    money details on Pesapal's own page, never ours."""
    token = get_access_token(config)
    first_name, _, last_name = customer_name.partition(" ")

    try:
        response = httpx.post(
            f"{_base_url(config)}/Transactions/SubmitOrderRequest",
            json={
                "id": merchant_reference,
                "currency": currency,
                "amount": amount,
                "description": description[:100],
                "callback_url": callback_url,
                "notification_id": config.pesapal_ipn_id,
                "billing_address": {
                    "email_address": customer_email,
                    "first_name": first_name or customer_name,
                    "last_name": last_name or "",
                },
            },
            headers={"Authorization": f"Bearer {token}", "Accept": "application/json", "Content-Type": "application/json"},
            timeout=20,
        )
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise PesapalError(f"Pesapal rejected the order: {exc.response.text}") from exc
    except httpx.HTTPError as exc:
        raise PesapalError(f"Failed to reach Pesapal: {exc}") from exc

    data = response.json()
    if data.get("error") or not data.get("redirect_url"):
        message = data.get("error", {}).get("message") if isinstance(data.get("error"), dict) else "Pesapal did not return a checkout link"
        raise PesapalError(message)
    return data


def get_transaction_status(config: SchoolPaymentConfig, order_tracking_id: str) -> dict:
    """Polls the outcome of a previously submitted order — the primary
    verification path since Pesapal's own IPN callback needs a publicly
    reachable URL that this backend may not have in every environment."""
    token = get_access_token(config)
    try:
        response = httpx.get(
            f"{_base_url(config)}/Transactions/GetTransactionStatus",
            params={"orderTrackingId": order_tracking_id},
            headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
            timeout=15,
        )
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise PesapalError(f"Pesapal rejected the status query: {exc.response.text}") from exc
    except httpx.HTTPError as exc:
        raise PesapalError(f"Failed to reach Pesapal: {exc}") from exc

    return response.json()
