"""Tests for the backfill coverage ranges and resume logic."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock

from ingest.backfill.coverage import (
    BREF_ADVANCED_FIRST_SEASON,
    BREF_TOTALS_FIRST_SEASON,
    NBA_STATS_FIRST_SEASON,
    bref_advanced_seasons,
    bref_totals_seasons,
    nba_stats_seasons,
)
from ingest.backfill.runner import BackfillReport, _run_seasons


class TestCoverageRanges:
    def test_bref_totals_starts_at_1946(self) -> None:
        seasons = bref_totals_seasons(last=1950)
        assert seasons[0] == 1946
        assert seasons == list(range(1946, 1951))

    def test_bref_advanced_starts_at_1979(self) -> None:
        seasons = bref_advanced_seasons(last=1982)
        assert seasons[0] == 1979

    def test_nba_stats_starts_at_1996(self) -> None:
        seasons = nba_stats_seasons(last=2000)
        assert seasons[0] == 1996

    def test_constants_match_functions(self) -> None:
        assert bref_totals_seasons(last=BREF_TOTALS_FIRST_SEASON) == [BREF_TOTALS_FIRST_SEASON]
        adv = bref_advanced_seasons(last=BREF_ADVANCED_FIRST_SEASON)
        assert adv == [BREF_ADVANCED_FIRST_SEASON]
        assert nba_stats_seasons(last=NBA_STATS_FIRST_SEASON) == [NBA_STATS_FIRST_SEASON]

    def test_custom_first_and_last(self) -> None:
        seasons = nba_stats_seasons(first=2010, last=2015)
        assert seasons == list(range(2010, 2016))

    def test_ascending_order(self) -> None:
        seasons = bref_totals_seasons(first=1990, last=1995)
        assert seasons == sorted(seasons)


class TestRunner:
    """Tests the _run_seasons helper using mocked adapters — no network calls."""

    def test_skip_existing_season(self, tmp_path: Path) -> None:
        report = BackfillReport()
        _run_seasons(
            seasons=[2020],
            source="test",
            kind="box",
            exists_fn=lambda _: True,  # pretend already present
            fetch_fn=MagicMock(side_effect=AssertionError("should not be called")),
            report=report,
            force=False,
            verbose=False,
        )
        assert len(report.results) == 1
        assert report.results[0].skipped
        assert len(report.skipped) == 1
        assert len(report.done) == 0

    def test_force_refetches_existing(self, tmp_path: Path) -> None:
        fake_path = tmp_path / "out.parquet"
        fetch = MagicMock(return_value=fake_path)
        report = BackfillReport()
        _run_seasons(
            seasons=[2020],
            source="test",
            kind="box",
            exists_fn=lambda _: True,
            fetch_fn=fetch,
            report=report,
            force=True,
            verbose=False,
        )
        fetch.assert_called_once_with(2020)
        assert len(report.done) == 1
        assert len(report.skipped) == 0

    def test_fetch_missing_season(self, tmp_path: Path) -> None:
        fake_path = tmp_path / "out.parquet"
        fetch = MagicMock(return_value=fake_path)
        report = BackfillReport()
        _run_seasons(
            seasons=[2020, 2021],
            source="test",
            kind="box",
            exists_fn=lambda _: False,
            fetch_fn=fetch,
            report=report,
            force=False,
            verbose=False,
        )
        assert fetch.call_count == 2
        assert len(report.done) == 2

    def test_error_is_captured_not_raised(self) -> None:
        report = BackfillReport()
        _run_seasons(
            seasons=[2020],
            source="test",
            kind="box",
            exists_fn=lambda _: False,
            fetch_fn=MagicMock(side_effect=RuntimeError("network error")),
            report=report,
            force=False,
            verbose=False,
        )
        assert len(report.failed) == 1
        assert "network error" in (report.failed[0].error or "")
        assert len(report.done) == 0

    def test_mixed_results(self) -> None:
        call_count = 0

        def fetch(season: int) -> Path:
            nonlocal call_count
            call_count += 1
            if season == 2020:
                raise RuntimeError("boom")
            return MagicMock()

        report = BackfillReport()
        _run_seasons(
            seasons=[2019, 2020, 2021],
            source="test",
            kind="box",
            exists_fn=lambda s: s == 2019,
            fetch_fn=fetch,
            report=report,
            force=False,
            verbose=False,
        )
        assert len(report.skipped) == 1   # 2019
        assert len(report.failed) == 1    # 2020
        assert len(report.done) == 1      # 2021
        assert call_count == 2            # 2019 was skipped, so only 2020+2021 attempted
