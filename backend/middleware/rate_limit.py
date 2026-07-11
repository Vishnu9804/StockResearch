"""
middleware/rate_limit.py
Pure in-process sliding-window rate limiter — no Redis, no extra deps.

Usage (FastAPI Depends):
    from middleware.rate_limit import RateLimiter

    login_limiter = RateLimiter(max_requests=5, window_seconds=60)

    @router.post("/login")
    async def login(..., _: None = Depends(login_limiter)):
        ...
"""

import time
from collections import deque
from typing import Deque, Dict

from fastapi import Depends, HTTPException, Request


class RateLimiter:
    """
    Sliding-window counter keyed on the client IP address.

    Args:
        max_requests: Maximum number of calls allowed per window.
        window_seconds: Rolling time window in seconds.
    """

    def __init__(self, max_requests: int, window_seconds: int) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        # {ip: deque of timestamps}
        self._windows: Dict[str, Deque[float]] = {}

    def _get_client_ip(self, request: Request) -> str:
        """Extract the real client IP, honouring common proxy headers."""
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip.strip()
        return request.client.host if request.client else "unknown"

    async def __call__(self, request: Request) -> None:
        """FastAPI dependency — raises 429 when the limit is breached."""
        ip = self._get_client_ip(request)
        now = time.monotonic()
        cutoff = now - self.window_seconds

        window = self._windows.setdefault(ip, deque())

        # Evict timestamps outside the current window
        while window and window[0] < cutoff:
            window.popleft()

        if len(window) >= self.max_requests:
            retry_after = int(self.window_seconds - (now - window[0])) + 1
            raise HTTPException(
                status_code=429,
                detail={
                    "error": True,
                    "message": (
                        f"Too many requests. Please wait {retry_after} seconds and try again."
                    ),
                },
                headers={"Retry-After": str(retry_after)},
            )

        window.append(now)


# ── Shared limiter instances ────────────────────────────────────────────────────
# These are module-level singletons so the counters persist across requests
# within the same process.

#: 5 login attempts per 60-second window per IP
login_rate_limiter = RateLimiter(max_requests=5, window_seconds=60)

#: 3 signup attempts per 60-second window per IP
signup_rate_limiter = RateLimiter(max_requests=3, window_seconds=60)
