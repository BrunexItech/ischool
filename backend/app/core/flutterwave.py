import httpx

from app.core.crypto import decrypt_secret
from app.models.payment_config import SchoolPaymentConfig

FLW_BASE = "https://api.flutterwave.com/v3"


class FlutterwaveError(Exception):
    pass


def create_payment_link(
    config: SchoolPaymentConfig,
    *,
    tx_ref: str,
    amount: float,
    currency: str,
    redirect_url: str,
    customer_email: str,
    customer_name: str,
    description: str,
) -> str:
    """Creates a hosted checkout page — the payer enters their card details
    on Flutterwave's own page, never ours, so we never touch raw card data."""
    secret_key = decrypt_secret(config.flutterwave_secret_key_encrypted)

    try:
        response = httpx.post(
            f"{FLW_BASE}/payments",
            json={
                "tx_ref": tx_ref,
                "amount": amount,
                "currency": currency,
                "redirect_url": redirect_url,
                "customer": {"email": customer_email, "name": customer_name},
                "customizations": {"title": description},
            },
            headers={"Authorization": f"Bearer {secret_key}"},
            timeout=20,
        )
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise FlutterwaveError(f"Flutterwave rejected the request: {exc.response.text}") from exc
    except httpx.HTTPError as exc:
        raise FlutterwaveError(f"Failed to reach Flutterwave: {exc}") from exc

    data = response.json()
    if data.get("status") != "success":
        raise FlutterwaveError(data.get("message", "Failed to create a Flutterwave payment link"))
    return data["data"]["link"]


def verify_transaction(config: SchoolPaymentConfig, flutterwave_transaction_id: str) -> dict:
    secret_key = decrypt_secret(config.flutterwave_secret_key_encrypted)
    try:
        response = httpx.get(
            f"{FLW_BASE}/transactions/{flutterwave_transaction_id}/verify",
            headers={"Authorization": f"Bearer {secret_key}"},
            timeout=15,
        )
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise FlutterwaveError(f"Flutterwave rejected the verify request: {exc.response.text}") from exc
    except httpx.HTTPError as exc:
        raise FlutterwaveError(f"Failed to reach Flutterwave: {exc}") from exc

    return response.json()
