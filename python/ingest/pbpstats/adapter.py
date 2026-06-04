"""pbpstats adapter — fetches possessions and lineup stints from data.nba.com.

Uses pbpstats's DataNbaPossessionLoader (data.nba.com enhanced PBP feed) for
per-game possession and lineup data. Game IDs come from stats.nba.com via
pbpstats's StatsNbaLeagueGameLogLoader.

pbpstats manages its own HTTP client internally. We enforce rate limiting by
sleeping _INTER_GAME_SLEEP seconds between game fetches in the orchestrator.
"""

from __future__ import annotations

import json
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from pbpstats.data_loader import (
    DataNbaPossessionLoader,
    DataNbaPossessionWebLoader,
    StatsNbaLeagueGameLogLoader,
    StatsNbaLeagueGameLogWebLoader,
)

from ingest._parquet import write_parquet
from ingest.base import NormalizedRecord, RawRecord

SOURCE = "pbpstats"

# Polite inter-game sleep — pbpstats uses its own requests.Session internally.
_INTER_GAME_SLEEP: float = 3.0

# pbpstats season-type strings
_SEASON_TYPES: dict[str, str] = {
    "regular": "Regular Season",
    "playoffs": "Playoffs",
    "play_in": "Play In",
}


# ---------------------------------------------------------------------------
# Pure helpers — no I/O, easy to unit-test
# ---------------------------------------------------------------------------


def season_str(start_year: int) -> str:
    """Convert start year to season string, e.g. 2024 → '2024-25'."""
    return f"{start_year}-{str(start_year + 1)[2:]}"


def clock_to_seconds(clock: str) -> float:
    """Convert 'MM:SS.S' clock string to seconds remaining in period."""
    parts = clock.split(":")
    return float(parts[0]) * 60 + float(parts[1])


def team_id_str(numeric_id: int) -> str:
    """Format a pbpstats numeric team ID as a namespaced string."""
    return f"NBA_{numeric_id}"


def player_id_str(numeric_id: int) -> str:
    """Format a pbpstats numeric player ID as a namespaced string."""
    return f"NBA_{numeric_id}"


def possession_points(possession: Any) -> int:
    """Points scored by the offense team during this possession.

    Derived from the score delta between the start and end of the possession
    so it is independent of possession_stats stat_key string constants.
    """
    offense_id = possession.offense_team_id
    end_score = possession.events[-1].score
    prev = getattr(possession, "previous_possession", None)
    start_score = prev.events[-1].score if prev is not None else possession.events[0].score
    return int(max(0, end_score[offense_id] - start_score[offense_id]))


def start_lineup_ids(possession: Any) -> dict[int, str]:
    """Return {team_id: lineup_id_string} at the start of the possession.

    lineup_id strings are hyphen-separated sorted player ID strings as
    produced by pbpstats (e.g. '203500-1628384-1629029-1630567-203952').
    Returns an empty dict if lineup data is unavailable for this event.
    """
    try:
        return dict(possession.events[0].lineup_ids)
    except (AttributeError, TypeError):
        return {}


def possession_start_type_safe(possession: Any) -> str | None:
    """Return possession_start_type without raising on edge-case possessions."""
    try:
        return str(possession.possession_start_type)
    except (AttributeError, TypeError, IndexError):
        return None


def parse_possession_record(
    possession: Any,
    *,
    global_possession_num: int,
    raw_game_id: str,
    season_id_str: str,
    season_type: str,
    fetched_at: datetime,
    source_url: str,
) -> NormalizedRecord:
    """Map one pbpstats Possession to a NormalizedRecord for the possession entity."""
    game_id = f"NBA_{raw_game_id}"
    offense_team_id = possession.offense_team_id
    team_ids = possession.get_team_ids()
    defense_team_id = next((t for t in team_ids if t != offense_team_id), None)

    start_clock = possession.start_time
    end_clock = possession.end_time
    start_secs = clock_to_seconds(start_clock) if start_clock else None
    end_secs = clock_to_seconds(end_clock) if end_clock else None
    duration = (
        (start_secs - end_secs) if (start_secs is not None and end_secs is not None) else None
    )

    lineups = start_lineup_ids(possession)
    offense_lineup = lineups.get(offense_team_id)
    defense_lineup = lineups.get(defense_team_id) if defense_team_id else None

    try:
        score_margin = possession.start_score_margin
    except (AttributeError, TypeError, KeyError):
        score_margin = None

    payload: dict[str, Any] = {
        "game_id": raw_game_id,
        "period": possession.period,
        "possession_number": possession.number,
        "offense_team_id": offense_team_id,
        "defense_team_id": defense_team_id,
        "start_time": start_clock,
        "end_time": end_clock,
        "start_score_margin": score_margin,
        "possession_start_type": possession_start_type_safe(possession),
        "num_events": len(possession.events),
    }

    return {
        "game_id": game_id,
        "period": possession.period,
        "possession_num": possession.number,
        "global_possession_num": global_possession_num,
        "offense_team_id": team_id_str(offense_team_id),
        "defense_team_id": team_id_str(defense_team_id) if defense_team_id is not None else None,
        "start_time_remaining": start_secs,
        "end_time_remaining": end_secs,
        "duration_seconds": duration,
        "score_margin": score_margin,
        "possession_start_type": possession_start_type_safe(possession),
        "points_scored": possession_points(possession),
        "offense_lineup_id": offense_lineup,
        "defense_lineup_id": defense_lineup,
        "num_events": len(possession.events),
        "season_id": season_id_str,
        "season_type": season_type,
        "source": SOURCE,
        "source_url": source_url,
        "fetched_at": fetched_at,
        "source_payload": json.dumps(payload),
    }


def _derive_lineup_stints(
    possessions: list[Any],
    *,
    raw_game_id: str,
    season_id_str: str,
    season_type: str,
    fetched_at: datetime,
    source_url: str,
) -> list[NormalizedRecord]:
    """Derive lineup stint records from a sequence of possession objects.

    A lineup stint is a maximal run of consecutive possessions (within a period)
    in which a team's 5-player unit remains unchanged. Stints are produced for
    every team in the game. Since both teams' lineups are tracked per possession,
    a period boundary or substitution affecting either team creates new stints
    for both teams.

    Stats accumulated per stint:
        possessions_offense, possessions_defense, points_for, points_against,
        plus_minus, duration_seconds.
    """
    if not possessions:
        return []

    game_id = f"NBA_{raw_game_id}"
    stints: list[NormalizedRecord] = []

    # Active stint state per team_id.
    # Values: {players: str, period: int, start_secs: float, end_secs: float,
    #          poss_off: int, poss_def: int, pts_for: int, pts_against: int}
    active: dict[int, dict[str, Any]] = {}

    def _close_stint(team_id: int) -> None:
        s = active.pop(team_id, None)
        if s is None:
            return
        player_ids = [pid.strip() for pid in s["players"].split("-")]
        # Sort ensures canonical ordering (pbpstats already sorts, but be explicit).
        player_ids = sorted(player_ids)
        padded: list[str | None] = player_ids + [None] * (5 - len(player_ids))

        stints.append(
            {
                "game_id": game_id,
                "period": s["period"],
                "team_id": team_id_str(team_id),
                "player1_id": f"NBA_{padded[0]}" if padded[0] else None,
                "player2_id": f"NBA_{padded[1]}" if padded[1] else None,
                "player3_id": f"NBA_{padded[2]}" if padded[2] else None,
                "player4_id": f"NBA_{padded[3]}" if padded[3] else None,
                "player5_id": f"NBA_{padded[4]}" if padded[4] else None,
                # lineup_id retains the raw pbpstats hyphen-separated numeric format so
                # it joins naturally against offense_lineup_id / defense_lineup_id on
                # possession records. Individual player{N}_id fields use the NBA_ prefix
                # to reference the player dimension table.
                "lineup_id": s["players"],
                "start_time_remaining": s["start_secs"],
                "end_time_remaining": s["end_secs"],
                "duration_seconds": (
                    s["start_secs"] - s["end_secs"]
                    if s["start_secs"] is not None and s["end_secs"] is not None
                    else None
                ),
                "possessions_offense": s["poss_off"],
                "possessions_defense": s["poss_def"],
                "points_for": s["pts_for"],
                "points_against": s["pts_against"],
                "plus_minus": s["pts_for"] - s["pts_against"],
                "season_id": season_id_str,
                "season_type": season_type,
                "source": SOURCE,
                "source_url": source_url,
                "fetched_at": fetched_at,
                "source_payload": json.dumps(
                    {
                        "game_id": raw_game_id,
                        "team_id": team_id,
                        "period": s["period"],
                        "lineup_id": s["players"],
                    }
                ),
            }
        )

    def _open_stint(team_id: int, lineup_id: str, period: int, start_secs: float | None) -> None:
        active[team_id] = {
            "players": lineup_id,
            "period": period,
            "start_secs": start_secs,
            "end_secs": start_secs,
            "poss_off": 0,
            "poss_def": 0,
            "pts_for": 0,
            "pts_against": 0,
        }

    for possession in possessions:
        period = possession.period
        lineups = start_lineup_ids(possession)
        if not lineups:
            continue

        offense_id = possession.offense_team_id
        team_ids = possession.get_team_ids()
        defense_id = next((t for t in team_ids if t != offense_id), None)

        start_clock = possession.start_time
        end_clock = possession.end_time
        start_secs = clock_to_seconds(start_clock) if start_clock else None
        end_secs = clock_to_seconds(end_clock) if end_clock else None

        pts = possession_points(possession)

        # Pass 1: open or rotate stints for all teams so active[] is complete.
        for team_id, lineup_id in lineups.items():
            cur = active.get(team_id)
            period_changed = cur is not None and cur["period"] != period
            lineup_changed = cur is not None and cur["players"] != lineup_id
            if period_changed or lineup_changed:
                _close_stint(team_id)
                cur = None
            if cur is None:
                _open_stint(team_id, lineup_id, period, start_secs)
            active[team_id]["end_secs"] = end_secs

        # Pass 2: accumulate stats now that all stints are open.
        if offense_id in active:
            active[offense_id]["poss_off"] += 1
            active[offense_id]["pts_for"] += pts
        if defense_id is not None and defense_id in active:
            active[defense_id]["poss_def"] += 1
            active[defense_id]["pts_against"] += pts

    # Close all open stints at end of game.
    for team_id in list(active.keys()):
        _close_stint(team_id)

    return stints


# ---------------------------------------------------------------------------
# Adapter class
# ---------------------------------------------------------------------------


class PbpStatsAdapter:
    """Ingestion adapter for pbpstats (data.nba.com enhanced PBP).

    Fetches possession-level data and derives lineup stints for one season.
    The primary entry point is run_season(); fetch/parse/write implement the
    Adapter protocol for single-entity use.

    pbpstats uses its own requests.Session internally. Rate limiting between
    game fetches is enforced by sleeping _INTER_GAME_SLEEP seconds in the
    orchestrator rather than wrapping the session.
    """

    source: str = SOURCE

    def _game_ids_for_season(
        self, start_year: int, season_type_strings: list[str]
    ) -> list[dict[str, Any]]:
        """Return metadata for every game matching the given season types.

        Each dict has keys: raw_game_id.
        Duplicates are removed (a game cannot appear in multiple season types).
        """
        seen: set[str] = set()
        games: list[dict[str, Any]] = []
        source_loader = StatsNbaLeagueGameLogWebLoader()
        for st in season_type_strings:
            loader = StatsNbaLeagueGameLogLoader("nba", season_str(start_year), st, source_loader)
            for item in loader.items:
                gid: str = item.game_id
                if gid not in seen:
                    seen.add(gid)
                    games.append({"raw_game_id": gid})
        games.sort(key=lambda g: g["raw_game_id"])
        return games

    def _fetch_possessions(self, raw_game_id: str) -> tuple[list[Any], str]:
        """Load possessions for one game; return (possessions, source_url).

        source_url is the data.nba.com PBP endpoint for provenance.
        """
        source_loader = DataNbaPossessionWebLoader()
        loader = DataNbaPossessionLoader(raw_game_id, source_loader)
        # Build the URL that pbpstats fetched so we can store it for provenance.
        # DataNbaPbpWebLoader sets self.url after load_data(); we reconstruct it.
        season_year = (
            "19" + raw_game_id[3] + raw_game_id[4]
            if raw_game_id[3] == "9"
            else "20" + raw_game_id[3] + raw_game_id[4]
        )
        url = (
            f"https://data.nba.com/data/v2015/json/mobile_teams/nba/"
            f"{season_year}/scores/pbp/{raw_game_id}_full_pbp.json"
        )
        return loader.items, url

    # ------------------------------------------------------------------
    # Adapter protocol
    # ------------------------------------------------------------------

    def fetch(self, entity: str, params: dict[str, Any]) -> list[RawRecord]:
        """Fetch enriched raw records for all games in the season.

        Args:
            entity: 'possession' or 'lineup_stint'
            params: {
                'season': int,             # start year, e.g. 2024 for 2024-25
                'season_types': list[str], # subset of ('regular', 'playoffs', 'play_in')
            }

        Returns one RawRecord per game (containing all possessions for that game),
        to avoid holding the full season in memory before parse().
        """
        start_year: int = params["season"]
        season_type_strs = [_SEASON_TYPES[st] for st in params.get("season_types", ["regular"])]
        sid = season_str(start_year)
        game_metas = self._game_ids_for_season(start_year, season_type_strs)

        records: list[RawRecord] = []
        for i, meta in enumerate(game_metas):
            if i > 0:
                time.sleep(_INTER_GAME_SLEEP)
            possessions, url = self._fetch_possessions(meta["raw_game_id"])
            records.append(
                {
                    "_entity": entity,
                    "raw_game_id": meta["raw_game_id"],
                    "possessions": possessions,
                    "season_id": sid,
                    "season_types": params.get("season_types", ["regular"]),
                    "fetched_at": datetime.now(UTC),
                    "source_url": url,
                }
            )
        return records

    def parse(self, raw: RawRecord) -> NormalizedRecord:
        """Not meaningful for pbpstats: one RawRecord contains many possessions.

        Use run_season() for bulk processing. This method is provided only to
        satisfy the Adapter protocol and returns the raw dict unchanged.
        """
        return dict(raw)

    def write(self, records: list[NormalizedRecord], season: int) -> Path:
        """Write possession records to Parquet (Adapter protocol)."""
        return write_parquet(records, source=SOURCE, entity="possession", season=season)

    def write_lineup_stints(self, records: list[NormalizedRecord], season: int) -> Path:
        """Write lineup_stint records to Parquet."""
        return write_parquet(records, source=SOURCE, entity="lineup_stint", season=season)

    # ------------------------------------------------------------------
    # Orchestrated season pipeline
    # ------------------------------------------------------------------

    def run_season(
        self,
        season: int,
        *,
        season_types: tuple[str, ...] = ("regular", "playoffs"),
        verbose: bool = False,
    ) -> tuple[Path, Path]:
        """Fetch all possessions and derive lineup stints; write two Parquet files.

        Args:
            season: Start year of the season, e.g. 2024 for 2024-25.
            season_types: Season types to include. Options: 'regular', 'playoffs', 'play_in'.
            verbose: Print progress to stdout.

        Returns:
            (possession_parquet_path, lineup_stint_parquet_path)
        """
        sid = season_str(season)
        season_type_strs = [_SEASON_TYPES[st] for st in season_types]

        if verbose:
            print(f"Fetching game list for {sid} ({', '.join(season_type_strs)})...")

        game_metas = self._game_ids_for_season(season, season_type_strs)
        total = len(game_metas)

        if verbose:
            print(
                f"Found {total} games. Fetching possessions at "
                f"~{1 / _INTER_GAME_SLEEP:.2f} req/s..."
            )

        possession_records: list[NormalizedRecord] = []
        lineup_stint_records: list[NormalizedRecord] = []
        global_poss_num = 0

        for i, meta in enumerate(game_metas):
            if i > 0:
                time.sleep(_INTER_GAME_SLEEP)

            if verbose and (i + 1) % 20 == 0:
                print(f"  {i + 1}/{total} games processed...")

            raw_game_id = meta["raw_game_id"]
            # Season type is encoded in game_id characters 2-3 (00=regular, 40=playoffs).
            game_season_type = _season_type_from_game_id(raw_game_id)
            fetched_at = datetime.now(UTC)

            try:
                possessions, url = self._fetch_possessions(raw_game_id)
            except Exception as exc:  # noqa: BLE001
                if verbose:
                    print(f"  WARNING: skipping {raw_game_id} — {exc}")
                continue

            for poss in possessions:
                try:
                    global_poss_num += 1
                    possession_records.append(
                        parse_possession_record(
                            poss,
                            global_possession_num=global_poss_num,
                            raw_game_id=raw_game_id,
                            season_id_str=sid,
                            season_type=game_season_type,
                            fetched_at=fetched_at,
                            source_url=url,
                        )
                    )
                except Exception as exc:  # noqa: BLE001
                    if verbose:
                        print(f"  WARNING: skipping possession in {raw_game_id} — {exc}")

            stints = _derive_lineup_stints(
                possessions,
                raw_game_id=raw_game_id,
                season_id_str=sid,
                season_type=game_season_type,
                fetched_at=fetched_at,
                source_url=url,
            )
            lineup_stint_records.extend(stints)

        if verbose:
            print(
                f"Writing {len(possession_records)} possession rows, "
                f"{len(lineup_stint_records)} lineup stint rows..."
            )

        poss_path = write_parquet(
            possession_records, source=SOURCE, entity="possession", season=season
        )
        stint_path = write_parquet(
            lineup_stint_records, source=SOURCE, entity="lineup_stint", season=season
        )

        if verbose:
            print(f"  possession    → {poss_path}")
            print(f"  lineup_stint  → {stint_path}")

        return poss_path, stint_path


def _season_type_from_game_id(game_id: str) -> str:
    """Derive a human-readable season type from the NBA game ID prefix.

    NBA game ID format: 002YYXXXXX = regular season, 004YYXXXXX = playoffs,
    005YYXXXXX = play-in.
    """
    prefix = game_id[2:3]
    return {"2": "Regular", "4": "Playoffs", "5": "PlayIn"}.get(prefix, "Unknown")
