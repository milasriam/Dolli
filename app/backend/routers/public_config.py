"""Public SPA bootstrap config (same JSON shape as Lambda /api/config)."""

import os

from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["public"])


@router.get("/config")
async def spa_runtime_config():
    """Expose only the API base URL the browser should use. No secrets."""
    base = (
        os.environ.get("BACKEND_PUBLIC_URL")
        or os.environ.get("PYTHON_BACKEND_URL")
        or os.environ.get("VITE_API_BASE_URL")
        or ""
    ).rstrip("/")
    if not base:
        base = "http://127.0.0.1:8000"
    return {"API_BASE_URL": base}
