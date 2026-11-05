"""Basketball-Reference adapter — season totals and advanced totals.

Fetches /leagues/NBA_YYYY_totals.html and /leagues/NBA_YYYY_advanced.html,
caches raw HTML under data/raw/bref/, and writes normalized Parquet to
data/parquet/bref/.

Rate limiting: Basketball-Reference robots.txt specifies Crawl-delay: 3, so
this adapter uses RateLimitedSession configured at 1/3 req/s for the bref host.
"""

from __future__ import annotations

import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from ingest._http import RateLimitedSession
from ingest._parquet import write_parquet
from ingest.base import NormalizedRecord, RawRecord
from ingest.bref.parser import parse_advanced_totals, parse_season_totals

SOURCE = "bref"
_HOST = "www.basketball-reference.com"

# robots.txt Crawl-delay: 3 → max 1 request per 3 seconds
_HOST_RPS: float = 1.0 / 3.0

_BASE_URL = "https://www.basketball-reference.com"


def _default_raw_root() -> Path:
    env = os.environ.get("METIS_DATA_ROOT")
    if env:
        return Path(env) / "raw" / SOURCE
    return Path(__file__).parents[3] / "data" / "raw" / SOURCE


def _cache_path(raw_root: Path, entity: str, season: int, filename: str) -> Path:
    dest = raw_root / entity / f"season={season}"
    dest.mkdir(parents=True, exist_ok=True)
    return dest / filename


class BrefAdapter:
    """Ingestion adapter for www.basketball-reference.com.

    Implements the Adapter protocol (fetch / parse / write).  The primary
    entry points are run_season_totals() and run_advanced_totals() which
    orchestrate the full fetch → parse → write pipeline.

    Args:
        rps: Requests per second.  Must not exceed 1/3 (robots.txt Crawl-delay).
        raw_root: Override for the data/raw/bref/ cache directory.
    """

    source: str = SOURCE

    def __init__(
        self,
        rps: float = _HOST_RPS,
        raw_root: Path | None = None,
    ) -> None:
        self._session = RateLimitedSession(host_rps={_HOST: rps})
        self._raw_root = raw_root or _default_raw_root()

    def _fetch_html(self, url: str, cache_path: Path) -> tuple[str, datetime]:
        """Return (html, fetched_at), reading from disk cache if present.

        The cache stores both the HTML body and the original fetched_at
        timestamp in a sidecar <filename>.meta file so re-runs are
        idempotent and do not re-fetch.
        """
        meta_path = cache_path.with_suffix(".meta")
        if cache_path.exists() and meta_path.exists():
            fetched_at = datetime.fromisoformat(meta_path.read_text().strip())
            return cache_path.read_text(encoding="utf-8"), fetched_at

        fetched_at = datetime.now(UTC)
        resp = self._session.get(url)
        resp.raise_for_status()
        html = resp.text

        cache_path.write_text(html, encoding="utf-8")
        meta_path.write_text(fetched_at.isoformat())

        return html, fetched_at

    # ------------------------------------------------------------------
    # Adapter protocol
    # ------------------------------------------------------------------

    def fetch(self, entity: str, params: dict[str, Any]) -> list[RawRecord]:
        """Fetch raw HTML for a season and return it as a single RawRecord list.

        Args:
            entity: 'player_season_totals' or 'player_season_advanced'
            params: {'season': int}  (start year, e.g. 2024 for 2024-25)

        Returns:
            A single-element list containing one RawRecord with:
                html, fetched_at, source_url, entity, season
        """
        season: int = params["season"]

        if entity == "player_season_totals":
            url = f"{_BASE_URL}/leagues/NBA_{season}_totals.html"
            cp = _cache_path(self._raw_root, entity, season, f"NBA_{season}_totals.html")
        elif entity == "player_season_advanced":
            url = f"{_BASE_URL}/leagues/NBA_{season}_advanced.html"
            cp = _cache_path(self._raw_root, entity, season, f"NBA_{season}_advanced.html")
        else:
            raise ValueError(f"Unknown entity: {entity!r}")

        html, fetched_at = self._fetch_html(url, cp)
        return [
            {
                "html": html,
                "fetched_at": fetched_at,
                "source_url": url,
                "entity": entity,
                "season": season,
            }
        ]

    def parse(self, raw: RawRecord) -> NormalizedRecord:
        """Parse a single raw HTML record into a list of normalized rows.

        Note: Because one HTML page maps to many player rows, this method
        returns the full list encoded as a single NormalizedRecord under key
        'rows'.  The orchestrating run_* methods call the parser directly for
        efficiency; this method satisfies the protocol for single-record use.
        """
        entity: str = raw["entity"]
        html: str = raw["html"]
        season: int = raw["season"]
        source_url: str = raw["source_url"]
        fetched_at: datetime = raw["fetched_at"]

        if entity == "player_season_totals":
            rows = parse_season_totals(
                html, season=season, source_url=source_url, fetched_at=fetched_at
            )
        elif entity == "player_season_advanced":
            rows = parse_advanced_totals(
                html, season=season, source_url=source_url, fetched_at=fetched_at
            )
        else:
            raise ValueError(f"Unknown entity: {entity!r}")

        return {"rows": rows}

    def write(self, records: list[NormalizedRecord], season: int) -> Path:
        """Write player_season_totals records to Parquet (Adapter protocol)."""
        return write_parquet(records, source=SOURCE, entity="player_season_totals", season=season)

    # ------------------------------------------------------------------
    # Orchestrated pipelines
    # ------------------------------------------------------------------

    def run_season_totals(self, season: int, *, verbose: bool = False) -> Path:
        """Fetch season totals and write to Parquet.

        Output: data/parquet/bref/player_season_totals/season=<YYYY>/part-*.parquet

        Args:
            season: Start year of the season (e.g. 2024 for 2024-25).
            verbose: Print progress to stdout.

        Returns:
            Path to the written Parquet file.
        """
        url = f"{_BASE_URL}/leagues/NBA_{season}_totals.html"
        cp = _cache_path(
            self._raw_root, "player_season_totals", season, f"NBA_{season}_totals.html"
        )

        if verbose:
            print(f"Fetching season totals for {season}-{str(season + 1)[2:]}...")

        html, fetched_at = self._fetch_html(url, cp)

        if verbose:
            print(f"  Cached at: {cp}")
            print("  Parsing HTML...")

        rows = parse_season_totals(html, season=season, source_url=url, fetched_at=fetched_at)

        if verbose:
            print(f"  Parsed {len(rows)} player-team rows.")
            print("  Writing Parquet...")

        path = write_parquet(rows, source=SOURCE, entity="player_season_totals", season=season)

        if verbose:
            print(f"  player_season_totals → {path}")

        return path

    def run_advanced_totals(self, season: int, *, verbose: bool = False) -> Path:
        """Fetch advanced totals and write to Parquet.

        Output: data/parquet/bref/player_season_advanced/season=<YYYY>/part-*.parquet

        Args:
            season: Start year of the season (e.g. 2024 for 2024-25).
            verbose: Print progress to stdout.

        Returns:
            Path to the written Parquet file.
        """
        url = f"{_BASE_URL}/leagues/NBA_{season}_advanced.html"
        cp = _cache_path(
            self._raw_root, "player_season_advanced", season, f"NBA_{season}_advanced.html"
        )

        if verbose:
            print(f"Fetching advanced totals for {season}-{str(season + 1)[2:]}...")

        html, fetched_at = self._fetch_html(url, cp)

        if verbose:
            print(f"  Cached at: {cp}")
            print("  Parsing HTML...")

        rows = parse_advanced_totals(html, season=season, source_url=url, fetched_at=fetched_at)

        if verbose:
            print(f"  Parsed {len(rows)} player-team rows.")
            print("  Writing Parquet...")

        path = write_parquet(rows, source=SOURCE, entity="player_season_advanced", season=season)

        if verbose:
            print(f"  player_season_advanced → {path}")

        return path

    def close(self) -> None:
        """Close the underlying HTTP session."""
        self._session.close()

    def __enter__(self) -> BrefAdapter:
        return self

    def __exit__(self, *_: object) -> None:
        self.close()
