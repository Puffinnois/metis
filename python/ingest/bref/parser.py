"""HTML parser for Basketball-Reference season-totals and advanced-totals tables.

robots.txt findings (fetched 2026-06-14):
  - Crawl-delay: 3  (≥ 3 seconds between requests — enforced by RateLimitedSession)
  - Disallowed paths that affect this adapter: none; /leagues/*.html is allowed.
  - Disallowed paths to avoid: /play-index/, */gamelog/, */splits/, */on-off/,
    */lineups/, */shooting/
  - AhrefsBot and GPTBot are fully blocked; our custom User-Agent is unrestricted.

Table IDs:
  - Season totals:  <table id="totals_stats">  (URL: /leagues/NBA_YYYY_totals.html)
  - Advanced totals: <table id="advanced">     (URL: /leagues/NBA_YYYY_advanced.html)

Data-stat attribute mapping:
  The <th>/<td> elements carry a `data-stat` attribute that is the canonical
  column name.  The header row also contains a 'ranker' column (row index) and
  an 'awards' column; both are dropped from output.

  Multi-team players (TOT rows) have team_name_abbr='TOT'.  Per project policy
  all rows are kept; consumers can filter on the TOT row for season-level totals
  or keep per-team splits.
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from bs4 import BeautifulSoup, Tag

# ---------------------------------------------------------------------------
# Column definitions — order matches task spec, values are data-stat keys
# ---------------------------------------------------------------------------

_TOTALS_COLS: list[str] = [
    "name_display",
    "pos",
    "age",
    "team_name_abbr",
    "games",
    "games_started",
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
]

_ADVANCED_COLS: list[str] = [
    "name_display",
    "pos",
    "age",
    "team_name_abbr",
    "games",
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
]

# Output field names that align with the task spec (player, tm, g, gs, etc.)
_TOTALS_RENAME: dict[str, str] = {
    "name_display": "player",
    "team_name_abbr": "tm",
    "games": "g",
    "games_started": "gs",
}

_ADVANCED_RENAME: dict[str, str] = {
    "name_display": "player",
    "team_name_abbr": "tm",
    "games": "g",
}

# Columns that should be cast to int (empty string → None)
_INT_COLS: frozenset[str] = frozenset(
    {
        "g",
        "gs",
        "mp",
        "fg",
        "fga",
        "fg3",
        "fg3a",
        "fg2",
        "fg2a",
        "ft",
        "fta",
        "orb",
        "drb",
        "trb",
        "ast",
        "stl",
        "blk",
        "tov",
        "pf",
        "pts",
        "age",
    }
)

# Columns that should be cast to float (empty string → None)
_FLOAT_COLS: frozenset[str] = frozenset(
    {
        "fg_pct",
        "fg3_pct",
        "fg2_pct",
        "efg_pct",
        "ft_pct",
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
    }
)


def _coerce(key: str, raw: str) -> int | float | str | None:
    """Coerce a raw cell string to the appropriate Python type."""
    val = raw.strip()
    if val == "":
        return None
    if key in _INT_COLS:
        try:
            return int(val)
        except ValueError:
            return None
    if key in _FLOAT_COLS:
        try:
            return float(val)
        except ValueError:
            return None
    return val


def _parse_table(
    html: str,
    *,
    table_id: str,
    cols: list[str],
    rename: dict[str, str],
    season: int,
    source_url: str,
    fetched_at: datetime,
) -> list[dict[str, Any]]:
    """Parse one Basketball-Reference stat table and return normalized rows.

    Args:
        html: Full HTML of the page.
        table_id: The `id` attribute of the <table> element.
        cols: List of `data-stat` keys to extract (in output order).
        rename: Map of data-stat key → output field name.
        season: Season start year (e.g. 2024 for 2024-25).
        source_url: URL the HTML was fetched from (for provenance).
        fetched_at: UTC timestamp of the fetch (for provenance).
    """
    soup = BeautifulSoup(html, "html.parser")
    table: Tag | None = soup.find("table", id=table_id)
    if table is None:
        raise ValueError(f"Table with id={table_id!r} not found in HTML")

    tbody: Tag | None = table.find("tbody")
    if tbody is None:
        raise ValueError(f"No <tbody> in table id={table_id!r}")

    records: list[dict[str, Any]] = []
    for tr in tbody.find_all("tr"):
        # Skip mid-table repeated header rows (class="thead")
        raw_cls: str | list[str] = tr.get("class") or []
        tr_classes: list[str] = raw_cls if isinstance(raw_cls, list) else [raw_cls]
        if "thead" in tr_classes:
            continue

        cells: dict[str, str] = {}
        for cell in tr.find_all(["th", "td"]):
            stat = cell.get("data-stat")
            if stat and isinstance(stat, str):
                cells[stat] = cell.get_text()

        # Skip rows that have no player name (separator rows)
        if not cells.get("name_display", "").strip():
            continue

        row: dict[str, Any] = {}
        for stat in cols:
            out_key = rename.get(stat, stat)
            coerce_key = out_key if out_key in (_INT_COLS | _FLOAT_COLS) else stat
            row[out_key] = _coerce(coerce_key, cells.get(stat, ""))

        # Provenance fields
        row["season"] = season
        row["source"] = "bref"
        row["source_url"] = source_url
        row["fetched_at"] = fetched_at
        row["source_payload"] = json.dumps(cells)

        records.append(row)

    return records


def parse_season_totals(
    html: str,
    *,
    season: int,
    source_url: str,
    fetched_at: datetime,
) -> list[dict[str, Any]]:
    """Parse the season totals page and return one dict per player-team row.

    The table id on /leagues/NBA_YYYY_totals.html is 'totals_stats'.
    Multi-team players appear once with tm='TOT' plus one row per team.
    All rows are returned; callers may filter on tm='TOT' for aggregates.
    """
    return _parse_table(
        html,
        table_id="totals_stats",
        cols=_TOTALS_COLS,
        rename=_TOTALS_RENAME,
        season=season,
        source_url=source_url,
        fetched_at=fetched_at,
    )


def parse_advanced_totals(
    html: str,
    *,
    season: int,
    source_url: str,
    fetched_at: datetime,
) -> list[dict[str, Any]]:
    """Parse the advanced stats page and return one dict per player-team row.

    The table id on /leagues/NBA_YYYY_advanced.html is 'advanced'.
    """
    return _parse_table(
        html,
        table_id="advanced",
        cols=_ADVANCED_COLS,
        rename=_ADVANCED_RENAME,
        season=season,
        source_url=source_url,
        fetched_at=fetched_at,
    )
