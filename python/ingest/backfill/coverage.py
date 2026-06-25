"""Season coverage ranges per source, matching CLAUDE.md coverage policy.

Season integers are *start years* (e.g. 1996 = 1996-97 season).

Source coverage:
  bref        1946 – present  (box scores + advanced totals where available)
  nba_stats   1996 – present  (box scores, per-game stats, play-by-play era)

The bref advanced stats parser is only meaningful from ~1979 (when per-100
possession data became available in the books).  Earlier seasons get totals
only.
"""

from __future__ import annotations

from datetime import datetime


def _current_completed_season() -> int:
    """Start year of the most recently completed NBA season."""
    now = datetime.now()
    return now.year - 1 if now.month >= 7 else now.year - 2


# Inclusive start years for each source.
BREF_TOTALS_FIRST_SEASON: int = 1946
BREF_ADVANCED_FIRST_SEASON: int = 1979  # per-100 possession era
NBA_STATS_FIRST_SEASON: int = 1996       # nba_api coverage


def bref_totals_seasons(
    first: int = BREF_TOTALS_FIRST_SEASON,
    last: int | None = None,
) -> list[int]:
    """Return start years for bref season-totals backfill (ascending)."""
    return list(range(first, (last or _current_completed_season()) + 1))


def bref_advanced_seasons(
    first: int = BREF_ADVANCED_FIRST_SEASON,
    last: int | None = None,
) -> list[int]:
    """Return start years for bref advanced-totals backfill (ascending)."""
    return list(range(first, (last or _current_completed_season()) + 1))


def nba_stats_seasons(
    first: int = NBA_STATS_FIRST_SEASON,
    last: int | None = None,
) -> list[int]:
    """Return start years for nba_stats box-score backfill (ascending)."""
    return list(range(first, (last or _current_completed_season()) + 1))
