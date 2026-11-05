"""CLI: python -m ingest.bref <subcommand> [options]

Usage:
    python -m ingest.bref season-totals --season 2024
    python -m ingest.bref advanced-totals --season 2024
"""

import argparse
from datetime import datetime

from ingest.bref.adapter import BrefAdapter


def _default_season() -> int:
    """Start year of the most recently completed NBA season."""
    now = datetime.now()
    return now.year - 1 if now.month >= 7 else now.year - 2


def _cmd_season_totals(args: argparse.Namespace) -> None:
    with BrefAdapter() as adapter:
        path = adapter.run_season_totals(args.season, verbose=True)
    print("\nDone.")
    print(f"  player_season_totals → {path}")


def _cmd_advanced_totals(args: argparse.Namespace) -> None:
    with BrefAdapter() as adapter:
        path = adapter.run_advanced_totals(args.season, verbose=True)
    print("\nDone.")
    print(f"  player_season_advanced → {path}")


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="python -m ingest.bref",
        description="Basketball-Reference ingestion adapter",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    _default = _default_season()

    totals = subparsers.add_parser(
        "season-totals",
        help="Fetch per-season player totals for one season",
    )
    totals.add_argument(
        "--season",
        type=int,
        default=_default,
        metavar="YYYY",
        help=f"Start year of the season to fetch, e.g. 2024 for 2024-25 (default: {_default})",
    )
    totals.set_defaults(func=_cmd_season_totals)

    advanced = subparsers.add_parser(
        "advanced-totals",
        help="Fetch per-season player advanced stats for one season",
    )
    advanced.add_argument(
        "--season",
        type=int,
        default=_default,
        metavar="YYYY",
        help=f"Start year of the season to fetch, e.g. 2024 for 2024-25 (default: {_default})",
    )
    advanced.set_defaults(func=_cmd_advanced_totals)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
