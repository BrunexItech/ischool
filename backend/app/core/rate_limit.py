import time
from collections import defaultdict
from threading import Lock

MAX_ATTEMPTS = 5
WINDOW_SECONDS = 15 * 60

_lock = Lock()
_failed_attempts: dict[str, list[float]] = defaultdict(list)


def _prune(key: str, now: float) -> list[float]:
    attempts = [t for t in _failed_attempts[key] if now - t < WINDOW_SECONDS]
    _failed_attempts[key] = attempts
    return attempts


def is_locked_out(key: str) -> bool:
    """Keyed by email (lowercased) — protects a single account from brute
    force regardless of source IP. Single-process, in-memory: fine for one
    uvicorn worker; a multi-worker/production deployment needs a shared
    store (Redis) instead, since each worker would otherwise count separately."""
    with _lock:
        return len(_prune(key, time.time())) >= MAX_ATTEMPTS


def record_failed_attempt(key: str) -> None:
    with _lock:
        now = time.time()
        _prune(key, now)
        _failed_attempts[key].append(now)


def clear_attempts(key: str) -> None:
    with _lock:
        _failed_attempts.pop(key, None)
