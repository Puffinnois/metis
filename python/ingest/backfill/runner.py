"""Backfill runner — iterates seasons and calls source adapters.

Each run is *resumable*: a season is skipped when its output Parquet
partition already exists on disk (idempotent).  Pass ``--force`` to
overwrite existing files.

Progress is printed to stdout; errors for individual seasons are caught
and reported at the end so one bad season does not abort the whole run.
"""

from __future__ import annotations

import traceback
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

from ingest.backfill.coverage import (
    bref_advanced_seasons,
    bref_totals_seasons,
    nba_stats_seasons,
)
from ingest.bref.adapter import BrefAdapter
from ingest.nba_stats.adapter import NbaStatsAdapter

# ---------------------------------------------------------------------------
# Result tracking
# ---------------------------------------------------------------------------


@dataclass
class SeasonResult:
    source: str
    kind: str
    season: int
    skipped: bool = False
    output_path: Path | None = None
    error: str | None = None

    @property
    def ok(self) -> bool:
        return self.error is None


@dataclass
class BackfillReport:
    results: list[SeasonResult] = field(default_factory=list)

    @property
    def done(self) -> list[SeasonResult]:
        return [r for r in self.results if r.ok and not r.skipped]

    @property
    def skipped(self) -> list[SeasonResult]:
        return [r for r in self.results if r.skipped]

    @property
    def failed(self) -> list[SeasonResult]:
        return [r for r in self.results if not r.ok]

    def print_summary(self) -> None:
        print(
            f"\n{'='*60}\n"
            f"Backfill summary\n"
            f"  fetched : {len(self.done)}\n"
            f"  skipped : {len(self.skipped)} (already present)\n"
            f"  failed  : {len(self.failed)}\n"
            f"{'='*60}"
        )
        if self.failed:
            print("\nFailed seasons:")
            for r in self.failed:
                print(f"  {r.source}/{r.kind} {r.season}: {r.error}")


# ---------------------------------------------------------------------------
# Parquet existence check (resume support)
# ---------------------------------------------------------------------------

_DATA_ROOT = Path("data/parquet")


def _parquet_exists(source: str, entity: str, season: int) -> bool:
    """True if at least one Parquet file exists for this source/entity/season."""
    partition = _DATA_ROOT / source / entity / f"season={season}"
    return partition.is_dir() and any(partition.glob("part-*.parquet"))


# ---------------------------------------------------------------------------
# Per-source backfill functions
# ---------------------------------------------------------------------------


def _run_seasons(
    seasons: list[int],
    source: str,
    kind: str,
    exists_fn: Callable[[int], bool],
    fetch_fn: Callable[[int], Path],
    report: BackfillReport,
    force: bool,
    verbose: bool,
) -> None:
    for season in seasons:
        label = f"{source}/{kind} {season}-{str(season + 1)[-2:]}"
        if not force and exists_fn(season):
            if verbose:
                print(f"  [skip] {label} — already present")
            report.results.append(SeasonResult(source, kind, season, skipped=True))
            continue
        print(f"  [fetch] {label} …", end="", flush=True)
        try:
            path = fetch_fn(season)
            print(f" ✓ {path}")
            report.results.append(SeasonResult(source, kind, season, output_path=path))
        except Exception:
            err = traceback.format_exc().strip().splitlines()[-1]
            print(f" ✗ {err}")
            report.results.append(SeasonResult(source, kind, season, error=err))


def backfill_bref_totals(
    first: int | None = None,
    last: int | None = None,
    *,
    force: bool = False,
    verbose: bool = True,
) -> BackfillReport:
    """Fetch bref season totals for all seasons in range."""
    seasons = bref_totals_seasons(
        first=first or 1946,
        last=last,
    )
    report = BackfillReport()
    print(f"\n[bref/season-totals] {seasons[0]}–{seasons[-1]} ({len(seasons)} seasons)")
    with BrefAdapter() as adapter:
        _run_seasons(
            seasons,
            source="bref",
            kind="player_season_totals",
            exists_fn=lambda s: _parquet_exists("bref", "player_season_totals", s),
            fetch_fn=lambda s: adapter.run_season_totals(s, verbose=False),
            report=report,
            force=force,
            verbose=verbose,
        )
    return report


def backfill_bref_advanced(
    first: int | None = None,
    last: int | None = None,
    *,
    force: bool = False,
    verbose: bool = True,
) -> BackfillReport:
    """Fetch bref advanced totals for seasons since the per-100 era (1979+)."""
    seasons = bref_advanced_seasons(
        first=first or 1979,
        last=last,
    )
    report = BackfillReport()
    print(f"\n[bref/advanced-totals] {seasons[0]}–{seasons[-1]} ({len(seasons)} seasons)")
    with BrefAdapter() as adapter:
        _run_seasons(
            seasons,
            source="bref",
            kind="player_season_advanced",
            exists_fn=lambda s: _parquet_exists("bref", "player_season_advanced", s),
            fetch_fn=lambda s: adapter.run_advanced_totals(s, verbose=False),
            report=report,
            force=force,
            verbose=verbose,
        )
    return report


def backfill_nba_stats(
    first: int | None = None,
    last: int | None = None,
    *,
    force: bool = False,
    verbose: bool = True,
) -> BackfillReport:
    """Fetch nba_stats box scores for all seasons since 1996."""
    seasons = nba_stats_seasons(
        first=first or 1996,
        last=last,
    )
    report = BackfillReport()
    print(f"\n[nba_stats/box-scores] {seasons[0]}–{seasons[-1]} ({len(seasons)} seasons)")
    adapter = NbaStatsAdapter()
    _run_seasons(
        seasons,
        source="nba_stats",
        kind="player_game_box",
        exists_fn=lambda s: _parquet_exists("nba_stats", "player_game_box", s),
        fetch_fn=lambda s: adapter.run_season(s, verbose=False)[0],
        report=report,
        force=force,
        verbose=verbose,
    )
    return report
