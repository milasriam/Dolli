"""Optional OAuth2 flows for TikTok Login Kit and Meta (Facebook / Instagram ecosystem)."""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, Optional, Tuple
from urllib.parse import urlencode

import httpx

logger = logging.getLogger(__name__)

TIKTOK_AUTH = "https://www.tiktok.com/v2/auth/authorize/"
TIKTOK_TOKEN = "https://open.tiktokapis.com/v2/oauth/token/"
TIKTOK_USER = "https://open.tiktokapis.com/v2/user/info/"

META_DIALOG = "https://www.facebook.com/v19.0/dialog/oauth"
META_TOKEN = "https://graph.facebook.com/v19.0/oauth/access_token"
META_ME = "https://graph.facebook.com/v19.0/me"


def tiktok_configured() -> bool:
    return bool(os.environ.get("TIKTOK_CLIENT_KEY", "").strip() and os.environ.get("TIKTOK_CLIENT_SECRET", "").strip())


def meta_configured() -> bool:
    return bool(os.environ.get("META_APP_ID", "").strip() and os.environ.get("META_APP_SECRET", "").strip())


def tiktok_client_key() -> str:
    return os.environ.get("TIKTOK_CLIENT_KEY", "").strip()


def tiktok_client_secret() -> str:
    return os.environ.get("TIKTOK_CLIENT_SECRET", "").strip()


def meta_app_id() -> str:
    return os.environ.get("META_APP_ID", "").strip()


def meta_app_secret() -> str:
    return os.environ.get("META_APP_SECRET", "").strip()


def build_tiktok_authorize_url(*, redirect_uri: str, state: str, code_challenge: str) -> str:
    params = {
        "client_key": tiktok_client_key(),
        "response_type": "code",
        "scope": "user.info.basic,user.info.profile",
        "redirect_uri": redirect_uri,
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }
    return TIKTOK_AUTH + "?" + urlencode(params)


def build_meta_authorize_url(*, redirect_uri: str, state: str) -> str:
    params = {
        "client_id": meta_app_id(),
        "redirect_uri": redirect_uri,
        "state": state,
        "scope": "email,public_profile",
    }
    return META_DIALOG + "?" + urlencode(params)


async def tiktok_exchange_and_profile(
    *, code: str, redirect_uri: str, code_verifier: str
) -> Tuple[str, str, str]:
    """Returns (platform_sub, email, display_name)."""
    data = {
        "client_key": tiktok_client_key(),
        "client_secret": tiktok_client_secret(),
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": redirect_uri,
        "code_verifier": code_verifier,
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        tr = await client.post(
            TIKTOK_TOKEN,
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    if tr.status_code != 200:
        logger.error("TikTok token error: %s %s", tr.status_code, tr.text)
        raise ValueError(f"TikTok token exchange failed: {tr.text[:200]}")

    body = tr.json()
    access = (body.get("access_token") or "").strip()
    if not access:
        raise ValueError("TikTok response missing access_token")

    async with httpx.AsyncClient(timeout=30.0) as client:
        ur = await client.get(
            TIKTOK_USER,
            params={"fields": "open_id,union_id,display_name,avatar_url"},
            headers={"Authorization": f"Bearer {access}"},
        )
    if ur.status_code != 200:
        logger.error("TikTok userinfo error: %s %s", ur.status_code, ur.text)
        raise ValueError(f"TikTok user info failed: {ur.text[:200]}")

    uj: Dict[str, Any] = ur.json()
    err = uj.get("error")
    if isinstance(err, dict):
        code = str(err.get("code") or "").lower()
        if code and code != "ok":
            raise ValueError(err.get("message") or "TikTok userinfo error")
    data_block = uj.get("data")
    if isinstance(data_block, dict):
        inner = data_block.get("user") or data_block
    else:
        inner = uj.get("user") or uj
    if not isinstance(inner, dict):
        raise ValueError("Unexpected TikTok userinfo shape")

    open_id = str(inner.get("open_id") or "").strip()
    if not open_id:
        raise ValueError("TikTok userinfo missing open_id")

    name = (inner.get("display_name") or inner.get("username") or "TikTok user").strip() or "TikTok user"
    email = f"tiktok.{open_id}@users.dolli.internal"
    return f"tiktok:{open_id}", email, name


async def meta_exchange_and_profile(*, code: str, redirect_uri: str) -> Tuple[str, str, str]:
    """Facebook Login — same Meta app can be used for Instagram-focused products."""
    params = {
        "client_id": meta_app_id(),
        "redirect_uri": redirect_uri,
        "client_secret": meta_app_secret(),
        "code": code,
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        tr = await client.get(META_TOKEN, params=params)
    if tr.status_code != 200:
        logger.error("Meta token error: %s %s", tr.status_code, tr.text)
        raise ValueError(f"Meta token exchange failed: {tr.text[:200]}")
    tj = tr.json()
    access = (tj.get("access_token") or "").strip()
    if not access:
        raise ValueError("Meta response missing access_token")

    async with httpx.AsyncClient(timeout=30.0) as client:
        mr = await client.get(
            META_ME,
            params={"fields": "id,name,email", "access_token": access},
        )
    if mr.status_code != 200:
        logger.error("Meta /me error: %s %s", mr.status_code, mr.text)
        raise ValueError(f"Meta profile failed: {mr.text[:200]}")
    mj = mr.json()
    uid = str(mj.get("id") or "").strip()
    if not uid:
        raise ValueError("Meta profile missing id")
    name = (mj.get("name") or "Facebook user").strip() or "Facebook user"
    email = (mj.get("email") or "").strip()
    if not email:
        email = f"meta.{uid}@users.dolli.internal"
    return f"meta:{uid}", email, name
