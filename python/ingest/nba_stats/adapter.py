"""NBA Stats adapter — fetches box scores from stats.nba.com.

Calls stats.nba.com directly via RateLimitedSession, parsing the standard
resultSets JSON envelope rather than using nba_api's HTTP layer, so that
rate limiting and retry live entirely in ingest/_http.py.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

from ingest._http import RateLimitedSession
from ingest._parquet import write_parquet
from ingest.base import NormalizedRecord, RawRecord

SOURCE = "nba_stats"
_BASE_URL = "https://stats.nba.com/stats"
_HOST = "stats.nba.com"
_HOST_RPS: float = 0.6  # 1 request per ~1.7 s — conservative for stats.nba.com

# stats.nba.com refuses requests without these browser-like headers.
_NBA_HEADERS: dict[str, str] = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Connection": "keep-alive",
    "Origin": "https://www.nba.com",
    "Referer": "https://www.nba.com/",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "x-nba-stats-origin": "stats",
    "x-nba-stats-token": "true",
}


# ---------------------------------------------------------------------------
# Pure helpers — no I/O, easy to unit-test
# ---------------------------------------------------------------------------


def season_str(start_year: int) -> str:
    """Convert start year to nba_api season string, e.g. 2024 → '2024-25'."""
    return f"{start_year}-{str(start_year + 1)[2:]}"


def season_id(start_year: int) -> str:
    """Canonical season ID as stored in the DB, e.g. 2024 → '2024-25'."""
    return season_str(start_year)


def default_season() -> int:
    """Start year of the most recently completed NBA season.

    NBA playoffs conclude by mid-June.  Once we're past June, the season that
    started in (current_year - 1) is complete.  Before July, it's the season
    that started in (current_year - 2).
    """
    now = datetime.now()
    return now.year - 1 if now.month >= 7 else now.year - 2


def parse_minutes(min_str: str | None) -> float | None:
    """Parse 'MM:SS' to fractional minutes, e.g. '35:42' → 35.7."""
    if not min_str:
        return None
    parts = min_str.split(":")
    if len(parts) != 2:
        return None
    try:
        return int(parts[0]) + int(parts[1]) / 60.0
    except ValueError:
        return None


def resultset_to_dicts(result_set: dict[str, Any]) -> list[dict[str, Any]]:
    """Convert a resultSet (headers + rowSet) to a list of plain dicts."""
    headers: list[str] = result_set["headers"]
    rows: list[list[Any]] = result_set["rowSet"]
    return [dict(zip(headers, row, strict=False)) for row in rows]


def parse_player_row(
    row: dict[str, Any],
    *,
    game_id: str,
    season_id_str: str,
    season_type: str,
    fetched_at: datetime,
    source_url: str,
) -> NormalizedRecord:
    """Map one PlayerStats row to a player_game_box NormalizedRecord."""
    return {
        "game_id": game_id,
        "player_id": f"NBA_{row['PLAYER_ID']}",
        "team_id": f"NBA_{row['TEAM_ABBREVIATION']}",
        "season_id": season_id_str,
        "season_type": season_type,
        "starter": bool(row.get("START_POSITION")),  # "F"/"G"/"C" = starter, "" = bench
        "minutes_played": parse_minutes(row.get("MIN")),
        "points": row.get("PTS"),
        "rebounds_offensive": row.get("OREB"),
        "rebounds_defensive": row.get("DREB"),
        "rebounds_total": row.get("REB"),
        "assists": row.get("AST"),
        "steals": row.get("STL"),
        "blocks": row.get("BLK"),
        "turnovers": row.get("TO"),
        "personal_fouls": row.get("PF"),
        "field_goals_made": row.get("FGM"),
        "field_goals_attempted": row.get("FGA"),
        "three_pointers_made": row.get("FG3M"),
        "three_pointers_attempted": row.get("FG3A"),
        "free_throws_made": row.get("FTM"),
        "free_throws_attempted": row.get("FTA"),
        "plus_minus": row.get("PLUS_MINUS"),
        "source": SOURCE,
        "source_url": source_url,
        "fetched_at": fetched_at,
        "source_payload": json.dumps(row),
    }


def parse_team_row(
    row: dict[str, Any],
    *,
    game_id: str,
    season_id_str: str,
    season_type: str,
    is_home: bool,
    opponent_team_id: str,
    fetched_at: datetime,
    source_url: str,
) -> NormalizedRecord:
    """Map one TeamStats row to a team_game_box NormalizedRecord.

    fast_break_points, points_in_paint, second_chance_points, and bench_points
    are not available in BoxScoreTraditionalV2; they are stored as NULL so a
    later adapter (BoxScoreMiscV2 / BoxScoreScoringV2) can fill them in.
    """
    return {
        "game_id": game_id,
        "team_id": f"NBA_{row['TEAM_ABBREVIATION']}",
        "opponent_team_id": opponent_team_id,
        "season_id": season_id_str,
        "season_type": season_type,
        "is_home": is_home,
        "points": row.get("PTS"),
        "rebounds_offensive": row.get("OREB"),
        "rebounds_defensive": row.get("DREB"),
        "rebounds_total": row.get("REB"),
        "assists": row.get("AST"),
        "steals": row.get("STL"),
        "blocks": row.get("BLK"),
        "turnovers": row.get("TO"),
        "personal_fouls": row.get("PF"),
        "field_goals_made": row.get("FGM"),
        "field_goals_attempted": row.get("FGA"),
        "three_pointers_made": row.get("FG3M"),
        "three_pointers_attempted": row.get("FG3A"),
        "free_throws_made": row.get("FTM"),
        "free_throws_attempted": row.get("FTA"),
        "fast_break_points": None,
        "points_in_paint": None,
        "second_chance_points": None,
        "bench_points": None,
        "source": SOURCE,
        "source_url": source_url,
        "fetched_at": fetched_at,
        "source_payload": json.dumps(row),
    }


# ---------------------------------------------------------------------------
# Adapter class
# ---------------------------------------------------------------------------


class NbaStatsAdapter:
    """Ingestion adapter for stats.nba.com.

    Uses RateLimitedSession for all HTTP so rate limiting and retry are
    centralised in ingest/_http.py.  The primary entry point for T021 is
    run_season(); fetch/parse/write implement the Adapter protocol for
    single-entity use.
    """

    source: str = SOURCE

    def __init__(self, rps: float = _HOST_RPS) -> None:
        self._session = RateLimitedSession(
            host_rps={_HOST: rps},
            extra_headers=_NBA_HEADERS,
        )

    def _get(
        self, endpoint: str, params: dict[str, Any]
    ) -> tuple[dict[str, Any], datetime, str]:
        """GET a stats.nba.com endpoint; return (json_body, fetched_at, url)."""
        url = f"{_BASE_URL}/{endpoint}?{urlencode(params)}"
        fetched_at = datetime.now(UTC)
        resp = self._session.get(url)
        resp.raise_for_status()
        data: dict[str, Any] = resp.json()
        return data, fetched_at, url

    def _fetch_game_ids(self, start_year: int) -> list[dict[str, Any]]:
        """Return metadata for every regular-season game in the given season.

        Each dict has: game_id, raw_game_id, home_team_abbr, away_team_abbr.
        """
        data, _, _ = self._get(
            "leaguegamelog",
            {
                "Direction": "ASC",
                "LeagueID": "00",
                "PlayerOrTeam": "T",
                "Season": season_str(start_year),
                "SeasonType": "Regular Season",
                "Sorter": "DATE",
            },
        )
        rows = resultset_to_dicts(data["resultSets"][0])

        games: dict[str, dict[str, Any]] = {}
        for row in rows:
            gid: str = row["GAME_ID"]
            if gid not in games:
                games[gid] = {
                    "raw_game_id": gid,
                    "game_id": f"NBA_{gid}",
                    "home_team_abbr": None,
                    "away_team_abbr": None,
                }
            matchup: str = row["MATCHUP"]
            abbr: str = row["TEAM_ABBREVIATION"]
            if " vs. " in matchup:
                games[gid]["home_team_abbr"] = abbr
            else:
                games[gid]["away_team_abbr"] = abbr

        return list(games.values())

    def _fetch_box_score(
        self, raw_game_id: str
    ) -> tuple[dict[str, Any], datetime, str]:
        """Fetch BoxScoreTraditionalV2 for one game."""
        return self._get(
            "boxscoretraditionalv2",
            {
                "GameID": raw_game_id,
                "EndPeriod": 0,
                "EndRange": 0,
                "RangeType": 0,
                "StartPeriod": 0,
                "StartRange": 0,
            },
        )

    # ------------------------------------------------------------------
    # Adapter protocol
    # ------------------------------------------------------------------

    def fetch(self, entity: str, params: dict[str, Any]) -> list[RawRecord]:
        """Fetch enriched raw records for all regular-season games.

        Args:
            entity: 'player_game_box' or 'team_game_box'
            params: {'season': int}  (start year, e.g. 2024 for 2024-25)

        Each returned RawRecord includes the API row plus the metadata needed
        by parse() to produce a NormalizedRecord.
        """
        start_year: int = params["season"]
        sid = season_id(start_year)
        game_metas = self._fetch_game_ids(start_year)

        records: list[RawRecord] = []
        for meta in game_metas:
            data, fetched_at, url = self._fetch_box_score(meta["raw_game_id"])
            result_sets = {rs["name"]: rs for rs in data["resultSets"]}

            if entity == "player_game_box":
                for row in resultset_to_dicts(result_sets["PlayerStats"]):
                    records.append(
                        {
                            "_type": "player",
                            "row": row,
                            "game_id": meta["game_id"],
                            "season_id": sid,
                            "season_type": "Regular",
                            "fetched_at": fetched_at,
                            "source_url": url,
                        }
                    )
            elif entity == "team_game_box":
                home_abbr: str | None = meta["home_team_abbr"]
                away_abbr: str | None = meta["away_team_abbr"]
                for row in resultset_to_dicts(result_sets["TeamStats"]):
                    abbr: str = row["TEAM_ABBREVIATION"]
                    is_home = abbr == home_abbr
                    opp_abbr = away_abbr if is_home else home_abbr
                    records.append(
                        {
                            "_type": "team",
                            "row": row,
                            "game_id": meta["game_id"],
                            "season_id": sid,
                            "season_type": "Regular",
                            "is_home": is_home,
                            "opponent_team_id": f"NBA_{opp_abbr}",
                            "fetched_at": fetched_at,
                            "source_url": url,
                        }
                    )

        return records

    def parse(self, raw: RawRecord) -> NormalizedRecord:
        """Normalize one enriched RawRecord into a NormalizedRecord."""
        row_type: str = raw["_type"]
        if row_type == "player":
            return parse_player_row(
                raw["row"],
                game_id=raw["game_id"],
                season_id_str=raw["season_id"],
                season_type=raw["season_type"],
                fetched_at=raw["fetched_at"],
                source_url=raw["source_url"],
            )
        if row_type == "team":
            return parse_team_row(
                raw["row"],
                game_id=raw["game_id"],
                season_id_str=raw["season_id"],
                season_type=raw["season_type"],
                is_home=raw["is_home"],
                opponent_team_id=raw["opponent_team_id"],
                fetched_at=raw["fetched_at"],
                source_url=raw["source_url"],
            )
        raise ValueError(f"unknown row type: {row_type!r}")

    def write(self, records: list[NormalizedRecord], season: int) -> Path:
        """Write player_game_box records to Parquet (Adapter protocol)."""
        return write_parquet(
            records, source=SOURCE, entity="player_game_box", season=season
        )

    def write_team(self, records: list[NormalizedRecord], season: int) -> Path:
        """Write team_game_box records to Parquet."""
        return write_parquet(
            records, source=SOURCE, entity="team_game_box", season=season
        )

    # ------------------------------------------------------------------
    # Orchestrated season pipeline
    # ------------------------------------------------------------------

    def run_season(
        self, season: int, *, verbose: bool = False
    ) -> tuple[Path, Path]:
        """Fetch all regular-season box scores and write two Parquet files.

        Returns:
            (player_parquet_path, team_parquet_path)
        """
        sid = season_id(season)

        if verbose:
            print(f"Fetching game list for {sid}...")

        game_metas = self._fetch_game_ids(season)
        total = len(game_metas)

        if verbose:
            print(f"Found {total} games. Fetching box scores at ~{_HOST_RPS} req/s...")

        player_records: list[NormalizedRecord] = []
        team_records: list[NormalizedRecord] = []

        for i, meta in enumerate(game_metas):
            if verbose and (i + 1) % 50 == 0:
                print(f"  {i + 1}/{total} games processed...")

            data, fetched_at, url = self._fetch_box_score(meta["raw_game_id"])
            result_sets = {rs["name"]: rs for rs in data["resultSets"]}

            for row in resultset_to_dicts(result_sets["PlayerStats"]):
                player_records.append(
                    parse_player_row(
                        row,
                        game_id=meta["game_id"],
                        season_id_str=sid,
                        season_type="Regular",
                        fetched_at=fetched_at,
                        source_url=url,
                    )
                )

            home_abbr: str | None = meta["home_team_abbr"]
            away_abbr: str | None = meta["away_team_abbr"]
            for row in resultset_to_dicts(result_sets["TeamStats"]):
                abbr: str = row["TEAM_ABBREVIATION"]
                is_home = abbr == home_abbr
                opp_abbr = away_abbr if is_home else home_abbr
                team_records.append(
                    parse_team_row(
                        row,
                        game_id=meta["game_id"],
                        season_id_str=sid,
                        season_type="Regular",
                        is_home=is_home,
                        opponent_team_id=f"NBA_{opp_abbr}",
                        fetched_at=fetched_at,
                        source_url=url,
                    )
                )

        if verbose:
            print(
                f"Writing {len(player_records)} player rows, "
                f"{len(team_records)} team rows..."
            )

        player_path = write_parquet(
            player_records, source=SOURCE, entity="player_game_box", season=season
        )
        team_path = write_parquet(
            team_records, source=SOURCE, entity="team_game_box", season=season
        )

        if verbose:
            print(f"  player_game_box → {player_path}")
            print(f"  team_game_box   → {team_path}")

        return player_path, team_path
