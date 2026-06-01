# T030 — Season Rollups Design

**Date:** 2026-06-01  
**Task:** T030 🦀 `metis-compute` season rollups  
**Status:** Approved

---

## Summary

Materialize `player_season_totals`, `player_season_per_game`, `team_season_totals`, and `team_season_per_game` from `player_game_box` / `team_game_box`. Triggered via:

```
metis-cli compute season-rollups --season 2024 --source nba_stats
```

Both `--season` and `--source` are required — no defaults. Provenance is explicit at the CLI level, matching row-level provenance in the box tables.

---

## Key Decisions

- **Source is required, never defaulted.** Silently defaulting (e.g. to `nba_stats`) would hide which source produced the numbers and cause debugging pain when T040+ lands with a second source.
- **Rollup tables carry `source TEXT NOT NULL`.** Composite uniqueness on `(player_id, season_id, season_type, source)` — cross-source mixing is never permitted.
- **Derived tables (Approach B).** `player_season_totals` is computed first via a single aggregation over `player_game_box`. `player_season_per_game` is then derived from `player_season_totals` by simple division — one fact-table scan total, guaranteed consistency, clean foundation for T031.
- **All season types rolled up in one pass.** The `GROUP BY` includes `season_type`, so Regular, Playoffs, PlayIn, etc. are automatically separated without a `--season-type` flag.
- **SQL in `metis-db/src/queries/`.** Follows the established convention — no raw SQL in `metis-compute` or `metis-cli`.

---

## Schema (new migrations)

### `0005_player_season_rollups.sql`

**`player_season_totals`** — one row per `(player_id, season_id, season_type, source)`.

| Column | Type | Notes |
|---|---|---|
| `id` | `BIGINT` | Sequence PK |
| `player_id` | `TEXT NOT NULL` | FK → `player(id)` |
| `season_id` | `TEXT NOT NULL` | e.g. `"2024-25"` |
| `season_type` | `TEXT NOT NULL` | `"Regular"`, `"Playoffs"`, etc. |
| `source` | `TEXT NOT NULL` | e.g. `"nba_stats"` |
| `games_played` | `INTEGER NOT NULL` | `COUNT(DISTINCT game_id)` |
| `minutes_played` | `DECIMAL(7,2)` | Nullable — NULL if all game rows had NULL |
| `points` | `INTEGER` | Nullable |
| `rebounds_offensive` | `INTEGER` | Nullable |
| `rebounds_defensive` | `INTEGER` | Nullable |
| `rebounds_total` | `INTEGER` | Nullable |
| `assists` | `INTEGER` | Nullable |
| `steals` | `INTEGER` | Nullable |
| `blocks` | `INTEGER` | Nullable |
| `turnovers` | `INTEGER` | Nullable |
| `personal_fouls` | `INTEGER` | Nullable |
| `field_goals_made` | `INTEGER` | Nullable |
| `field_goals_attempted` | `INTEGER` | Nullable |
| `three_pointers_made` | `INTEGER` | Nullable |
| `three_pointers_attempted` | `INTEGER` | Nullable |
| `free_throws_made` | `INTEGER` | Nullable |
| `free_throws_attempted` | `INTEGER` | Nullable |
| `computed_at` | `TIMESTAMP NOT NULL` | `DEFAULT current_timestamp` |

Unique index on `(player_id, season_id, season_type, source)`.

**`player_season_per_game`** — same key columns, stats stored as `DECIMAL(6,2)` averages (total / games_played). Nullable if the corresponding total was NULL. Includes `games_played INTEGER NOT NULL` (copied from totals for convenience).

Unique index on `(player_id, season_id, season_type, source)`.

### `0006_team_season_rollups.sql`

`team_season_totals` and `team_season_per_game` — identical pattern, keyed by `team_id`. Includes team-specific columns from `team_game_box`: `fast_break_points`, `points_in_paint`, `second_chance_points`, `bench_points`.

---

## `metis-db` Layer

### `src/queries/season_rollup.rs`

All SQL lives here. Four upsert functions and one count:

- `count_player_box_rows(conn, season_id, source) -> Result<u64>` — pre-flight check
- `upsert_player_totals(conn, season_id, source) -> Result<u64>` — `INSERT INTO player_season_totals SELECT ... FROM player_game_box WHERE season_id = ? AND source = ? GROUP BY ... ON CONFLICT DO UPDATE SET ...`
- `upsert_player_per_game(conn, season_id, source) -> Result<u64>` — `INSERT INTO player_season_per_game SELECT ..., CAST(points AS DECIMAL) / games_played, ... FROM player_season_totals WHERE season_id = ? AND source = ? ON CONFLICT DO UPDATE SET ...`
- `upsert_team_totals` / `upsert_team_per_game` — same pattern for teams

### `src/repos/season_rollup.rs`

`SeasonRollupRepo<'conn>` with methods:
- `compute_player_totals(&self, season_id, source) -> Result<u64>`
- `compute_player_per_game(&self, season_id, source) -> Result<u64>`
- `compute_team_totals(&self, season_id, source) -> Result<u64>`
- `compute_team_per_game(&self, season_id, source) -> Result<u64>`
- `count_player_box_rows(&self, season_id, source) -> Result<u64>`

`Db` gets a new accessor: `pub fn season_rollups(&self) -> SeasonRollupRepo<'_>`.

### `src/model/`

`PlayerSeasonTotals`, `PlayerSeasonPerGame`, `TeamSeasonTotals`, `TeamSeasonPerGame` structs — needed for test assertions, following the `PlayerGameBox` pattern.

---

## `metis-compute` Layer

### `Cargo.toml` — new dependencies

```toml
[dependencies]
metis-db   = { path = "../metis-db" }
metis-core = { path = "../metis-core" }
thiserror  = { workspace = true }
```

(`anyhow` stays out — library crate.)

### `src/error.rs`

```rust
pub enum ComputeError {
    NoSourceData { season: String, source: String },
    Db(#[from] metis_db::DbError),
}
```

`NoSourceData` formats as:
> `No player_game_box rows for season=2024-25 source=nba_stats. Did you forget: metis-cli load box-scores --season 2024 --source nba_stats?`

### `src/season_rollups.rs`

```rust
pub fn compute_season_rollups(
    db: &Db,
    season: Season,
    source: &str,
) -> Result<RollupSummary, ComputeError>
```

Execution order:
1. `count_player_box_rows` → return `NoSourceData` if 0
2. `compute_player_totals` → `compute_player_per_game`
3. `compute_team_totals` → `compute_team_per_game`
4. Return `RollupSummary { player_rows: u64, team_rows: u64 }`

`lib.rs` re-exports `compute_season_rollups`, `RollupSummary`, `ComputeError`.

---

## `metis-cli` Command

New subcommand alongside `Load`:

```
metis-cli compute season-rollups --season 2024 --source nba_stats
```

`Commands::Compute(ComputeArgs)` → `ComputeEntity::SeasonRollups { season: u32, source: String }`.

On success:
```
Computed rollups for 529 players, 30 teams (season=2024-25, source=nba_stats).
```

On `NoSourceData`: print the hint message, exit non-zero.

---

## Testing Strategy

| Layer | What | How |
|---|---|---|
| `metis-db` | `SeasonRollupRepo` unit tests | `open_test_db()`, insert box rows, assert totals sums, assert per-game division, assert idempotency (same row count on re-run), assert zero-row returns 0 |
| `metis-compute` | `compute_season_rollups` integration test | Insert box rows via `metis-db`, call function, assert `RollupSummary` counts, spot-check specific stat values, assert `NoSourceData` when no rows |
| `metis-cli` | No new CLI test | Compute integration test is the acceptance gate; T022 already established the CLI pattern |

---

## Future Notes

When T041 (reconciliation) ships, add to `decisions.md` (likely ADR 015): rollups are always single-source. The "canonical" source from T041 is materialized under its own source name and rolled up like any other — no multi-source merging inside the rollup layer.
