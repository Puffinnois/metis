"""T021 acceptance tests: fixture-based parser for the nba_stats adapter."""

import json
from datetime import UTC, datetime
from pathlib import Path

from pytest import approx as pytest_approx

from ingest.nba_stats.adapter import (
    SOURCE,
    parse_minutes,
    parse_player_row,
    parse_team_row,
    resultset_to_dicts,
    season_id,
    season_str,
)

_FIXTURE = Path(__file__).parent / "fixtures" / "nba_stats_box_score.json"


def _load_fixture() -> dict:  # type: ignore[type-arg]
    return json.loads(_FIXTURE.read_text())


def _fake_fetched_at() -> datetime:
    return datetime(2026, 1, 1, 12, 0, 0, tzinfo=UTC)


# ---------------------------------------------------------------------------
# Pure helper tests
# ---------------------------------------------------------------------------


def test_season_str() -> None:
    assert season_str(2024) == "2024-25"
    assert season_str(1996) == "1996-97"
    assert season_str(2000) == "2000-01"


def test_season_id_matches_season_str() -> None:
    assert season_id(2024) == "2024-25"


def test_parse_minutes_normal() -> None:
    assert parse_minutes("35:42") == pytest_approx(35 + 42 / 60)


def test_parse_minutes_zero() -> None:
    assert parse_minutes("0:00") == 0.0


def test_parse_minutes_none() -> None:
    assert parse_minutes(None) is None


def test_parse_minutes_empty() -> None:
    assert parse_minutes("") is None


# ---------------------------------------------------------------------------
# resultset_to_dicts
# ---------------------------------------------------------------------------


def test_resultset_to_dicts_player_stats() -> None:
    data = _load_fixture()
    player_rs = next(rs for rs in data["resultSets"] if rs["name"] == "PlayerStats")
    rows = resultset_to_dicts(player_rs)
    assert len(rows) == 4
    assert rows[0]["PLAYER_ID"] == 1629029
    assert rows[0]["TEAM_ABBREVIATION"] == "BOS"
    assert rows[0]["PTS"] == 25


def test_resultset_to_dicts_team_stats() -> None:
    data = _load_fixture()
    team_rs = next(rs for rs in data["resultSets"] if rs["name"] == "TeamStats")
    rows = resultset_to_dicts(team_rs)
    assert len(rows) == 2
    assert rows[0]["TEAM_ABBREVIATION"] == "BOS"
    assert rows[0]["PTS"] == 115


# ---------------------------------------------------------------------------
# parse_player_row
# ---------------------------------------------------------------------------


def test_parse_player_row_starter() -> None:
    data = _load_fixture()
    player_rs = next(rs for rs in data["resultSets"] if rs["name"] == "PlayerStats")
    row = resultset_to_dicts(player_rs)[0]  # Tatum — starter

    fetched_at = _fake_fetched_at()
    record = parse_player_row(
        row,
        game_id="NBA_0022400001",
        season_id_str="2024-25",
        season_type="Regular",
        fetched_at=fetched_at,
        source_url="https://stats.nba.com/stats/boxscoretraditionalv2?GameID=0022400001",
    )

    assert record["game_id"] == "NBA_0022400001"
    assert record["player_id"] == "NBA_1629029"
    assert record["team_id"] == "NBA_BOS"
    assert record["season_id"] == "2024-25"
    assert record["season_type"] == "Regular"
    assert record["starter"] is True
    assert abs(record["minutes_played"] - (35 + 42 / 60)) < 1e-6
    assert record["points"] == 25
    assert record["rebounds_total"] == 8
    assert record["assists"] == 5
    assert record["steals"] == 1
    assert record["blocks"] == 2
    assert record["turnovers"] == 2
    assert record["field_goals_made"] == 9
    assert record["field_goals_attempted"] == 20
    assert record["three_pointers_made"] == 3
    assert record["three_pointers_attempted"] == 9
    assert record["free_throws_made"] == 4
    assert record["free_throws_attempted"] == 5
    assert record["plus_minus"] == 5
    assert record["source"] == SOURCE
    assert record["fetched_at"] == fetched_at
    # source_payload is the JSON-serialised row
    payload = json.loads(record["source_payload"])
    assert payload["PLAYER_ID"] == 1629029


def test_parse_player_row_bench_dnp() -> None:
    """Bench/DNP row has no stats and starter=False."""
    data = _load_fixture()
    player_rs = next(rs for rs in data["resultSets"] if rs["name"] == "PlayerStats")
    row = resultset_to_dicts(player_rs)[3]  # RJ Barrett — DNP

    record = parse_player_row(
        row,
        game_id="NBA_0022400001",
        season_id_str="2024-25",
        season_type="Regular",
        fetched_at=_fake_fetched_at(),
        source_url="https://stats.nba.com/stats/boxscoretraditionalv2?GameID=0022400001",
    )

    assert record["starter"] is False
    assert record["points"] is None
    assert record["minutes_played"] == 0.0  # "0:00"


# ---------------------------------------------------------------------------
# parse_team_row
# ---------------------------------------------------------------------------


def test_parse_team_row_home() -> None:
    data = _load_fixture()
    team_rs = next(rs for rs in data["resultSets"] if rs["name"] == "TeamStats")
    row = resultset_to_dicts(team_rs)[0]  # BOS — home

    fetched_at = _fake_fetched_at()
    record = parse_team_row(
        row,
        game_id="NBA_0022400001",
        season_id_str="2024-25",
        season_type="Regular",
        is_home=True,
        opponent_team_id="NBA_NYK",
        fetched_at=fetched_at,
        source_url="https://stats.nba.com/stats/boxscoretraditionalv2?GameID=0022400001",
    )

    assert record["game_id"] == "NBA_0022400001"
    assert record["team_id"] == "NBA_BOS"
    assert record["opponent_team_id"] == "NBA_NYK"
    assert record["is_home"] is True
    assert record["points"] == 115
    assert record["rebounds_total"] == 40
    assert record["assists"] == 25
    assert record["field_goals_made"] == 45
    assert record["three_pointers_made"] == 15
    assert record["free_throws_made"] == 10
    # Columns not in TraditionalV2 must be None
    assert record["fast_break_points"] is None
    assert record["points_in_paint"] is None
    assert record["second_chance_points"] is None
    assert record["bench_points"] is None
    assert record["source"] == SOURCE
    payload = json.loads(record["source_payload"])
    assert payload["TEAM_ABBREVIATION"] == "BOS"


def test_parse_team_row_away() -> None:
    data = _load_fixture()
    team_rs = next(rs for rs in data["resultSets"] if rs["name"] == "TeamStats")
    row = resultset_to_dicts(team_rs)[1]  # NYK — away

    record = parse_team_row(
        row,
        game_id="NBA_0022400001",
        season_id_str="2024-25",
        season_type="Regular",
        is_home=False,
        opponent_team_id="NBA_BOS",
        fetched_at=_fake_fetched_at(),
        source_url="https://stats.nba.com/stats/boxscoretraditionalv2?GameID=0022400001",
    )

    assert record["team_id"] == "NBA_NYK"
    assert record["opponent_team_id"] == "NBA_BOS"
    assert record["is_home"] is False
    assert record["points"] == 110


# ---------------------------------------------------------------------------
# Column completeness
# ---------------------------------------------------------------------------

_EXPECTED_PLAYER_COLS = {
    "game_id", "player_id", "team_id", "season_id", "season_type",
    "starter", "minutes_played", "points", "rebounds_offensive",
    "rebounds_defensive", "rebounds_total", "assists", "steals", "blocks",
    "turnovers", "personal_fouls", "field_goals_made", "field_goals_attempted",
    "three_pointers_made", "three_pointers_attempted", "free_throws_made",
    "free_throws_attempted", "plus_minus",
    "source", "source_url", "fetched_at", "source_payload",
}

_EXPECTED_TEAM_COLS = {
    "game_id", "team_id", "opponent_team_id", "season_id", "season_type",
    "is_home", "points", "rebounds_offensive", "rebounds_defensive",
    "rebounds_total", "assists", "steals", "blocks", "turnovers",
    "personal_fouls", "field_goals_made", "field_goals_attempted",
    "three_pointers_made", "three_pointers_attempted", "free_throws_made",
    "free_throws_attempted", "fast_break_points", "points_in_paint",
    "second_chance_points", "bench_points",
    "source", "source_url", "fetched_at", "source_payload",
}


def test_player_row_has_all_schema_columns() -> None:
    data = _load_fixture()
    player_rs = next(rs for rs in data["resultSets"] if rs["name"] == "PlayerStats")
    row = resultset_to_dicts(player_rs)[0]
    record = parse_player_row(
        row,
        game_id="NBA_0022400001",
        season_id_str="2024-25",
        season_type="Regular",
        fetched_at=_fake_fetched_at(),
        source_url="https://example.com",
    )
    assert set(record.keys()) == _EXPECTED_PLAYER_COLS


def test_team_row_has_all_schema_columns() -> None:
    data = _load_fixture()
    team_rs = next(rs for rs in data["resultSets"] if rs["name"] == "TeamStats")
    row = resultset_to_dicts(team_rs)[0]
    record = parse_team_row(
        row,
        game_id="NBA_0022400001",
        season_id_str="2024-25",
        season_type="Regular",
        is_home=True,
        opponent_team_id="NBA_NYK",
        fetched_at=_fake_fetched_at(),
        source_url="https://example.com",
    )
    assert set(record.keys()) == _EXPECTED_TEAM_COLS
