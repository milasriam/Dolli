import hashlib
import logging
import os
import random
import time
from dataclasses import dataclass
from typing import Any, Optional

import httpx
from core.config import settings

logger = logging.getLogger(__name__)


class PaymentProviderError(RuntimeError):
    pass


@dataclass
class CheckoutIntent:
    provider: str
    action: str
    invoice_id: str
    status: str
    url: Optional[str] = None
    message: Optional[str] = None
    payment_payload: Optional[dict[str, Any]] = None
    provider_reference: Optional[str] = None


@dataclass
class VerificationResult:
    provider: str
    invoice_id: str
    status: str
    payment_status: str
    provider_reference: Optional[str] = None
    raw: Optional[dict[str, Any]] = None


def _env(name: str, default: str = "") -> str:
    return str(getattr(settings, name.lower(), os.environ.get(name, default)) or default)


def _build_invoice_id() -> str:
    timestamp = int(time.time() * 1000)
    suffix = random.randint(100, 999)
    return f"{timestamp}{suffix}"[-15:]


def _build_secret_hash(invoice_id: str, donation_id: int) -> str:
    secret_seed = f"{invoice_id}:{donation_id}:{_env('JWT_SECRET_KEY', 'dolli-dev-secret')}"
    return hashlib.sha256(secret_seed.encode("utf-8")).hexdigest()


def _frontend_base_url(request) -> str:
    configured = _env("FRONTEND_URL")
    if configured:
        return configured.rstrip("/")

    origin = request.headers.get("origin")
    if origin:
        return origin.rstrip("/")

    app_host = request.headers.get("App-Host") or request.headers.get("host")
    if app_host:
        if app_host.startswith(("http://", "https://")):
            return app_host.rstrip("/")
        return f"http://{app_host}".rstrip("/")

    return "http://127.0.0.1:3000"


def _backend_base_url(request) -> str:
    configured = _env("BACKEND_PUBLIC_URL")
    if configured:
        return configured.rstrip("/")

    host = request.headers.get("host")
    scheme = request.headers.get("x-forwarded-proto", request.url.scheme)
    if host:
        return f"{scheme}://{host}".rstrip("/")

    return "http://127.0.0.1:8000"


def kaspi_checkout_link() -> str:
    return _env("KASPI_PAY_REMOTE_LINK")


async def create_halyk_checkout(
    request,
    donation_id: int,
    campaign_id: int,
    campaign_title: str,
    amount: float,
    customer_email: str,
) -> CheckoutIntent:
    client_id = _env("HALYK_EPAY_CLIENT_ID")
    client_secret = _env("HALYK_EPAY_CLIENT_SECRET")
    terminal_id = _env("HALYK_EPAY_TERMINAL_ID")

    if not client_id or not client_secret or not terminal_id:
        raise PaymentProviderError(
            "Halyk EPAY is not configured. Set HALYK_EPAY_CLIENT_ID, HALYK_EPAY_CLIENT_SECRET, and HALYK_EPAY_TERMINAL_ID."
        )

    invoice_id = _build_invoice_id()
    currency = _env("HALYK_EPAY_CURRENCY", "KZT")
    frontend_url = _frontend_base_url(request)
    backend_url = _backend_base_url(request)
    success_url = (
        f"{frontend_url}/donation-success?provider=halyk_epay&invoice_id={invoice_id}&campaign_id={campaign_id}"
    )
    failure_url = (
        f"{frontend_url}/donation-success?provider=halyk_epay&invoice_id={invoice_id}&campaign_id={campaign_id}&status=failed"
    )
    post_link = f"{backend_url}/api/v1/payment/providers/halyk/callback"
    secret_hash = _build_secret_hash(invoice_id, donation_id)

    oauth_url = _env("HALYK_EPAY_OAUTH_URL", "https://test-epay.homebank.kz/oauth2/token")
    script_url = _env("HALYK_EPAY_SCRIPT_URL", "https://test-epay.homebank.kz/payform/payment-api.js")

    form_data = {
        "grant_type": "client_credentials",
        "scope": "payment",
        "client_id": client_id,
        "client_secret": client_secret,
        "invoiceID": invoice_id,
        "amount": f"{amount:.2f}",
        "currency": currency,
        "terminal": terminal_id,
        "postLink": post_link,
        "failurePostLink": post_link,
        "postLinkMobile": post_link,
        "failurePostLinkMobile": post_link,
        "backLink": success_url,
        "failureBackLink": failure_url,
        "description": f"Dolli donation for {campaign_title}",
        "accountId": str(donation_id),
        "phone": "",
        "email": customer_email or "",
        "language": "rus",
        "cardSave": "false",
        "secret_hash": secret_hash,
    }

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            oauth_url,
            data=form_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

    if response.status_code >= 400:
        logger.error("Halyk EPAY oauth request failed: %s %s", response.status_code, response.text)
        raise PaymentProviderError("Halyk EPAY rejected the checkout initialization request.")

    payload = response.json()
    auth_token = payload.get("access_token")
    if not auth_token:
        logger.error("Halyk EPAY oauth response missing access_token: %s", payload)
        raise PaymentProviderError("Halyk EPAY did not return an access token.")

    payment_object = {
        "invoiceId": invoice_id,
        "backLink": success_url,
        "failureBackLink": failure_url,
        "postLink": post_link,
        "language": "rus",
        "description": f"Dolli donation for {campaign_title}",
        "accountId": str(donation_id),
        "terminal": terminal_id,
        "amount": amount,
        "currency": currency,
        "auth": auth_token,
    }

    return CheckoutIntent(
        provider="halyk_epay",
        action="halyk_form",
        invoice_id=invoice_id,
        status="pending",
        provider_reference=auth_token,
        payment_payload={"script_url": script_url, "payment_object": payment_object},
    )


async def verify_halyk_payment(invoice_id: str) -> VerificationResult:
    client_id = _env("HALYK_EPAY_CLIENT_ID")
    client_secret = _env("HALYK_EPAY_CLIENT_SECRET")
    terminal_id = _env("HALYK_EPAY_TERMINAL_ID")

    if not client_id or not client_secret or not terminal_id:
        raise PaymentProviderError("Halyk EPAY is not configured for payment verification.")

    token_url = _env("HALYK_EPAY_STATUS_TOKEN_URL", "https://test-epay.homebank.kz/oauth2/token")
    status_url = _env("HALYK_EPAY_STATUS_URL", "https://test-epay.homebank.kz/operation-api/api/transactions/status")

    token_form = {
        "grant_type": "client_credentials",
        "scope": "webapi",
        "client_id": client_id,
        "client_secret": client_secret,
        "terminal": terminal_id,
    }

    async with httpx.AsyncClient(timeout=20) as client:
        token_response = await client.post(
            token_url,
            data=token_form,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if token_response.status_code >= 400:
            logger.error("Halyk EPAY status token request failed: %s %s", token_response.status_code, token_response.text)
            raise PaymentProviderError("Failed to authenticate with Halyk EPAY status API.")

        token_payload = token_response.json()
        access_token = token_payload.get("access_token")
        if not access_token:
            raise PaymentProviderError("Halyk EPAY status API did not return an access token.")

        status_response = await client.post(
            status_url,
            json={"invoiceId": invoice_id, "terminal": terminal_id},
            headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
        )

    if status_response.status_code >= 400:
        logger.error("Halyk EPAY status request failed: %s %s", status_response.status_code, status_response.text)
        raise PaymentProviderError("Halyk EPAY status API rejected the verification request.")

    payload = status_response.json()
    result_code = str(payload.get("resultCode", "")).strip()
    reason_code = str(payload.get("reasonCode", "")).strip()
    reference = payload.get("reference") or payload.get("id")
    status_name = str(payload.get("statusName", "")).upper()

    if result_code == "100" and reason_code in ("", "00"):
        status = "paid"
        payment_status = "paid"
    elif result_code in {"107", "200", "201"} or status_name in {"NEW", "AUTH", "IN_PROGRESS", "PENDING"}:
        status = "pending"
        payment_status = "pending"
    else:
        status = "failed"
        payment_status = "failed"

    return VerificationResult(
        provider="halyk_epay",
        invoice_id=invoice_id,
        status=status,
        payment_status=payment_status,
        provider_reference=str(reference) if reference else None,
        raw=payload if isinstance(payload, dict) else None,
    )


def create_kaspi_checkout(campaign_id: int) -> CheckoutIntent:
    remote_link = kaspi_checkout_link()
    if not remote_link:
        raise PaymentProviderError("Kaspi Pay is not configured. Set KASPI_PAY_REMOTE_LINK.")

    invoice_id = _build_invoice_id()
    url = f"{remote_link}"
    message = (
        "Kaspi Pay checkout opens as a remote payment link. The merchant account must be configured to accept the amount on the Kaspi side."
    )
    return CheckoutIntent(
        provider="kaspi_pay",
        action="redirect",
        invoice_id=invoice_id,
        status="pending",
        url=url,
        message=message,
        provider_reference=f"kaspi:{campaign_id}:{invoice_id}",
    )
