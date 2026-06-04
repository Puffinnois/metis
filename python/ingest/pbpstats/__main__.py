"""CLI: python -m ingest.pbpstats <subcommand> [options]

Usage:
    python -m ingest.pbpstats fetch --season 2024
    python -m ingest.pbpstats fetch --season 2024 --season-type regular playoffs
"""

import argparse

from ingest.nba_stats.adapter import default_season
from ingest.pbpstats.adapter import _SEASON_TYPES, PbpStatsAdapter


def _cmd_fetch(args: argparse.Namespace) -> None:
    adapter = PbpStatsAdapter()
    poss_path, stint_path = adapter.run_season(
        args.season,
        season_types=tuple(args.season_type),
        verbose=True,
    )
    print("\nDone.")
    print(f"  possession    → {poss_path}")
    print(f"  lineup_stint  → {stint_path}")


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="python -m ingest.pbpstats",
        description="pbpstats ingestion adapter (data.nba.com enhanced PBP)",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    fetch = subparsers.add_parser(
        "fetch",
        help="Fetch possessions and lineup stints for one season",
    )
    fetch.add_argument(
        "--season",
        type=int,
        default=default_season(),
        metavar="YYYY",
        help=(
            "Start year of the season to fetch, e.g. 2024 for 2024-25 "
            f"(default: {default_season()})"
        ),
    )
    fetch.add_argument(
        "--season-type",
        nargs="+",
        choices=list(_SEASON_TYPES.keys()),
        default=["regular", "playoffs"],
        metavar="TYPE",
        help=(
            "Season type(s) to include. "
            f"Options: {', '.join(_SEASON_TYPES.keys())} (default: regular playoffs)"
        ),
    )
    fetch.set_defaults(func=_cmd_fetch)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
