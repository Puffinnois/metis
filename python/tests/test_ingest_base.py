"""T020 acceptance tests: mock server → Parquet round-trip."""

import json
from pathlib import Path

import pyarrow.parquet as pq
from pytest_httpserver import HTTPServer

from ingest._http import _USER_AGENT, RateLimitedSession
from ingest._parquet import write_parquet


def test_session_get_returns_response(httpserver: HTTPServer) -> None:
    """Session hits local mock server and returns body."""
    payload = [{"player_id": 1, "pts": 30}]
    httpserver.expect_request("/api/box").respond_with_data(
        json.dumps(payload), content_type="application/json"
    )
    with RateLimitedSession(default_rps=1000.0) as session:
        resp = session.get(httpserver.url_for("/api/box"))
    assert resp.status_code == 200
    assert resp.json() == payload


def test_session_sends_user_agent() -> None:
    """Session User-Agent header is set to the Metis string."""
    session = RateLimitedSession()
    assert session._session.headers["User-Agent"] == _USER_AGENT
    session.close()


def test_write_parquet_roundtrip(tmp_path: Path) -> None:
    """Records written to Parquet read back byte-for-byte identical."""
    records = [
        {"player_id": 1, "pts": 30, "reb": 10, "ast": 5},
        {"player_id": 2, "pts": 22, "reb": 3, "ast": 8},
    ]
    path = write_parquet(
        records, source="test", entity="player_game_box", season=2024, data_root=tmp_path
    )
    assert path.exists()
    assert path.suffix == ".parquet"
    assert path.parent.name == "season=2024"
    result = pq.ParquetFile(path).read().to_pylist()  # type: ignore[no-untyped-call]
    assert result == records


def test_write_parquet_path_structure(tmp_path: Path) -> None:
    """Output path follows data_root/<source>/<entity>/season=<season>/part-*.parquet."""
    records = [{"x": 1}]
    path = write_parquet(
        records, source="nba_stats", entity="team_game_box", season=2023, data_root=tmp_path
    )
    parts = path.parts
    assert "nba_stats" in parts
    assert "team_game_box" in parts
    assert "season=2023" in parts


def test_fetch_write_roundtrip(httpserver: HTTPServer, tmp_path: Path) -> None:
    """End-to-end: fetch from local mock server → write Parquet → read back identical."""
    raw = [{"id": 42, "name": "LeBron", "season": 2024}]
    httpserver.expect_request("/api/data").respond_with_data(
        json.dumps(raw), content_type="application/json"
    )

    with RateLimitedSession(default_rps=1000.0) as session:
        resp = session.get(httpserver.url_for("/api/data"))

    fetched = resp.json()
    path = write_parquet(
        fetched, source="test_src", entity="player", season=2024, data_root=tmp_path
    )
    result = pq.ParquetFile(path).read().to_pylist()  # type: ignore[no-untyped-call]
    assert result == raw
