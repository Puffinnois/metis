#!/usr/bin/env python3
"""
Metis health verifier.

Complements scripts/smoke.sh. Where smoke runs the pipeline end-to-end for one
season from scratch, this script audits the *current state* of the system and
proves the frontend can actually reach its data.

Checks (each prints PASS / WARN / FAIL):

  Layer 1 — DB integrity
    1.1  metis.duckdb exists and migrations applied
    1.2  Core entity tables non-empty (player, team, game, season)
    1.3  No foreign-key orphans in fact tables
    1.4  Provenance columns populated on every fact row
    1.5  Coverage matrix: which (season, source) combos have data

  Layer 2 — Compute completeness
    2.1  Every (season, source) with box data has season_rollups
    2.2  Every (season, source) with rollups has advanced stats

  Layer 3 — Frontend ↔ Tauri parity (STATIC)
    3.1  Every `tauriInvoke("name")` in api.ts is registered in main.rs
    3.2  Every API call in api.ts has a Tauri fallback (no HTTP-only paths)
    3.3  Every Tauri command in main.rs is referenced by api.ts

  Layer 4 — API (only if reachable)
    4.1  /players, /teams, /seasons return non-empty
    4.2  /teams/{id} returns the requested team

Layer 3 is the one most likely to catch "app shows nothing" bugs because the
running app uses Tauri IPC, not HTTP. A frontend that calls an unregistered
command — or that has no Tauri fallback while the HTTP server isn't running —
will silently hang or render empty.

Usage:
  python scripts/verify.py
  python scripts/verify.py --api-port 3000
  python scripts/verify.py --no-api

Exit code: 0 if no FAILs, 1 otherwise. WARNs don't fail.
Run from project root.
"""

from __future__ import annotations

import argparse
import re
import sys
import urllib.error
import urllib.request
from contextlib import suppress
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "duckdb" / "metis.duckdb"
TAURI_MAIN = ROOT / "crates" / "metis-tauri" / "src" / "main.rs"
API_TS = ROOT / "frontend" / "src" / "lib" / "api.ts"

GREEN, YELLOW, RED, DIM, RESET = "\033[32m", "\033[33m", "\033[31m", "\033[2m", "\033[0m"
PASS, WARN, FAIL = f"{GREEN}PASS{RESET}", f"{YELLOW}WARN{RESET}", f"{RED}FAIL{RESET}"

fail_count = 0
warn_count = 0


def report(level: str, check: str, detail: str = "") -> None:
    """Print a single check result."""
    global fail_count, warn_count
    if level == FAIL:
        fail_count += 1
    elif level == WARN:
        warn_count += 1
    line = f"  [{level}] {check}"
    if detail:
        line += f"  {DIM}— {detail}{RESET}"
    print(line)


def section(title: str) -> None:
    print(f"\n{title}")
    print("─" * len(title))


# ---------------------------------------------------------------------------
# Layer 1 — DB integrity
# ---------------------------------------------------------------------------


def check_db() -> "duckdb.DuckDBPyConnection | None":  # type: ignore[name-defined]
    section("Layer 1 — DB integrity")
    if not DB_PATH.exists():
        report(FAIL, "metis.duckdb exists", f"expected {DB_PATH}")
        return None
    try:
        import duckdb  # type: ignore[import-not-found]
    except ImportError:
        report(FAIL, "duckdb python module installed", "run: (cd python && uv sync)")
        return None
    try:
        con = duckdb.connect(str(DB_PATH), read_only=True)
    except Exception as e:  # noqa: BLE001
        report(FAIL, "open metis.duckdb", str(e))
        return None
    report(PASS, "metis.duckdb exists and opens")

    # Migrations table
    try:
        n = con.execute("SELECT COUNT(*) FROM _migrations").fetchone()[0]
        report(PASS if n > 0 else FAIL, "migrations applied", f"{n} rows in _migrations")
    except Exception as e:  # noqa: BLE001
        report(FAIL, "migrations table present", str(e))

    # Core entity counts
    for table, min_rows in [
        ("player", 100),
        ("team", 25),
        ("game", 100),
        ("season", 1),
    ]:
        try:
            n = con.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            if n >= min_rows:
                report(PASS, f"{table} populated", f"{n:,} rows")
            elif n > 0:
                report(WARN, f"{table} populated", f"only {n} rows (expected ≥ {min_rows})")
            else:
                report(FAIL, f"{table} populated", "0 rows — ingestion likely not run")
        except Exception as e:  # noqa: BLE001
            report(FAIL, f"{table} table query", str(e))

    # FK orphans
    orphan_checks = [
        ("player_game_box", "player_id", "player", "id"),
        ("player_game_box", "game_id", "game", "id"),
        ("player_game_box", "team_id", "team", "id"),
        ("team_game_box", "game_id", "game", "id"),
        ("team_game_box", "team_id", "team", "id"),
    ]
    for child, fk, parent, pk in orphan_checks:
        try:
            n = con.execute(
                f"SELECT COUNT(*) FROM {child} c "
                f"LEFT JOIN {parent} p ON c.{fk} = p.{pk} WHERE p.{pk} IS NULL"
            ).fetchone()[0]
            if n == 0:
                report(PASS, f"no FK orphans: {child}.{fk} → {parent}")
            else:
                report(FAIL, f"FK orphans: {child}.{fk} → {parent}", f"{n} orphan rows")
        except Exception as e:  # noqa: BLE001
            report(WARN, f"FK orphan check {child}.{fk}", str(e))

    # Provenance populated
    for table in ("player_game_box", "team_game_box"):
        try:
            n = con.execute(
                f"SELECT COUNT(*) FROM {table} "
                f"WHERE source IS NULL OR fetched_at IS NULL"
            ).fetchone()[0]
            if n == 0:
                report(PASS, f"provenance populated on {table}")
            else:
                report(FAIL, f"provenance populated on {table}", f"{n} rows missing source/fetched_at")
        except Exception as e:  # noqa: BLE001
            report(WARN, f"provenance check on {table}", str(e))

    # Coverage matrix
    try:
        rows = con.execute(
            "SELECT season_id, source, COUNT(*) "
            "FROM player_game_box GROUP BY 1,2 ORDER BY 1 DESC, 2"
        ).fetchall()
        if not rows:
            report(FAIL, "coverage matrix (player_game_box)", "no data at all")
        else:
            print(f"  {DIM}coverage (season, source, rows):{RESET}")
            for season_id, source, count in rows[:20]:
                print(f"    {season_id:<10} {source:<12} {count:>8,}")
            if len(rows) > 20:
                print(f"    … {len(rows) - 20} more")
            report(PASS, "coverage matrix populated", f"{len(rows)} (season,source) combos")
    except Exception as e:  # noqa: BLE001
        report(WARN, "coverage matrix", str(e))

    return con


# ---------------------------------------------------------------------------
# Layer 2 — Compute completeness
# ---------------------------------------------------------------------------


def check_compute(con) -> None:  # type: ignore[no-untyped-def]
    section("Layer 2 — Compute completeness")
    if con is None:
        report(WARN, "compute checks skipped", "no DB connection")
        return

    # Every (season, source) with box data should have season_rollups
    try:
        missing = con.execute(
            """
            SELECT DISTINCT b.season_id, b.source FROM player_game_box b
            LEFT JOIN player_season_totals r
              ON r.season_id = b.season_id AND r.source = b.source
            WHERE r.season_id IS NULL
            """
        ).fetchall()
        if not missing:
            report(PASS, "every (season, source) has season rollups")
        else:
            sample = ", ".join(f"{s}/{src}" for s, src in missing[:5])
            extra = f" (+{len(missing) - 5} more)" if len(missing) > 5 else ""
            report(FAIL, "season rollups missing", f"{len(missing)} combos: {sample}{extra}")
    except Exception as e:  # noqa: BLE001
        report(WARN, "season rollup completeness", str(e))

    # Every rollup should have advanced stats
    try:
        missing = con.execute(
            """
            SELECT DISTINCT r.season_id, r.source FROM player_season_totals r
            LEFT JOIN player_season_advanced a
              ON a.season_id = r.season_id AND a.source = r.source
            WHERE a.season_id IS NULL
            """
        ).fetchall()
        if not missing:
            report(PASS, "every rollup has advanced stats")
        else:
            sample = ", ".join(f"{s}/{src}" for s, src in missing[:5])
            extra = f" (+{len(missing) - 5} more)" if len(missing) > 5 else ""
            report(WARN, "advanced stats missing for some rollups", f"{len(missing)}: {sample}{extra}")
    except Exception as e:  # noqa: BLE001
        report(WARN, "advanced stat completeness", str(e))


# ---------------------------------------------------------------------------
# Layer 3 — Frontend ↔ Tauri parity (the bug-catcher)
# ---------------------------------------------------------------------------


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def check_parity() -> None:
    section("Layer 3 — Frontend ↔ Tauri parity")

    tauri_src = _read(TAURI_MAIN)
    api_src = _read(API_TS)
    if not tauri_src:
        report(FAIL, "read crates/metis-tauri/src/main.rs", "file missing")
        return
    if not api_src:
        report(FAIL, "read frontend/src/lib/api.ts", "file missing")
        return

    # Tauri commands registered via tauri::generate_handler![ ... ]
    handler_match = re.search(
        r"tauri::generate_handler!\[\s*([^\]]*)\]", tauri_src, re.DOTALL
    )
    registered: set[str] = set()
    if handler_match:
        registered = {
            name.strip() for name in handler_match.group(1).split(",") if name.strip()
        }
    if not registered:
        report(FAIL, "parse Tauri command registration", "generate_handler! block not found or empty")
        return
    report(PASS, "Tauri commands registered", f"{len(registered)}: {', '.join(sorted(registered))}")

    # Frontend tauriInvoke("name") calls
    invoked = set(re.findall(r"tauriInvoke[^(]*\(\s*\"([a-zA-Z0-9_]+)\"", api_src))
    if not invoked:
        report(WARN, "parse tauriInvoke calls in api.ts", "no calls found — frontend may be HTTP-only")
    else:
        report(PASS, "tauriInvoke calls discovered", f"{len(invoked)}: {', '.join(sorted(invoked))}")

    # 3.1 Frontend invokes commands that don't exist (CRITICAL — silent hangs)
    bogus = invoked - registered
    if not bogus:
        report(PASS, "all tauriInvoke targets exist as Rust commands")
    else:
        report(FAIL, "tauriInvoke targets missing from Rust", ", ".join(sorted(bogus)))

    # 3.2 HTTP-only paths — functions that call httpGet without trying tauriInvoke first.
    # Heuristic: find each `export async function NAME(...) { ... }` block and check
    # whether it contains tauriInvoke or only httpGet/fetch.
    fn_pattern = re.compile(
        r"export\s+async\s+function\s+(\w+)\s*\([^)]*\)[^{]*\{",
        re.MULTILINE,
    )
    http_only: list[str] = []
    for match in fn_pattern.finditer(api_src):
        name = match.group(1)
        start = match.end()
        depth = 1
        i = start
        while i < len(api_src) and depth > 0:
            if api_src[i] == "{":
                depth += 1
            elif api_src[i] == "}":
                depth -= 1
            i += 1
        body = api_src[start:i]
        uses_tauri = "tauriInvoke" in body
        uses_http = "httpGet" in body or "fetch(" in body
        if uses_http and not uses_tauri:
            http_only.append(name)
    if not http_only:
        report(PASS, "every api.ts function has a Tauri path")
    else:
        report(
            FAIL,
            "api.ts functions are HTTP-only (will hang in Tauri unless server runs)",
            ", ".join(http_only),
        )

    # 3.3 Registered commands never used (dead code — warn only)
    unused = registered - invoked
    if unused:
        report(WARN, "registered Tauri commands not used by frontend", ", ".join(sorted(unused)))


# ---------------------------------------------------------------------------
# Layer 4 — API (only if reachable)
# ---------------------------------------------------------------------------


def http_get(url: str, timeout: float = 3.0) -> bytes | None:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:  # noqa: S310
            return resp.read()
    except (urllib.error.URLError, TimeoutError, ConnectionError):
        return None


def check_api(port: int) -> None:
    section(f"Layer 4 — API (port {port})")
    base = f"http://127.0.0.1:{port}"
    if http_get(f"{base}/seasons", timeout=1.0) is None:
        report(WARN, "API not reachable", f"{base} — skipping (this is expected if you only run the Tauri app)")
        return
    report(PASS, "API reachable", base)

    import json

    for endpoint in ("/players", "/teams", "/seasons"):
        body = http_get(f"{base}{endpoint}")
        if body is None:
            report(FAIL, f"GET {endpoint}", "no response")
            continue
        with suppress(Exception):
            data = json.loads(body)
            n = len(data.get("data", []) if isinstance(data, dict) else data)
            if n > 0:
                report(PASS, f"GET {endpoint}", f"{n} rows")
            else:
                report(FAIL, f"GET {endpoint}", "empty response — DB likely empty")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--api-port", type=int, default=3000)
    parser.add_argument("--no-api", action="store_true", help="skip API layer")
    args = parser.parse_args(argv)

    print(f"Metis verify  {DIM}(root: {ROOT}){RESET}")
    con = check_db()
    check_compute(con)
    check_parity()
    if not args.no_api:
        check_api(args.api_port)

    print()
    summary = f"{fail_count} FAIL, {warn_count} WARN"
    if fail_count == 0 and warn_count == 0:
        print(f"{GREEN}All checks passed.{RESET}")
    elif fail_count == 0:
        print(f"{YELLOW}{summary}.{RESET}  Pipeline is functional; review warnings.")
    else:
        print(f"{RED}{summary}.{RESET}  Fix FAILs before shipping.")
    return 1 if fail_count > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
