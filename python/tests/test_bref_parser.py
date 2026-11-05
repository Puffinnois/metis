"""T040 acceptance tests: fixture-based parser for the bref adapter.

All tests are purely offline — no network calls are made.
Fixtures live in python/tests/fixtures/bref/ and are checked into the repo.
"""

from datetime import UTC, datetime
from pathlib import Path

import pytest

from ingest.bref.parser import parse_advanced_totals, parse_season_totals

_FIXTURE_DIR = Path(__file__).parent / "fixtures" / "bref"
_TOTALS_FIXTURE = _FIXTURE_DIR / "NBA_2024_totals.html"
_ADVANCED_FIXTURE = _FIXTURE_DIR / "NBA_2024_advanced.html"

_FAKE_TS = datetime(2026, 1, 1, 12, 0, 0, tzinfo=UTC)
_FAKE_URL_TOTALS = "https://www.basketball-reference.com/leagues/NBA_2024_totals.html"
_FAKE_URL_ADV = "https://www.basketball-reference.com/leagues/NBA_2024_advanced.html"


@pytest.fixture(scope="module")
def totals_rows() -> list[dict]:  # type: ignore[type-arg]
    html = _TOTALS_FIXTURE.read_text(encoding="utf-8")
    return parse_season_totals(html, season=2024, source_url=_FAKE_URL_TOTALS, fetched_at=_FAKE_TS)


@pytest.fixture(scope="module")
def advanced_rows() -> list[dict]:  # type: ignore[type-arg]
    html = _ADVANCED_FIXTURE.read_text(encoding="utf-8")
    return parse_advanced_totals(html, season=2024, source_url=_FAKE_URL_ADV, fetched_at=_FAKE_TS)


# ---------------------------------------------------------------------------
# Season totals tests
# ---------------------------------------------------------------------------


def test_totals_row_count(totals_rows: list[dict]) -> None:  # type: ignore[type-arg]
    """Expect more than 400 rows (the 2023-24 season had ~600+ player-team entries)."""
    assert len(totals_rows) > 400


def test_totals_column_count(totals_rows: list[dict]) -> None:  # type: ignore[type-arg]
    """Each row must have exactly the spec columns plus provenance fields."""
    expected_cols = {
        "player",
        "pos",
        "age",
        "tm",
        "g",
        "gs",
        "mp",
        "fg",
        "fga",
        "fg_pct",
        "fg3",
        "fg3a",
        "fg3_pct",
        "fg2",
        "fg2a",
        "fg2_pct",
        "efg_pct",
        "ft",
        "fta",
        "ft_pct",
        "orb",
        "drb",
        "trb",
        "ast",
        "stl",
        "blk",
        "tov",
        "pf",
        "pts",
        # provenance
        "season",
        "source",
        "source_url",
        "fetched_at",
        "source_payload",
    }
    assert set(totals_rows[0].keys()) == expected_cols


def test_totals_lebron_spot_check(totals_rows: list[dict]) -> None:  # type: ignore[type-arg]
    """LeBron James 2023-24 totals: 71 games, 1822 points, LAL."""
    lebron_rows = [r for r in totals_rows if r["player"] == "LeBron James" and r["tm"] == "LAL"]
    assert lebron_rows, "LeBron James not found in 2024 totals"
    row = lebron_rows[0]
    assert row["g"] == 71
    assert row["pts"] == 1822
    assert row["tm"] == "LAL"
    assert row["pos"] == "PF"


def test_totals_provenance(totals_rows: list[dict]) -> None:  # type: ignore[type-arg]
    """All rows must carry correct provenance fields."""
    row = totals_rows[0]
    assert row["source"] == "bref"
    assert row["source_url"] == _FAKE_URL_TOTALS
    assert row["fetched_at"] == _FAKE_TS
    assert row["season"] == 2024
    assert isinstance(row["source_payload"], str)  # JSON string


def test_totals_numeric_types(totals_rows: list[dict]) -> None:  # type: ignore[type-arg]
    """Numeric columns must be int or float (not strings), None allowed."""
    row = next(r for r in totals_rows if r["pts"] is not None)
    assert isinstance(row["pts"], int)
    assert isinstance(row["g"], int)
    # fg_pct can be None for players with 0 FGA; find one with attempts
    row_with_pct = next(r for r in totals_rows if r["fg_pct"] is not None)
    assert isinstance(row_with_pct["fg_pct"], float)


def test_totals_no_header_rows(totals_rows: list[dict]) -> None:  # type: ignore[type-arg]
    """Mid-table repeated header rows must be stripped."""
    players = [r["player"] for r in totals_rows]
    assert "Player" not in players


# ---------------------------------------------------------------------------
# Advanced totals tests
# ---------------------------------------------------------------------------


def test_advanced_row_count(advanced_rows: list[dict]) -> None:  # type: ignore[type-arg]
    """Expect more than 400 rows."""
    assert len(advanced_rows) > 400


def test_advanced_column_count(advanced_rows: list[dict]) -> None:  # type: ignore[type-arg]
    """Each row must have exactly the spec columns plus provenance fields."""
    expected_cols = {
        "player",
        "pos",
        "age",
        "tm",
        "g",
        "mp",
        "per",
        "ts_pct",
        "fg3a_per_fga_pct",
        "fta_per_fga_pct",
        "orb_pct",
        "drb_pct",
        "trb_pct",
        "ast_pct",
        "stl_pct",
        "blk_pct",
        "tov_pct",
        "usg_pct",
        "ows",
        "dws",
        "ws",
        "ws_per_48",
        "obpm",
        "dbpm",
        "bpm",
        "vorp",
        # provenance
        "season",
        "source",
        "source_url",
        "fetched_at",
        "source_payload",
    }
    assert set(advanced_rows[0].keys()) == expected_cols


def test_advanced_lebron_spot_check(advanced_rows: list[dict]) -> None:  # type: ignore[type-arg]
    """LeBron James 2023-24 advanced: 71 games, PER 23.7, VORP 5.4."""
    lebron_rows = [r for r in advanced_rows if r["player"] == "LeBron James" and r["tm"] == "LAL"]
    assert lebron_rows, "LeBron James not found in 2024 advanced"
    row = lebron_rows[0]
    assert row["g"] == 71
    assert row["per"] == pytest.approx(23.7, abs=0.1)
    assert row["vorp"] == pytest.approx(5.4, abs=0.1)


def test_advanced_provenance(advanced_rows: list[dict]) -> None:  # type: ignore[type-arg]
    """All rows must carry correct provenance fields."""
    row = advanced_rows[0]
    assert row["source"] == "bref"
    assert row["source_url"] == _FAKE_URL_ADV
    assert row["fetched_at"] == _FAKE_TS
    assert row["season"] == 2024


def test_advanced_numeric_types(advanced_rows: list[dict]) -> None:  # type: ignore[type-arg]
    """Float columns must be float (not strings), None allowed."""
    row = next(r for r in advanced_rows if r["ws"] is not None)
    assert isinstance(row["ws"], float)
    assert isinstance(row["per"], float)
