"""T050 acceptance tests: fixture-based parser for the pbpstats adapter."""

import json
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path

from ingest.pbpstats.adapter import (
    SOURCE,
    _derive_lineup_stints,
    _season_type_from_game_id,
    clock_to_seconds,
    parse_possession_record,
    player_id_str,
    season_str,
    team_id_str,
)

_FIXTURE = Path(__file__).parent / "fixtures" / "pbpstats_possessions.json"

_FAKE_FETCHED_AT = datetime(2026, 1, 1, 12, 0, 0, tzinfo=UTC)
_FAKE_URL = "https://data.nba.com/data/v2015/json/mobile_teams/nba/2024/scores/pbp/0022400001_full_pbp.json"


# ---------------------------------------------------------------------------
# Minimal possession stand-ins for pure-function tests
# ---------------------------------------------------------------------------


class _FakeEvent:
    """Minimal stand-in for pbpstats EnhancedPbpItem."""

    def __init__(
        self,
        clock: str,
        score: dict[int, int],
        lineup: dict[int, str],
    ) -> None:
        self.clock = clock
        self.score: defaultdict[int, int] = defaultdict(int, score)
        self._lineup = lineup

    @property
    def lineup_ids(self) -> dict[int, str]:
        return self._lineup


class _FakePossession:
    """Minimal stand-in for pbpstats Possession."""

    def __init__(
        self,
        game_id: str,
        period: int,
        number: int,
        offense_team_id: int,
        team_ids: list[int],
        events: list[_FakeEvent],
        previous_possession: "_FakePossession | None" = None,
        possession_start_type: str = "FGA",
    ) -> None:
        self.game_id = game_id
        self.period = period
        self.number = number
        self.offense_team_id = offense_team_id
        self._team_ids = team_ids
        self.events = events
        self.previous_possession = previous_possession
        self._possession_start_type = possession_start_type

    def get_team_ids(self) -> list[int]:
        return self._team_ids

    @property
    def start_time(self) -> str:
        if self.previous_possession is None:
            return self.events[0].clock
        return self.previous_possession.events[-1].clock

    @property
    def end_time(self) -> str:
        return self.events[-1].clock

    @property
    def start_score_margin(self) -> int:
        prev = self.previous_possession
        score = prev.events[-1].score if prev is not None else self.events[0].score
        off_pts = score[self.offense_team_id]
        def_pts = sum(v for k, v in score.items() if k != self.offense_team_id)
        return off_pts - def_pts

    @property
    def possession_start_type(self) -> str:
        return self._possession_start_type


def _load_possessions() -> tuple[list[_FakePossession], dict]:  # type: ignore[type-arg]
    """Build fake Possession objects from the fixture file."""
    fixture = json.loads(_FIXTURE.read_text())

    bos = fixture["teams"]["BOS"]
    nyk = fixture["teams"]["NYK"]
    lineups: dict[int, str] = {
        bos: fixture["lineups"]["BOS"],
        nyk: fixture["lineups"]["NYK"],
    }
    team_ids = [bos, nyk]
    game_id = fixture["game_id"]
    raw_possessions = fixture["possessions"]

    built: list[_FakePossession] = []
    for i, raw in enumerate(raw_possessions):
        score_start: dict[int, int] = {int(k): v for k, v in raw["start_score"].items()}
        score_end: dict[int, int] = {int(k): v for k, v in raw["end_score"].items()}
        offense_id = raw["offense_team_id"]

        evt_start = _FakeEvent(raw["start_clock"], score_start, lineups)
        evt_end = _FakeEvent(raw["end_clock"], score_end, lineups)

        prev = built[raw["previous_possession"]] if raw["previous_possession"] is not None else None
        poss = _FakePossession(
            game_id=game_id,
            period=raw["period"],
            number=raw["number"],
            offense_team_id=offense_id,
            team_ids=team_ids,
            events=[evt_start, evt_end],
            previous_possession=prev,
            possession_start_type=raw["possession_start_type"],
        )
        built.append(poss)

    return built, fixture


# ---------------------------------------------------------------------------
# Pure helper tests
# ---------------------------------------------------------------------------


def test_season_str() -> None:
    assert season_str(2024) == "2024-25"
    assert season_str(1996) == "1996-97"
    assert season_str(2000) == "2000-01"


def test_clock_to_seconds_normal() -> None:
    assert clock_to_seconds("11:45") == 11 * 60 + 45


def test_clock_to_seconds_fractional() -> None:
    assert clock_to_seconds("5:30.5") == 5 * 60 + 30.5


def test_clock_to_seconds_zero() -> None:
    assert clock_to_seconds("0:00") == 0.0


def test_team_id_str() -> None:
    assert team_id_str(1610612738) == "NBA_1610612738"


def test_player_id_str() -> None:
    assert player_id_str(203500) == "NBA_203500"


def test_season_type_from_game_id_regular() -> None:
    assert _season_type_from_game_id("0022400001") == "Regular"


def test_season_type_from_game_id_playoffs() -> None:
    assert _season_type_from_game_id("0042400001") == "Playoffs"


def test_season_type_from_game_id_playin() -> None:
    assert _season_type_from_game_id("0052400001") == "PlayIn"


# ---------------------------------------------------------------------------
# parse_possession_record
# ---------------------------------------------------------------------------


def test_parse_possession_first_possession() -> None:
    possessions, fixture = _load_possessions()
    poss = possessions[0]

    record = parse_possession_record(
        poss,
        global_possession_num=1,
        raw_game_id=fixture["game_id"],
        season_id_str=fixture["season_id"],
        season_type=fixture["season_type"],
        fetched_at=_FAKE_FETCHED_AT,
        source_url=_FAKE_URL,
    )

    bos_id = fixture["teams"]["BOS"]
    nyk_id = fixture["teams"]["NYK"]

    assert record["game_id"] == f"NBA_{fixture['game_id']}"
    assert record["period"] == 1
    assert record["possession_num"] == 1
    assert record["global_possession_num"] == 1
    assert record["offense_team_id"] == f"NBA_{bos_id}"
    assert record["defense_team_id"] == f"NBA_{nyk_id}"
    assert record["start_time_remaining"] == 11 * 60 + 45
    assert record["end_time_remaining"] == 11 * 60 + 20
    assert record["duration_seconds"] == 25.0
    assert record["score_margin"] == 0
    assert record["points_scored"] == 3
    assert record["possession_start_type"] == "JumpBall"
    assert record["offense_lineup_id"] == fixture["lineups"]["BOS"]
    assert record["defense_lineup_id"] == fixture["lineups"]["NYK"]
    assert record["num_events"] == 2
    assert record["season_id"] == fixture["season_id"]
    assert record["season_type"] == fixture["season_type"]
    assert record["source"] == SOURCE
    assert record["source_url"] == _FAKE_URL
    assert record["fetched_at"] == _FAKE_FETCHED_AT
    payload = json.loads(record["source_payload"])
    assert payload["game_id"] == fixture["game_id"]


def test_parse_possession_second_possession() -> None:
    possessions, fixture = _load_possessions()
    poss = possessions[1]  # NYK on offense

    record = parse_possession_record(
        poss,
        global_possession_num=2,
        raw_game_id=fixture["game_id"],
        season_id_str=fixture["season_id"],
        season_type=fixture["season_type"],
        fetched_at=_FAKE_FETCHED_AT,
        source_url=_FAKE_URL,
    )

    nyk_id = fixture["teams"]["NYK"]
    bos_id = fixture["teams"]["BOS"]

    assert record["offense_team_id"] == f"NBA_{nyk_id}"
    assert record["defense_team_id"] == f"NBA_{bos_id}"
    assert record["score_margin"] == -3  # NYK trailing BOS 0-3 at start of poss
    assert record["points_scored"] == 2
    assert record["possession_start_type"] == "FGA"
    assert record["global_possession_num"] == 2


# ---------------------------------------------------------------------------
# Column completeness
# ---------------------------------------------------------------------------

_EXPECTED_POSSESSION_COLS = {
    "game_id", "period", "possession_num", "global_possession_num",
    "offense_team_id", "defense_team_id",
    "start_time_remaining", "end_time_remaining", "duration_seconds",
    "score_margin", "possession_start_type", "points_scored",
    "offense_lineup_id", "defense_lineup_id", "num_events",
    "season_id", "season_type",
    "source", "source_url", "fetched_at", "source_payload",
}

_EXPECTED_LINEUP_STINT_COLS = {
    "game_id", "period", "team_id",
    "player1_id", "player2_id", "player3_id", "player4_id", "player5_id",
    "lineup_id",
    "start_time_remaining", "end_time_remaining", "duration_seconds",
    "possessions_offense", "possessions_defense",
    "points_for", "points_against", "plus_minus",
    "season_id", "season_type",
    "source", "source_url", "fetched_at", "source_payload",
}


def test_possession_record_has_all_schema_columns() -> None:
    possessions, fixture = _load_possessions()
    record = parse_possession_record(
        possessions[0],
        global_possession_num=1,
        raw_game_id=fixture["game_id"],
        season_id_str=fixture["season_id"],
        season_type=fixture["season_type"],
        fetched_at=_FAKE_FETCHED_AT,
        source_url=_FAKE_URL,
    )
    assert set(record.keys()) == _EXPECTED_POSSESSION_COLS


def test_lineup_stint_record_has_all_schema_columns() -> None:
    possessions, fixture = _load_possessions()
    stints = _derive_lineup_stints(
        possessions,
        raw_game_id=fixture["game_id"],
        season_id_str=fixture["season_id"],
        season_type=fixture["season_type"],
        fetched_at=_FAKE_FETCHED_AT,
        source_url=_FAKE_URL,
    )
    assert len(stints) > 0
    assert set(stints[0].keys()) == _EXPECTED_LINEUP_STINT_COLS


# ---------------------------------------------------------------------------
# Lineup stint derivation
# ---------------------------------------------------------------------------


def test_lineup_stints_two_teams_from_two_possessions() -> None:
    possessions, fixture = _load_possessions()
    stints = _derive_lineup_stints(
        possessions,
        raw_game_id=fixture["game_id"],
        season_id_str=fixture["season_id"],
        season_type=fixture["season_type"],
        fetched_at=_FAKE_FETCHED_AT,
        source_url=_FAKE_URL,
    )

    assert len(stints) == 2

    bos_id = fixture["teams"]["BOS"]
    nyk_id = fixture["teams"]["NYK"]
    bos_stint = next(s for s in stints if s["team_id"] == f"NBA_{bos_id}")
    nyk_stint = next(s for s in stints if s["team_id"] == f"NBA_{nyk_id}")

    # BOS: 1 possession on offense (3 pts for), 1 on defense (2 pts against).
    assert bos_stint["possessions_offense"] == 1
    assert bos_stint["possessions_defense"] == 1
    assert bos_stint["points_for"] == 3
    assert bos_stint["points_against"] == 2
    assert bos_stint["plus_minus"] == 1

    # NYK: 1 on offense (2 pts for), 1 on defense (3 pts against).
    assert nyk_stint["possessions_offense"] == 1
    assert nyk_stint["possessions_defense"] == 1
    assert nyk_stint["points_for"] == 2
    assert nyk_stint["points_against"] == 3
    assert nyk_stint["plus_minus"] == -1


def test_lineup_stint_player_ids_prefixed() -> None:
    possessions, fixture = _load_possessions()
    stints = _derive_lineup_stints(
        possessions,
        raw_game_id=fixture["game_id"],
        season_id_str=fixture["season_id"],
        season_type=fixture["season_type"],
        fetched_at=_FAKE_FETCHED_AT,
        source_url=_FAKE_URL,
    )
    bos_id = fixture["teams"]["BOS"]
    bos_stint = next(s for s in stints if s["team_id"] == f"NBA_{bos_id}")
    for col in ("player1_id", "player2_id", "player3_id", "player4_id", "player5_id"):
        assert bos_stint[col] is not None
        assert bos_stint[col].startswith("NBA_")


def test_lineup_stint_duration() -> None:
    possessions, fixture = _load_possessions()
    stints = _derive_lineup_stints(
        possessions,
        raw_game_id=fixture["game_id"],
        season_id_str=fixture["season_id"],
        season_type=fixture["season_type"],
        fetched_at=_FAKE_FETCHED_AT,
        source_url=_FAKE_URL,
    )
    bos_id = fixture["teams"]["BOS"]
    bos_stint = next(s for s in stints if s["team_id"] == f"NBA_{bos_id}")
    # Stint started at "11:45" (705s) and ended at "10:55" (655s) → 50s duration.
    assert bos_stint["start_time_remaining"] == 705.0
    assert bos_stint["end_time_remaining"] == 655.0
    assert bos_stint["duration_seconds"] == 50.0
