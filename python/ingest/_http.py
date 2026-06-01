"""Shared HTTP session with per-host rate limiting and exponential-backoff retry."""

import threading
import time
from collections.abc import Collection
from typing import Any
from urllib.parse import urlparse

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

_USER_AGENT = "Metis/0.1 (+https://github.com/puffin/metis; research use)"

_DEFAULT_STATUS_FORCELIST: frozenset[int] = frozenset({429, 500, 502, 503, 504})


class _HostRateLimiter:
    """Simple interval-based rate limiter (one request per 1/rps seconds)."""

    def __init__(self, rps: float) -> None:
        self._interval = 1.0 / rps
        self._last: float = 0.0
        self._lock = threading.Lock()

    def wait(self) -> None:
        with self._lock:
            now = time.monotonic()
            remaining = self._interval - (now - self._last)
            if remaining > 0:
                time.sleep(remaining)
            self._last = time.monotonic()


class RateLimitedSession:
    """requests.Session with per-host rate limiting and exponential-backoff retry.

    Args:
        host_rps: Map of hostname → max requests per second. Overrides default_rps.
        default_rps: Fallback RPS for hosts not in host_rps.
        max_retries: Number of retries on transient errors.
        backoff_factor: Seconds to wait between retries (doubles each attempt).
        status_forcelist: HTTP status codes that trigger a retry.
    """

    DEFAULT_RPS: float = 2.0

    def __init__(
        self,
        host_rps: dict[str, float] | None = None,
        default_rps: float = DEFAULT_RPS,
        max_retries: int = 3,
        backoff_factor: float = 1.0,
        status_forcelist: Collection[int] = _DEFAULT_STATUS_FORCELIST,
        extra_headers: dict[str, str] | None = None,
    ) -> None:
        self._host_rps = host_rps or {}
        self._default_rps = default_rps
        self._limiters: dict[str, _HostRateLimiter] = {}

        retry = Retry(
            total=max_retries,
            backoff_factor=backoff_factor,
            status_forcelist=set(status_forcelist),
            allowed_methods={"GET"},
        )
        adapter = HTTPAdapter(max_retries=retry)
        self._session = requests.Session()
        self._session.headers["User-Agent"] = _USER_AGENT
        if extra_headers:
            self._session.headers.update(extra_headers)
        self._session.mount("https://", adapter)
        self._session.mount("http://", adapter)

    def _get_limiter(self, url: str) -> _HostRateLimiter:
        host = urlparse(url).netloc
        if host not in self._limiters:
            rps = self._host_rps.get(host, self._default_rps)
            self._limiters[host] = _HostRateLimiter(rps)
        return self._limiters[host]

    def get(self, url: str, **kwargs: Any) -> requests.Response:
        self._get_limiter(url).wait()
        return self._session.get(url, **kwargs)

    def close(self) -> None:
        self._session.close()

    def __enter__(self) -> "RateLimitedSession":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()
