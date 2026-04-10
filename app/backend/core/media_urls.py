"""Validate media URLs returned by LLMs before we persist or display them."""

from __future__ import annotations

from urllib.parse import urlparse


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
