"""
Social preview HTML for campaign links. Crawlers hit /api/share/campaign/{id}; humans redirect to the SPA.
"""

from __future__ import annotations

import html
import logging
import os

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.campaigns import Campaigns

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/share", tags=["share"])

_DEFAULT_OG_IMAGE = (
    os.environ.get("DOLLI_DEFAULT_OG_IMAGE_URL")
    or "https://dolli.space/brand/dolli-mark.svg"
)

_BOT_MARKERS = (
    "facebookexternalhit",
    "facebot",
    "twitterbot",
    "linkedinbot",
    "slackbot",
    "discordbot",
    "whatsapp",
    "telegrambot",
    "pinterest",
    "googlebot",
    "bingbot",
    "slack-imgproxy",
    "embedly",
    "vkshare",
    "quora link preview",
)


def _is_share_bot(user_agent: str) -> bool:
    u = (user_agent or "").lower()
    return any(m in u for m in _BOT_MARKERS)


def _frontend_base() -> str:
    return (
        os.environ.get("FRONTEND_PUBLIC_URL")
        or os.environ.get("VITE_FRONTEND_URL")
        or "https://dolli.space"
    ).rstrip("/")


@router.get("/campaign/{campaign_id}", response_class=HTMLResponse)
async def campaign_share_landing(
    campaign_id: int,
    request: Request,
    ref: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Returns Open Graph HTML for bots; 302 redirect to SPA for normal browsers.
    """
    base = _frontend_base()
    redir_path = f"/campaign/{campaign_id}"
    if ref:
        redir_path = f"{redir_path}?ref={ref}"
    human_url = f"{base}{redir_path}"

    if not _is_share_bot(request.headers.get("user-agent", "")):
        return RedirectResponse(human_url, status_code=302)

    result = await db.execute(select(Campaigns).where(Campaigns.id == campaign_id))
    c = result.scalar_one_or_none()
    if not c or (str(c.status or "").lower() != "active"):
        raise HTTPException(status_code=404, detail="Campaign not found")

    title = html.escape((c.title or "Fundraiser on Dolli")[:120])
    desc_raw = (c.description or "Micro-donations that add up on Dolli.")[:320]
    desc = html.escape(desc_raw)
    img = (c.image_url or "").strip() or _DEFAULT_OG_IMAGE
    img_esc = html.escape(img, quote=True)
    page_url = html.escape(str(request.url), quote=True)

    body = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>{title}</title>
  <meta name="description" content="{desc}" />
  <link rel="canonical" href="{html.escape(human_url, quote=True)}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="{title}" />
  <meta property="og:description" content="{desc}" />
  <meta property="og:image" content="{img_esc}" />
  <meta property="og:url" content="{page_url}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{title}" />
  <meta name="twitter:description" content="{desc}" />
  <meta name="twitter:image" content="{img_esc}" />
  <meta http-equiv="refresh" content="0;url={html.escape(human_url, quote=True)}" />
</head>
<body>
  <p><a href="{html.escape(human_url, quote=True)}">Open this fundraiser on Dolli</a></p>
</body>
</html>"""
    return HTMLResponse(content=body, status_code=200)
