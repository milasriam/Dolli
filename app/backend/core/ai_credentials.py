"""Resolve OpenAI-compatible API URL + key from environment (Dolli names + common aliases)."""

from __future__ import annotations

import os


def resolve_openai_compatible_config() -> tuple[str, str]:
    """
    Returns (base_url, api_key) for AsyncOpenAI.

    Priority: APP_AI_* then OPENAI_*.
    If a key is present but base URL is empty, default to https://api.openai.com/v1
    (typical when only OPENAI_API_KEY is set).
    """
    key = (os.environ.get("APP_AI_KEY") or os.environ.get("OPENAI_API_KEY") or "").strip()
    base = (os.environ.get("APP_AI_BASE_URL") or os.environ.get("OPENAI_BASE_URL") or "").strip()
    if key and not base:
        base = "https://api.openai.com/v1"
    return base, key


def is_ai_hub_configured() -> bool:
    b, k = resolve_openai_compatible_config()
    return bool(b and k)
