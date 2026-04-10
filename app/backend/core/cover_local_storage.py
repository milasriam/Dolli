"""Local-disk campaign media uploads (covers + short videos) when no external OSS API is available."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import time
from pathlib import Path
from urllib.parse import unquote

logger = logging.getLogger(__name__)

_ALLOWED_PREFIXES = ("campaign-covers/", "campaign-videos/")
_MAX_COVER_BYTES = 12 * 1024 * 1024
_MAX_VIDEO_BYTES = 120 * 1024 * 1024


def cover_local_enabled() -> bool:
    raw = (os.environ.get("DOLLI_COVER_STORAGE") or "").strip().lower()
    return raw in ("local", "disk", "filesystem")


def local_root() -> Path:
    p = (os.environ.get("DOLLI_COVER_LOCAL_ROOT") or "/var/lib/dolli/cover-media").strip()
    return Path(p).resolve()


def _signing_secret() -> bytes:
    s = (os.environ.get("DOLLI_COVER_LOCAL_SIGNING_SECRET") or os.environ.get("JWT_SECRET_KEY") or "").strip()
    if not s:
        raise ValueError(
            "Local cover uploads need JWT_SECRET_KEY or DOLLI_COVER_LOCAL_SIGNING_SECRET in the environment."
        )
    return s.encode()


def _object_key_allowed(object_key: str) -> bool:
    return any(object_key.startswith(p) for p in _ALLOWED_PREFIXES)


def mint_upload_token(*, user_id: str, object_key: str, ttl_sec: int = 900) -> str:
    if not _object_key_allowed(object_key) or ".." in object_key or "//" in object_key:
        raise ValueError("Invalid object_key for media upload")
    exp = int(time.time()) + ttl_sec
    payload = json.dumps({"uid": user_id, "ok": object_key, "exp": exp}, separators=(",", ":"), sort_keys=True)
    pb = base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")
    sig = hmac.new(_signing_secret(), pb.encode(), hashlib.sha256).hexdigest()
    return f"{pb}.{sig}"


def verify_upload_token(token: str) -> tuple[str, str]:
    """Returns (user_id, object_key). Raises ValueError if invalid or expired."""
    if "." not in token:
        raise ValueError("bad token")
    pb, sig = token.rsplit(".", 1)
    if len(sig) != 64:
        raise ValueError("bad token")
    expect = hmac.new(_signing_secret(), pb.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expect, sig):
        raise ValueError("bad signature")
    pad = "=" * ((4 - len(pb) % 4) % 4)
    raw = base64.urlsafe_b64decode(pb + pad)
    data = json.loads(raw.decode())
    uid = str(data.get("uid") or "")
    ok = str(data.get("ok") or "")
    exp = int(data.get("exp") or 0)
    if not uid or not ok or not _object_key_allowed(ok) or ".." in ok:
        raise ValueError("bad payload")
    if not any(ok.startswith(f"{p}{uid}/") for p in _ALLOWED_PREFIXES):
        raise ValueError("key user mismatch")
    if int(time.time()) > exp:
        raise ValueError("token expired")
    return uid, ok


def resolve_public_base() -> str:
    base = (
        (os.environ.get("DOLLI_COVER_PUBLIC_BASE_URL") or "").strip()
        or (os.environ.get("BACKEND_PUBLIC_URL") or "").strip()
        or (os.environ.get("PYTHON_BACKEND_URL") or "").strip()
    ).rstrip("/")
    return base


def safe_media_path(object_key: str) -> Path:
    if not _object_key_allowed(object_key) or ".." in object_key:
        raise ValueError("invalid key")
    key = unquote(object_key).strip().lstrip("/")
    root = local_root().resolve()
    target = (root / key).resolve()
    try:
        target.relative_to(root)
    except ValueError as e:
        raise ValueError("path traversal") from e
    return target


async def write_upload_body(object_key: str, body: bytes) -> None:
    limit = _MAX_VIDEO_BYTES if object_key.startswith("campaign-videos/") else _MAX_COVER_BYTES
    if len(body) > limit:
        raise ValueError("file too large")
    path = safe_media_path(object_key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(body)
    logger.info("cover local write bytes=%s path=%s", len(body), path)
