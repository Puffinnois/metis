#!/usr/bin/env bash
# End-to-end pipeline smoke test.
# Runs the full ingest → load → compute → API chain for one season and
# asserts row counts at each stage.
#
# Usage:
#   scripts/smoke.sh [--season YYYY] [--db PATH] [--no-clean]
#
# Must be run from the project root.
set -euo pipefail

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
SEASON=2024
DB_PATH="data/duckdb/metis.duckdb"
CLEAN=true

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case "$1" in
        --season)
            SEASON="$2"
            shift 2
            ;;
        --db)
            DB_PATH="$2"
            shift 2
            ;;
        --no-clean)
            CLEAN=false
            shift
            ;;
        *)
            echo "Unknown argument: $1" >&2
            exit 1
            ;;
    esac
done

PARQUET_SEASON_DIR="data/parquet/nba_stats/player_game_box/season=${SEASON}"
NEXT_TWO=$(printf '%02d' $(( (SEASON + 1) % 100 )))
SEASON_ID="${SEASON}-${NEXT_TWO}"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
ok() {
    local step="$1" desc="$2" rows="$3"
    printf '[OK] step %s: %s (rows=%s)\n' "$step" "$desc" "$rows"
}

fail() {
    local step="$1" desc="$2" expected="$3" got="$4"
    printf '[FAIL] step %s: %s — expected %s got %s\n' \
        "$step" "$desc" "$expected" "$got" >&2
    exit 1
}

# Run a DuckDB query and return just the scalar result.
duckdb_scalar() {
    duckdb "$DB_PATH" -noheader -list "$1"
}

# Locate or build the metis-cli binary.
find_cli() {
    if [[ -x "./target/release/metis-cli" ]]; then
        echo "./target/release/metis-cli"
    else
        # Use cargo run; caller must prefix args with '--'
        echo "cargo run -p metis-cli --"
    fi
}

CLI=$(find_cli)

# ---------------------------------------------------------------------------
# Pre-flight: clean slate
# ---------------------------------------------------------------------------
if [[ "$CLEAN" == true ]]; then
    echo "Cleaning DB and Parquet for season=${SEASON}..."
    rm -f "$DB_PATH"
    rm -rf "$PARQUET_SEASON_DIR"
fi

mkdir -p "$(dirname "$DB_PATH")"

# ---------------------------------------------------------------------------
# Step 1: Ingest — fetch box scores and write Parquet
# ---------------------------------------------------------------------------
echo ""
echo "=== Step 1: ingest nba_stats box-scores season=${SEASON} ==="
(cd python && uv run python -m ingest.nba_stats box-scores --season "$SEASON")

# Count rows across all Parquet part files for the season.
PARQUET_ROWS=$(duckdb -noheader -list :memory: \
    "SELECT COUNT(*) FROM read_parquet('${PARQUET_SEASON_DIR}/*.parquet')")

PARQUET_LOW=24500
PARQUET_HIGH=25500
if [[ "$PARQUET_ROWS" -lt "$PARQUET_LOW" || "$PARQUET_ROWS" -gt "$PARQUET_HIGH" ]]; then
    fail 1 "player_game_box Parquet row count" \
        "${PARQUET_LOW}..${PARQUET_HIGH}" "$PARQUET_ROWS"
fi
ok 1 "player_game_box Parquet ingested" "$PARQUET_ROWS"

# ---------------------------------------------------------------------------
# Step 2: Load Parquet into DuckDB
# ---------------------------------------------------------------------------
echo ""
echo "=== Step 2: load box-scores into DuckDB ==="
$CLI --db "$DB_PATH" load box-scores --season "$SEASON" --source nba_stats

DB_BOX_ROWS=$(duckdb_scalar "SELECT COUNT(*) FROM player_game_box")

if [[ "$DB_BOX_ROWS" -ne "$PARQUET_ROWS" ]]; then
    fail 2 "player_game_box DuckDB row count matches Parquet" \
        "$PARQUET_ROWS" "$DB_BOX_ROWS"
fi
ok 2 "player_game_box loaded into DuckDB" "$DB_BOX_ROWS"

# ---------------------------------------------------------------------------
# Step 3: Compute season rollups
# ---------------------------------------------------------------------------
echo ""
echo "=== Step 3: compute season-rollups season=${SEASON} ==="
$CLI --db "$DB_PATH" compute season-rollups --season "$SEASON" --source nba_stats

ROLLUP_PLAYERS=$(duckdb_scalar \
    "SELECT COUNT(DISTINCT player_id) FROM player_season_totals WHERE season_id='${SEASON_ID}'")

ROLLUP_LOW=450
ROLLUP_HIGH=550
if [[ "$ROLLUP_PLAYERS" -lt "$ROLLUP_LOW" || "$ROLLUP_PLAYERS" -gt "$ROLLUP_HIGH" ]]; then
    fail 3 "player_season_totals distinct player count" \
        "${ROLLUP_LOW}..${ROLLUP_HIGH}" "$ROLLUP_PLAYERS"
fi
ok 3 "player_season_totals season rollups computed" "$ROLLUP_PLAYERS"

# ---------------------------------------------------------------------------
# Step 4: Compute advanced stats
# ---------------------------------------------------------------------------
echo ""
echo "=== Step 4: compute advanced-stats season=${SEASON} ==="
$CLI --db "$DB_PATH" compute advanced-stats --season "$SEASON" --source nba_stats

ADV_ROWS=$(duckdb_scalar \
    "SELECT COUNT(*) FROM player_season_advanced WHERE season_id='${SEASON_ID}'")

if [[ "$ADV_ROWS" -le 0 ]]; then
    fail 4 "player_season_advanced populated" "> 0" "$ADV_ROWS"
fi
ok 4 "player_season_advanced advanced stats computed" "$ADV_ROWS"

# ---------------------------------------------------------------------------
# Step 5: API smoke check (advisory — does not fail the script)
# ---------------------------------------------------------------------------
echo ""
echo "=== Step 5: API /players?season=${SEASON} (advisory) ==="

# Detect the port from the environment, or try the default.
API_PORT="${METIS_API_PORT:-3000}"
API_URL="http://localhost:${API_PORT}/players?season=${SEASON}"

if curl -sf --max-time 3 "$API_URL" -o /dev/null 2>/dev/null; then
    # Response shape: { "data": [...], "total": N, "coverage": "..." }
    API_LEN=$(curl -s --max-time 5 "$API_URL" | jq '.data | length')
    if [[ "$API_LEN" -gt 0 ]]; then
        ok 5 "API /players returned non-empty response" "$API_LEN"
    else
        echo "[WARN] step 5: API /players returned empty array — API may need data loaded"
    fi
else
    echo "[NOTE] step 5: API not reachable at ${API_URL} — start metis-api to validate end-to-end"
fi

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
echo ""
echo "Smoke test passed for season=${SEASON}."
