"""Deterministic rate-limit tests without network or sleep delays."""

from concurrent.futures import ThreadPoolExecutor

import pytest

from backend.rate_limit import SlidingWindowLimiter


def test_rejects_limit_and_resets_after_window():
    current = [100.0]
    limiter = SlidingWindowLimiter(clock=lambda: current[0])
    assert limiter.allow('login', 'client-1', limit=2, window=60)
    assert limiter.allow('login', 'client-1', limit=2, window=60)
    assert not limiter.allow('login', 'client-1', limit=2, window=60)
    current[0] += 60
    assert limiter.allow('login', 'client-1', limit=2, window=60)


def test_independent_client_and_endpoint_counters():
    limiter = SlidingWindowLimiter()
    assert limiter.allow('login', 'a', 1, 60)
    assert not limiter.allow('login', 'a', 1, 60)
    assert limiter.allow('login', 'b', 1, 60)
    assert limiter.allow('quote', 'a', 1, 60)


def test_capacity_fails_closed_without_resetting_existing_client():
    current = [100.0]
    limiter = SlidingWindowLimiter(max_keys=2, clock=lambda: current[0])
    assert limiter.allow('login', 'a', 1, 60)
    assert limiter.allow('login', 'b', 1, 60)
    assert not limiter.allow('login', 'c', 1, 60)
    assert not limiter.allow('login', 'a', 1, 60)
    assert len(limiter._windows) == 2
    current[0] += 61
    assert limiter.allow('login', 'c', 1, 60)
    assert len(limiter._windows) == 1


def test_expired_short_window_reclaimed_while_long_window_remains():
    current = [100.0]
    limiter = SlidingWindowLimiter(max_keys=2, clock=lambda: current[0])
    assert limiter.allow('login', 'a', 1, 10)
    assert limiter.allow('quote', 'b', 1, 100)
    current[0] += 11
    assert limiter.allow('login', 'c', 1, 10)
    assert ('quote', 'b') in limiter._windows
    assert ('login', 'a') not in limiter._windows


def test_concurrent_requests_do_not_exceed_limit():
    limiter = SlidingWindowLimiter()
    with ThreadPoolExecutor(max_workers=24) as pool:
        results = list(pool.map(lambda _: limiter.allow('login', 'shared', 8, 60), range(100)))
    assert sum(results) == 8


def test_invalid_configuration_rejected():
    with pytest.raises(ValueError):
        SlidingWindowLimiter(max_keys=0)
    with pytest.raises(ValueError):
        SlidingWindowLimiter().allow('login', 'a', 0, 60)
    with pytest.raises(ValueError):
        SlidingWindowLimiter().allow('login', 'a', 1, 0)
