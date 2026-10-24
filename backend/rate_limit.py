"""Bounded, thread-safe in-process throttling for APEX public endpoints.

This is defense in depth, not a distributed rate limiter. Production deployments
should additionally enforce limits at the reverse proxy or WAF.
"""

import time
from collections import deque
from threading import Lock
from typing import Callable


class SlidingWindowLimiter:
    """Keep at most ``max_keys`` active (group, client) windows.

    At capacity, expired entries are removed; if all entries remain active,
    requests from *new* clients are rejected rather than dropping existing
    counters and allowing an attacker to reset their throttle by key churn.
    """

    def __init__(self, max_keys: int = 4096, clock: Callable[[], float] = time.monotonic):
        if max_keys < 1:
            raise ValueError('max_keys must be positive')
        self.max_keys = max_keys
        self._clock = clock
        self._lock = Lock()
        self._windows: dict[tuple[str, str], tuple[int, deque[float]]] = {}

    def allow(self, group: str, client: str, limit: int, window: int) -> bool:
        if limit < 1 or window < 1:
            raise ValueError('limit and window must be positive')
        key = (group, client)
        with self._lock:
            now = self._clock()
            entry = self._windows.get(key)
            if entry is None:
                if len(self._windows) >= self.max_keys:
                    self._prune_expired(now)
                    if len(self._windows) >= self.max_keys:
                        return False
                attempts = deque()
                self._windows[key] = (window, attempts)
            else:
                stored_window, attempts = entry
                # Preserve the stricter retention period if a group is
                # reconfigured to use a longer window at runtime.
                if window > stored_window:
                    self._windows[key] = (window, attempts)
            cutoff = now - window
            while attempts and attempts[0] <= cutoff:
                attempts.popleft()
            if len(attempts) >= limit:
                return False
            attempts.append(now)
            return True

    def _prune_expired(self, now: float) -> None:
        for key, (window, attempts) in list(self._windows.items()):
            if not attempts or attempts[-1] <= now - window:
                del self._windows[key]
