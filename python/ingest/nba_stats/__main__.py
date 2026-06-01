"""CLI: python -m ingest.nba_stats <subcommand> [options]

Usage:
    python -m ingest.nba_stats box-scores --season 2024
"""

import argparse

from ingest.nba_stats.adapter import NbaStatsAdapter, default_season


def _cmd_box_scores(args: argparse.Namespace) -> None:
    adapter = NbaStatsAdapter()
    player_path, team_path = adapter.run_season(args.season, verbose=True)
    print("\nDone.")
    print(f"  player_game_box → {player_path}")
    print(f"  team_game_box   → {team_path}")


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="python -m ingest.nba_stats",
        description="NBA Stats ingestion adapter",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    box = subparsers.add_parser(
        "box-scores",
        help="Fetch regular-season box scores for one season",
    )
    box.add_argument(
        "--season",
        type=int,
        default=default_season(),
        metavar="YYYY",
        help=(
            "Start year of the season to fetch, e.g. 2024 for 2024-25 "
            f"(default: {default_season()})"
        ),
    )
    box.set_defaults(func=_cmd_box_scores)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
