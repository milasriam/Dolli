"""Optional SMTP notifications (donation receipt, magic link, password reset).

Primary relay: SMTP_HOST / SMTP_* (e.g. Resend).
Optional fallback: SMTP_FALLBACK_* (e.g. Brevo) — used only when the primary fails with
errors that look like rate limits, quotas, or transient SMTP policy (see _should_try_fallback).

Set SMTP_FALLBACK_ON_ANY_PRIMARY_ERROR=1 to try fallback after any primary failure (debug / aggressive).
"""

from __future__ import annotations

import asyncio
import logging
import os
import smtplib
import ssl
from dataclasses import dataclass
from email.message import EmailMessage
from typing import Optional

logger = logging.getLogger(__name__)


def smtp_delivery_configured() -> bool:
    """True if at least one outbound SMTP relay is configured (primary or fallback)."""
    return bool((os.environ.get("SMTP_HOST") or "").strip() or (os.environ.get("SMTP_FALLBACK_HOST") or "").strip())


@dataclass(frozen=True)
class _SmtpProfile:
    label: str
    host: str
    port: int
    user: str
    password: str
    from_addr: str
    use_tls: bool


def _bool_env(name: str, default: bool = True) -> bool:
    raw = (os.environ.get(name) or "").strip().lower()
    if not raw:
        return default
    return raw not in ("0", "false", "no")


def _primary_profile() -> Optional[_SmtpProfile]:
    host = (os.environ.get("SMTP_HOST") or "").strip()
    if not host:
        return None
    port = int(os.environ.get("SMTP_PORT", "587"))
    user = (os.environ.get("SMTP_USER") or "").strip()
    password = (os.environ.get("SMTP_PASSWORD") or "").strip()
    from_addr = (os.environ.get("SMTP_FROM") or user or "no-reply@dolli.space").strip()
    return _SmtpProfile(
        label="primary",
        host=host,
        port=port,
        user=user,
        password=password,
        from_addr=from_addr,
        use_tls=_bool_env("SMTP_USE_TLS", True),
    )


def _fallback_profile() -> Optional[_SmtpProfile]:
    host = (os.environ.get("SMTP_FALLBACK_HOST") or "").strip()
    if not host:
        return None
    port = int(os.environ.get("SMTP_FALLBACK_PORT", "587"))
    user = (os.environ.get("SMTP_FALLBACK_USER") or "").strip()
    password = (os.environ.get("SMTP_FALLBACK_PASSWORD") or "").strip()
    primary_from = (os.environ.get("SMTP_FROM") or "").strip()
    from_addr = (
        (os.environ.get("SMTP_FALLBACK_FROM") or "").strip()
        or primary_from
        or user
        or "no-reply@dolli.space"
    ).strip()
    return _SmtpProfile(
        label="fallback",
        host=host,
        port=port,
        user=user,
        password=password,
        from_addr=from_addr,
        use_tls=_bool_env("SMTP_FALLBACK_USE_TLS", True),
    )


def _should_try_fallback(exc: BaseException) -> bool:
    """Heuristic: primary likely hit rate/quota or a transient SMTP condition."""
    if os.environ.get("SMTP_FALLBACK_ON_ANY_PRIMARY_ERROR", "").lower() in ("1", "true", "yes"):
        return True
    if isinstance(exc, smtplib.SMTPRecipientsRefused):
        return False
    if isinstance(exc, smtplib.SMTPDataError):
        return True
    msg = str(exc).lower()
    needles = (
        "rate",
        "limit",
        "quota",
        "exceeded",
        "too many",
        "try again",
        "452",
        "450",
        "421",
        "550",
        "4.5.3",
        "temporary",
        "greylist",
        "defer",
        "resources are unavailable",
        "insufficient",
        "service not available",
        "connection reset",
        "timed out",
        "timeout",
        "not verified",
        "domain is not verified",
    )
    return any(n in msg for n in needles)


def _send_sync_profile(*, profile: _SmtpProfile, to_addr: str, subject: str, text_body: str) -> None:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = profile.from_addr
    msg["To"] = to_addr
    msg.set_content(text_body)

    context = ssl.create_default_context()
    with smtplib.SMTP(profile.host, profile.port, timeout=30) as server:
        if profile.use_tls:
            server.starttls(context=context)
        if profile.user and profile.password:
            server.login(profile.user, profile.password)
        server.send_message(msg)


def _send_with_primary_then_fallback(*, to_addr: str, subject: str, text_body: str) -> None:
    primary = _primary_profile()
    fallback = _fallback_profile()
    if not primary and not fallback:
        return

    last_exc: Optional[BaseException] = None

    if primary:
        try:
            _send_sync_profile(profile=primary, to_addr=to_addr, subject=subject, text_body=text_body)
            logger.debug("smtp sent via=%s to=%s", primary.label, to_addr)
            return
        except Exception as e:
            last_exc = e
            if fallback and _should_try_fallback(e):
                logger.warning(
                    "smtp primary failed (trying fallback) host=%s to=%s err=%s",
                    primary.host,
                    to_addr,
                    e,
                )
            else:
                raise

    if fallback:
        _send_sync_profile(profile=fallback, to_addr=to_addr, subject=subject, text_body=text_body)
        logger.info("smtp sent via=%s to=%s (fallback relay)", fallback.label, to_addr)
        return

    if last_exc:
        raise last_exc


async def _send_async(to_addr: str, subject: str, text_body: str) -> None:
    await asyncio.to_thread(
        _send_with_primary_then_fallback,
        to_addr=to_addr,
        subject=subject,
        text_body=text_body,
    )


async def send_donation_receipt_email(to_email: str, campaign_title: str, amount: float) -> None:
    if not smtp_delivery_configured():
        logger.info(
            "donation_receipt_email skipped (no SMTP_HOST / SMTP_FALLBACK_HOST) to=%s campaign=%r",
            to_email,
            campaign_title,
        )
        return
    subject = f"Thank you — your ${amount:.2f} gift on Dolli"
    body = (
        f"Thank you for supporting \"{campaign_title}\".\n\n"
        f"Amount: ${amount:.2f}\n\n"
        "Dolli — micro-donations that spread through your community.\n"
    )
    try:
        await _send_async(to_email, subject, body)
        logger.info("donation_receipt_email sent to=%s", to_email)
    except Exception:
        logger.exception("donation_receipt_email failed to=%s", to_email)


def _frontend_base_url() -> str:
    return (os.environ.get("FRONTEND_URL") or "https://dolli.space").strip().rstrip("/")


async def send_password_reset_email(to_email: str, reset_url: str) -> None:
    if not smtp_delivery_configured():
        logger.info("password_reset_email skipped (no SMTP) to=%s", to_email)
        return
    subject = "Reset your Dolli password"
    body = (
        "Use this one-time link to set a new password (valid about one hour):\n\n"
        f"{reset_url}\n\n"
        "If you did not request this, you can ignore this email.\n"
    )
    try:
        await _send_async(to_email.strip(), subject, body)
        logger.info("password_reset_email sent to=%s", to_email)
    except Exception:
        logger.exception("password_reset_email failed to=%s", to_email)


async def send_magic_login_email(to_email: str, sign_in_url: str) -> None:
    if not smtp_delivery_configured():
        logger.info("magic_login_email skipped (no SMTP) to=%s", to_email)
        return
    subject = "Your Dolli sign-in link"
    body = (
        "Use this one-time link to sign in to Dolli (valid about 15 minutes):\n\n"
        f"{sign_in_url}\n\n"
        "If you did not request this, you can ignore this email.\n"
    )
    try:
        await _send_async(to_email.strip(), subject, body)
        logger.info("magic_login_email sent to=%s", to_email)
    except Exception:
        logger.exception("magic_login_email failed to=%s", to_email)


async def send_followers_new_campaign_emails(
    *,
    recipient_emails: list[str],
    organizer_display: str,
    campaign_title: str,
    campaign_id: int,
) -> None:
    """Optional digest when SMTP is configured; capped to avoid slow requests."""
    if not smtp_delivery_configured():
        return
    base = _frontend_base_url()
    url = f"{base}/campaign/{campaign_id}"
    subject = f"New fundraiser on Dolli — {organizer_display}"
    cap = min(len(recipient_emails), 40)
    for to_addr in recipient_emails[:cap]:
        body = (
            f"{organizer_display} started a new fundraiser: \"{campaign_title}\".\n\n"
            f"Open: {url}\n\n"
            "You received this because you follow this organizer on Dolli.\n"
        )
        try:
            await _send_async(to_addr.strip(), subject, body)
        except Exception:
            logger.exception("follower_new_campaign_email failed to=%s", to_addr)
    if len(recipient_emails) > cap:
        logger.warning("follower_new_campaign_email truncated sent=%s total=%s", cap, len(recipient_emails))


async def send_followers_campaign_milestone_emails(
    *,
    recipient_emails: list[str],
    milestone_pct: int,
    campaign_title: str,
    campaign_id: int,
) -> None:
    if not smtp_delivery_configured():
        return
    base = _frontend_base_url()
    url = f"{base}/campaign/{campaign_id}"
    subject = f"{milestone_pct}% funded — {campaign_title[:80]}"
    cap = min(len(recipient_emails), 40)
    for to_addr in recipient_emails[:cap]:
        body = (
            f"A fundraiser you follow reached {milestone_pct}% of its goal: \"{campaign_title}\".\n\n"
            f"Open: {url}\n\n"
            "You’re receiving this because you follow the organizer on Dolli.\n"
        )
        try:
            await _send_async(to_addr.strip(), subject, body)
        except Exception:
            logger.exception("follower_milestone_email failed to=%s", to_addr)
    if len(recipient_emails) > cap:
        logger.warning("follower_milestone_email truncated sent=%s total=%s", cap, len(recipient_emails))
