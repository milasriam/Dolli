"""Per-user rate limits for campaign AI endpoints (in-process; resets on deploy)."""

from __future__ import annotations

import asyncio
import os
import time
from collections import defaultdict, deque
from typing import Deque, Dict

from fastapi import HTTPException, status

_lock = asyncio.Lock()
_hits: Dict[str, Deque[float]] = defaultdict(deque)

_MAX_HOUR = int(os.environ.get("CAMPAIGN_AI_MAX_PER_HOUR", "40"))
_BURST_WINDOW = 60.0
_MAX_BURST = int(os.environ.get("CAMPAIGN_AI_MAX_BURST_PER_MINUTE", "10"))


async def record_campaign_ai_request(user_id: str) -> None:
    """Raises 429 if user exceeded limits."""
    now = time.time()
    async with _lock:
        q = _hits[user_id]
        while q and q[0] < now - 3600:
            q.popleft()
        if len(q) >= _MAX_HOUR:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="AI assistant hourly limit reached. Try again in a little while.",
            )
        recent = sum(1 for t in q if t > now - _BURST_WINDOW)
        if recent >= _MAX_BURST:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many AI requests in a short window. Pause briefly and retry.",
            )
        q.append(now)
