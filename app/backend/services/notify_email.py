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
