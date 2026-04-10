"""Validate media URLs returned by LLMs before we persist or display them."""

from __future__ import annotations

import re
from urllib.parse import urlparse


def normalize_cover_image_url(raw: str | None) -> str:
    """
    Map common Google Drive share URLs to /uc?export=view (direct image for <img src>).
    Returns stripped string (may still be non-https); caller usually chains sanitize.
    """
    if not raw or not str(raw).strip():
        return ""
    s = str(raw).strip()
    m = re.search(
        r"https://drive\.google\.com(?:/u/\d+)?/file/d/([a-zA-Z0-9_-]+)(?:/[^\s?]*)?",
        s,
        re.I,
    )
    if m:
        return f"https://drive.google.com/uc?export=view&id={m.group(1)}"
    m2 = re.search(r"https://drive\.google\.com/open\?id=([a-zA-Z0-9_-]+)", s, re.I)
    if m2:
        return f"https://drive.google.com/uc?export=view&id={m2.group(1)}"
    return s


def sanitize_https_media_url(raw: str | None, max_len: int = 2000) -> str:
    """
    Allow only https URLs with a plausible host (blocks javascript:, data:, etc.).
    Returns empty string if invalid.
    """
    if not raw or not str(raw).strip():
        return ""
    s = str(raw).strip()[:max_len]
    if not s.lower().startswith("https://"):
        return ""
    try:
        p = urlparse(s)
    except Exception:
        return ""
    if p.scheme != "https":
        return ""
    host = (p.hostname or "").lower()
    if not host or "." not in host:
        return ""
    if host in ("localhost", "127.0.0.1", "0.0.0.0"):
        return ""
    return s
