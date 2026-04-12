"""Optional SMTP notifications (donation receipt). No-op when SMTP_HOST is unset."""

from __future__ import annotations

import asyncio
import logging
import os
import smtplib
import ssl
from email.message import EmailMessage

logger = logging.getLogger(__name__)


def _send_sync(*, to_addr: str, subject: str, text_body: str) -> None:
    host = (os.environ.get("SMTP_HOST") or "").strip()
    if not host:
        return
    port = int(os.environ.get("SMTP_PORT", "587"))
    user = (os.environ.get("SMTP_USER") or "").strip()
    password = (os.environ.get("SMTP_PASSWORD") or "").strip()
    from_addr = (os.environ.get("SMTP_FROM") or user or "no-reply@dolli.space").strip()

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_addr
    msg.set_content(text_body)

    context = ssl.create_default_context()
    use_tls = os.environ.get("SMTP_USE_TLS", "true").lower() not in ("0", "false", "no")
    with smtplib.SMTP(host, port, timeout=30) as server:
        if use_tls:
            server.starttls(context=context)
        if user and password:
            server.login(user, password)
        server.send_message(msg)


async def send_donation_receipt_email(to_email: str, campaign_title: str, amount: float) -> None:
    if not (os.environ.get("SMTP_HOST") or "").strip():
        logger.info(
            "donation_receipt_email skipped (SMTP_HOST unset) to=%s campaign=%r",
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
        await asyncio.to_thread(
            _send_sync,
            to_addr=to_email,
            subject=subject,
            text_body=body,
        )
        logger.info("donation_receipt_email sent to=%s", to_email)
    except Exception:
        logger.exception("donation_receipt_email failed to=%s", to_email)


def _frontend_base_url() -> str:
    return (os.environ.get("FRONTEND_URL") or "https://dolli.space").strip().rstrip("/")


async def send_password_reset_email(to_email: str, reset_url: str) -> None:
    """Forgot-password link; no-op when SMTP_HOST is unset."""
    if not (os.environ.get("SMTP_HOST") or "").strip():
        logger.info("password_reset_email skipped (SMTP_HOST unset) to=%s", to_email)
        return
    subject = "Reset your Dolli password"
    body = (
        "Use this one-time link to set a new password (valid about one hour):\n\n"
        f"{reset_url}\n\n"
        "If you did not request this, you can ignore this email.\n"
    )
    try:
        await asyncio.to_thread(
            _send_sync,
            to_addr=to_email.strip(),
            subject=subject,
            text_body=body,
        )
        logger.info("password_reset_email sent to=%s", to_email)
    except Exception:
        logger.exception("password_reset_email failed to=%s", to_email)


async def send_magic_login_email(to_email: str, sign_in_url: str) -> None:
    """Passwordless sign-in link; no-op when SMTP_HOST is unset."""
    if not (os.environ.get("SMTP_HOST") or "").strip():
        logger.info("magic_login_email skipped (SMTP_HOST unset) to=%s", to_email)
        return
    subject = "Your Dolli sign-in link"
    body = (
        "Use this one-time link to sign in to Dolli (valid about 15 minutes):\n\n"
        f"{sign_in_url}\n\n"
        "If you did not request this, you can ignore this email.\n"
    )
    try:
        await asyncio.to_thread(
            _send_sync,
            to_addr=to_email.strip(),
            subject=subject,
            text_body=body,
        )
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
    if not (os.environ.get("SMTP_HOST") or "").strip():
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
            await asyncio.to_thread(
                _send_sync,
                to_addr=to_addr.strip(),
                subject=subject,
                text_body=body,
            )
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
    if not (os.environ.get("SMTP_HOST") or "").strip():
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
            await asyncio.to_thread(
                _send_sync,
                to_addr=to_addr.strip(),
                subject=subject,
                text_body=body,
            )
        except Exception:
            logger.exception("follower_milestone_email failed to=%s", to_addr)
    if len(recipient_emails) > cap:
        logger.warning("follower_milestone_email truncated sent=%s total=%s", cap, len(recipient_emails))
