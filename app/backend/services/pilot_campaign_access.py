import os
import re
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.platform_settings import PlatformSetting

PILOT_CAMPAIGN_SETTING_KEY = "pilot_campaign_create_emails"

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def parse_pilot_email_csv(raw: Optional[str]) -> set[str]:
    if not raw or not str(raw).strip():
        return set()
    return {part.strip().lower() for part in str(raw).split(",") if part.strip()}


def env_pilot_campaign_emails() -> set[str]:
    return parse_pilot_email_csv(os.environ.get("PILOT_CAMPAIGN_CREATE_EMAILS", ""))


async def db_pilot_campaign_emails(db: AsyncSession) -> set[str]:
    result = await db.execute(
        select(PlatformSetting.value).where(PlatformSetting.key == PILOT_CAMPAIGN_SETTING_KEY).limit(1)
    )
    val = result.scalar_one_or_none()
    if not val:
        return set()
    return parse_pilot_email_csv(val)


async def merged_pilot_campaign_emails(db: AsyncSession) -> set[str]:
    return env_pilot_campaign_emails() | await db_pilot_campaign_emails(db)


async def user_has_pilot_campaign_bypass(db: AsyncSession, user_email: Optional[str]) -> bool:
    if not user_email or not str(user_email).strip():
        return False
    return str(user_email).strip().lower() in await merged_pilot_campaign_emails(db)


def normalize_email_list(emails: list[str]) -> list[str]:
    """Lowercase, strip, dedupe, filter invalid-looking addresses."""
    out: list[str] = []
    seen: set[str] = set()
    for raw in emails:
        e = str(raw).strip().lower()
        if not e or e in seen:
            continue
        if not _EMAIL_RE.match(e):
            continue
        seen.add(e)
        out.append(e)
    return sorted(out)


def strict_normalize_emails(emails: list[str]) -> list[str]:
    """Same as normalize but raises ValueError if any non-empty token is not a valid email shape."""
    out: list[str] = []
    seen: set[str] = set()
    for raw in emails:
        e = str(raw).strip().lower()
        if not e:
            continue
        if not _EMAIL_RE.match(e):
            raise ValueError(f"Invalid email address: {raw!r}")
        if e in seen:
            continue
        seen.add(e)
        out.append(e)
    return sorted(out)


async def set_database_pilot_campaign_emails(db: AsyncSession, emails: list[str]) -> int:
    """Persist allowlist; returns count of stored emails."""
    normalized = strict_normalize_emails(emails)
    csv = ",".join(normalized)
    row = await db.get(PlatformSetting, PILOT_CAMPAIGN_SETTING_KEY)
    if row:
        row.value = csv
    else:
        db.add(PlatformSetting(key=PILOT_CAMPAIGN_SETTING_KEY, value=csv))
    await db.commit()
    return len(normalized)
