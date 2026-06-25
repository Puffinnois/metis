"""CLI: python -m ingest.backfill <source> [options]

Usage:
    python -m ingest.backfill bref-totals
    python -m ingest.backfill bref-advanced --first 1990
    python -m ingest.backfill nba-stats --first 2000 --last 2010
    python -m ingest.backfill all --force

Each run is resumable: seasons whose Parquet partition already exists are
skipped automatically.  Use --force to re-fetch everything.

Rate notes:
  bref      ≤1 req/3s (robots.txt Crawl-delay: 3) — ~3 min per season
  nba_stats varies — uses nba_api built-in rate limiting
"""

from __future__ import annotations

import argparse
import sys

from ingest.backfill.coverage import (
    BREF_ADVANCED_FIRST_SEASON,
    BREF_TOTALS_FIRST_SEASON,
    NBA_STATS_FIRST_SEASON,
    _current_completed_season,
)
from ingest.backfill.runner import (
    BackfillReport,
    backfill_bref_advanced,
    backfill_bref_totals,
    backfill_nba_stats,
)

_DEFAULT_LAST = _current_completed_season()


def _add_range_args(parser: argparse.ArgumentParser, default_first: int) -> None:
    parser.add_argument(
        "--first",
        type=int,
        default=default_first,
        metavar="YYYY",
        help=f"First season start year (default: {default_first})",
    )
    parser.add_argument(
        "--last",
        type=int,
        default=_DEFAULT_LAST,
        metavar="YYYY",
        help=f"Last season start year (default: {_DEFAULT_LAST}, most recent complete season)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-fetch seasons even when Parquet output already exists",
    )


def _cmd_bref_totals(args: argparse.Namespace) -> BackfillReport:
    return backfill_bref_totals(first=args.first, last=args.last, force=args.force)


def _cmd_bref_advanced(args: argparse.Namespace) -> BackfillReport:
    return backfill_bref_advanced(first=args.first, last=args.last, force=args.force)


def _cmd_nba_stats(args: argparse.Namespace) -> BackfillReport:
    return backfill_nba_stats(first=args.first, last=args.last, force=args.force)


def _cmd_all(args: argparse.Namespace) -> BackfillReport:
    combined = BackfillReport()
    for fn in (backfill_bref_totals, backfill_bref_advanced, backfill_nba_stats):
        kwargs: dict = {"force": args.force}
        if hasattr(args, "first"):
            kwargs["first"] = None  # use each source's natural start
        r = fn(**kwargs)
        combined.results.extend(r.results)
    return combined


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="python -m ingest.backfill",
        description=(
            "Backfill ingestion for all seasons per coverage policy.\n\n"
            "Each run is resumable — already-present Parquet partitions are skipped.\n"
            "WARNING: a full bref backfill (~80 seasons × ~3 min) takes several hours."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    subs = parser.add_subparsers(dest="command", required=True)

    # bref-totals
    p_bref_totals = subs.add_parser(
        "bref-totals",
        help=f"bref season totals ({BREF_TOTALS_FIRST_SEASON}–present)",
    )
    _add_range_args(p_bref_totals, BREF_TOTALS_FIRST_SEASON)
    p_bref_totals.set_defaults(func=_cmd_bref_totals)

    # bref-advanced
    p_bref_adv = subs.add_parser(
        "bref-advanced",
        help=f"bref advanced totals ({BREF_ADVANCED_FIRST_SEASON}–present, per-100 era)",
    )
    _add_range_args(p_bref_adv, BREF_ADVANCED_FIRST_SEASON)
    p_bref_adv.set_defaults(func=_cmd_bref_advanced)

    # nba-stats
    p_nba = subs.add_parser(
        "nba-stats",
        help=f"nba_stats box scores ({NBA_STATS_FIRST_SEASON}–present)",
    )
    _add_range_args(p_nba, NBA_STATS_FIRST_SEASON)
    p_nba.set_defaults(func=_cmd_nba_stats)

    # all
    p_all = subs.add_parser(
        "all",
        help="Run all three sources back-to-back (bref-totals → bref-advanced → nba-stats)",
    )
    p_all.add_argument(
        "--force",
        action="store_true",
        help="Re-fetch even when output already exists",
    )
    p_all.set_defaults(func=_cmd_all)

    args = parser.parse_args()
    report = args.func(args)
    report.print_summary()
    sys.exit(1 if report.failed else 0)


if __name__ == "__main__":
    main()
