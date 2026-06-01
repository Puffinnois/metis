# T030 Season Rollups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Materialize `player_season_totals`, `player_season_per_game`, `team_season_totals`, and `team_season_per_game` from box score fact tables, triggered via `metis-cli compute season-rollups --season 2024 --source nba_stats`.

**Architecture:** SQL migrations add four new tables. All SQL lives in `metis-db/src/queries/season_rollup.rs` per project convention. `metis-compute` orchestrates the compute sequence (totals first, per-game derived from totals) and exposes one public function `compute_season_rollups`. `metis-cli` adds a `Compute` subcommand that calls into `metis-compute`.

**Tech Stack:** Rust, DuckDB (`duckdb` crate, bundled), `thiserror`, `clap` (for CLI), `metis-db`, `metis-core`, `metis-compute`.

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `sql/migrations/0005_player_season_rollups.sql` | `player_season_totals` + `player_season_per_game` tables |
| Create | `sql/migrations/0006_team_season_rollups.sql` | `team_season_totals` + `team_season_per_game` tables |
| Create | `crates/metis-db/src/model/player_season_totals.rs` | Rust struct for the totals table |
| Create | `crates/metis-db/src/model/player_season_per_game.rs` | Rust struct for the per-game table |
| Create | `crates/metis-db/src/model/team_season_totals.rs` | Rust struct for team totals |
| Create | `crates/metis-db/src/model/team_season_per_game.rs` | Rust struct for team per-game |
| Create | `crates/metis-db/src/queries/season.rs` | `upsert` for the `season` dimension (needed by integration tests) |
| Create | `crates/metis-db/src/queries/season_rollup.rs` | All aggregation SQL |
| Create | `crates/metis-db/src/repos/season.rs` | `SeasonRepo` with `upsert` |
| Create | `crates/metis-db/src/repos/season_rollup.rs` | `SeasonRollupRepo` with compute + list methods |
| Modify | `crates/metis-db/src/model.rs` | Add 4 new model modules |
| Modify | `crates/metis-db/src/queries.rs` | Add `season` + `season_rollup` modules |
| Modify | `crates/metis-db/src/repos.rs` | Add `season` + `season_rollup` modules |
| Modify | `crates/metis-db/src/db.rs` | Add `seasons()` + `season_rollups()` accessors |
| Modify | `crates/metis-compute/Cargo.toml` | Add `metis-db`, `metis-core`, `thiserror` deps |
| Create | `crates/metis-compute/src/error.rs` | `ComputeError` enum |
| Create | `crates/metis-compute/src/season_rollups.rs` | `compute_season_rollups` orchestration function |
| Modify | `crates/metis-compute/src/lib.rs` | Re-export public API |
| Create | `crates/metis-compute/tests/season_rollups.rs` | Integration test |
| Modify | `crates/metis-cli/Cargo.toml` | Add `metis-compute` dep |
| Modify | `crates/metis-cli/src/main.rs` | Add `Compute` subcommand |

---

## Task 1: SQL Migrations

**Files:**
- Create: `sql/migrations/0005_player_season_rollups.sql`
- Create: `sql/migrations/0006_team_season_rollups.sql`

- [ ] **Step 1: Write `0005_player_season_rollups.sql`**

```sql
-- player_season_totals: one row per (player_id, season_id, season_type, source).
-- Counting stats summed from player_game_box. plus_minus excluded (see design spec).
-- Nullable stats follow the box table convention: NULL when source did not report.

CREATE SEQUENCE IF NOT EXISTS seq_player_season_totals START 1;
CREATE SEQUENCE IF NOT EXISTS seq_player_season_per_game START 1;

CREATE TABLE IF NOT EXISTS player_season_totals (
    id                       BIGINT       DEFAULT nextval('seq_player_season_totals') PRIMARY KEY,
    player_id                TEXT         NOT NULL REFERENCES player(id),
    season_id                TEXT         NOT NULL,
    season_type              TEXT         NOT NULL,
    source                   TEXT         NOT NULL,
    games_played             INTEGER      NOT NULL,
    minutes_played           DECIMAL(7,2),
    points                   INTEGER,
    rebounds_offensive       INTEGER,
    rebounds_defensive       INTEGER,
    rebounds_total           INTEGER,
    assists                  INTEGER,
    steals                   INTEGER,
    blocks                   INTEGER,
    turnovers                INTEGER,
    personal_fouls           INTEGER,
    field_goals_made         INTEGER,
    field_goals_attempted    INTEGER,
    three_pointers_made      INTEGER,
    three_pointers_attempted INTEGER,
    free_throws_made         INTEGER,
    free_throws_attempted    INTEGER,
    computed_at              TIMESTAMP    NOT NULL DEFAULT current_timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_player_season_totals
    ON player_season_totals (player_id, season_id, season_type, source);

-- player_season_per_game: derived from player_season_totals (total / games_played).
-- Column names mirror player_season_totals; types are DECIMAL(6,2).

CREATE TABLE IF NOT EXISTS player_season_per_game (
    id                       BIGINT       DEFAULT nextval('seq_player_season_per_game') PRIMARY KEY,
    player_id                TEXT         NOT NULL REFERENCES player(id),
    season_id                TEXT         NOT NULL,
    season_type              TEXT         NOT NULL,
    source                   TEXT         NOT NULL,
    games_played             INTEGER      NOT NULL,
    minutes_played           DECIMAL(6,2),
    points                   DECIMAL(6,2),
    rebounds_offensive       DECIMAL(6,2),
    rebounds_defensive       DECIMAL(6,2),
    rebounds_total           DECIMAL(6,2),
    assists                  DECIMAL(6,2),
    steals                   DECIMAL(6,2),
    blocks                   DECIMAL(6,2),
    turnovers                DECIMAL(6,2),
    personal_fouls           DECIMAL(6,2),
    field_goals_made         DECIMAL(6,2),
    field_goals_attempted    DECIMAL(6,2),
    three_pointers_made      DECIMAL(6,2),
    three_pointers_attempted DECIMAL(6,2),
    free_throws_made         DECIMAL(6,2),
    free_throws_attempted    DECIMAL(6,2),
    computed_at              TIMESTAMP    NOT NULL DEFAULT current_timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_player_season_per_game
    ON player_season_per_game (player_id, season_id, season_type, source);
```

- [ ] **Step 2: Write `0006_team_season_rollups.sql`**

```sql
-- team_season_totals: one row per (team_id, season_id, season_type, source).
-- Includes team-specific columns absent from player box: fast_break_points, etc.
-- No minutes_played: teams don't have individual minutes in the traditional box score.

CREATE SEQUENCE IF NOT EXISTS seq_team_season_totals START 1;
CREATE SEQUENCE IF NOT EXISTS seq_team_season_per_game START 1;

CREATE TABLE IF NOT EXISTS team_season_totals (
    id                       BIGINT       DEFAULT nextval('seq_team_season_totals') PRIMARY KEY,
    team_id                  TEXT         NOT NULL REFERENCES team(id),
    season_id                TEXT         NOT NULL,
    season_type              TEXT         NOT NULL,
    source                   TEXT         NOT NULL,
    games_played             INTEGER      NOT NULL,
    points                   INTEGER,
    rebounds_offensive       INTEGER,
    rebounds_defensive       INTEGER,
    rebounds_total           INTEGER,
    assists                  INTEGER,
    steals                   INTEGER,
    blocks                   INTEGER,
    turnovers                INTEGER,
    personal_fouls           INTEGER,
    field_goals_made         INTEGER,
    field_goals_attempted    INTEGER,
    three_pointers_made      INTEGER,
    three_pointers_attempted INTEGER,
    free_throws_made         INTEGER,
    free_throws_attempted    INTEGER,
    fast_break_points        INTEGER,
    points_in_paint          INTEGER,
    second_chance_points     INTEGER,
    bench_points             INTEGER,
    computed_at              TIMESTAMP    NOT NULL DEFAULT current_timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_team_season_totals
    ON team_season_totals (team_id, season_id, season_type, source);

-- team_season_per_game: derived from team_season_totals (total / games_played).

CREATE TABLE IF NOT EXISTS team_season_per_game (
    id                       BIGINT       DEFAULT nextval('seq_team_season_per_game') PRIMARY KEY,
    team_id                  TEXT         NOT NULL REFERENCES team(id),
    season_id                TEXT         NOT NULL,
    season_type              TEXT         NOT NULL,
    source                   TEXT         NOT NULL,
    games_played             INTEGER      NOT NULL,
    points                   DECIMAL(6,2),
    rebounds_offensive       DECIMAL(6,2),
    rebounds_defensive       DECIMAL(6,2),
    rebounds_total           DECIMAL(6,2),
    assists                  DECIMAL(6,2),
    steals                   DECIMAL(6,2),
    blocks                   DECIMAL(6,2),
    turnovers                DECIMAL(6,2),
    personal_fouls           DECIMAL(6,2),
    field_goals_made         DECIMAL(6,2),
    field_goals_attempted    DECIMAL(6,2),
    three_pointers_made      DECIMAL(6,2),
    three_pointers_attempted DECIMAL(6,2),
    free_throws_made         DECIMAL(6,2),
    free_throws_attempted    DECIMAL(6,2),
    fast_break_points        DECIMAL(6,2),
    points_in_paint          DECIMAL(6,2),
    second_chance_points     DECIMAL(6,2),
    bench_points             DECIMAL(6,2),
    computed_at              TIMESTAMP    NOT NULL DEFAULT current_timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_team_season_per_game
    ON team_season_per_game (team_id, season_id, season_type, source);
```

- [ ] **Step 3: Verify migrations apply**

```bash
cargo test -p metis-db 2>&1 | head -40
```

Expected: all existing tests pass. The migration runner test (`migrate_twice_is_noop`) uses an in-memory DB with a test migration file, so it won't pick up the new SQL files directly — but the tests that use `open_test_db()` (which reads from `sql/migrations/`) will now include the new tables. All tests should still pass.

- [ ] **Step 4: Commit**

```bash
git add sql/migrations/0005_player_season_rollups.sql sql/migrations/0006_team_season_rollups.sql
git commit -m "feat(db): add season rollup schema migrations (0005, 0006)"
```

---

## Task 2: Model Structs + SeasonRepo

**Files:**
- Create: `crates/metis-db/src/model/player_season_totals.rs`
- Create: `crates/metis-db/src/model/player_season_per_game.rs`
- Create: `crates/metis-db/src/model/team_season_totals.rs`
- Create: `crates/metis-db/src/model/team_season_per_game.rs`
- Create: `crates/metis-db/src/queries/season.rs`
- Create: `crates/metis-db/src/repos/season.rs`
- Modify: `crates/metis-db/src/model.rs`
- Modify: `crates/metis-db/src/queries.rs`
- Modify: `crates/metis-db/src/repos.rs`
- Modify: `crates/metis-db/src/db.rs`

`SeasonRepo` is added here because the `metis-compute` integration test (Task 6) needs a public way to insert season dimension rows. There is no other public API for this yet.

- [ ] **Step 1: Write `model/player_season_totals.rs`**

```rust
/// A row from the `player_season_totals` materialized table.
///
/// One row per `(player_id, season_id, season_type, source)`.
/// All counting stats are `None` when the source did not report them.
#[derive(Debug, Clone, PartialEq)]
pub struct PlayerSeasonTotals {
    pub id: i64,
    pub player_id: String,
    pub season_id: String,
    pub season_type: String,
    pub source: String,
    pub games_played: i32,
    pub minutes_played: Option<f64>,
    pub points: Option<i32>,
    pub rebounds_offensive: Option<i32>,
    pub rebounds_defensive: Option<i32>,
    pub rebounds_total: Option<i32>,
    pub assists: Option<i32>,
    pub steals: Option<i32>,
    pub blocks: Option<i32>,
    pub turnovers: Option<i32>,
    pub personal_fouls: Option<i32>,
    pub field_goals_made: Option<i32>,
    pub field_goals_attempted: Option<i32>,
    pub three_pointers_made: Option<i32>,
    pub three_pointers_attempted: Option<i32>,
    pub free_throws_made: Option<i32>,
    pub free_throws_attempted: Option<i32>,
    pub computed_at: Option<String>,
}
```

- [ ] **Step 2: Write `model/player_season_per_game.rs`**

```rust
/// A row from the `player_season_per_game` materialized table.
///
/// One row per `(player_id, season_id, season_type, source)`.
/// Stat columns hold `total / games_played`; `None` when the total was `None`.
#[derive(Debug, Clone, PartialEq)]
pub struct PlayerSeasonPerGame {
    pub id: i64,
    pub player_id: String,
    pub season_id: String,
    pub season_type: String,
    pub source: String,
    pub games_played: i32,
    pub minutes_played: Option<f64>,
    pub points: Option<f64>,
    pub rebounds_offensive: Option<f64>,
    pub rebounds_defensive: Option<f64>,
    pub rebounds_total: Option<f64>,
    pub assists: Option<f64>,
    pub steals: Option<f64>,
    pub blocks: Option<f64>,
    pub turnovers: Option<f64>,
    pub personal_fouls: Option<f64>,
    pub field_goals_made: Option<f64>,
    pub field_goals_attempted: Option<f64>,
    pub three_pointers_made: Option<f64>,
    pub three_pointers_attempted: Option<f64>,
    pub free_throws_made: Option<f64>,
    pub free_throws_attempted: Option<f64>,
    pub computed_at: Option<String>,
}
```

- [ ] **Step 3: Write `model/team_season_totals.rs`**

```rust
/// A row from the `team_season_totals` materialized table.
///
/// One row per `(team_id, season_id, season_type, source)`.
#[derive(Debug, Clone, PartialEq)]
pub struct TeamSeasonTotals {
    pub id: i64,
    pub team_id: String,
    pub season_id: String,
    pub season_type: String,
    pub source: String,
    pub games_played: i32,
    pub points: Option<i32>,
    pub rebounds_offensive: Option<i32>,
    pub rebounds_defensive: Option<i32>,
    pub rebounds_total: Option<i32>,
    pub assists: Option<i32>,
    pub steals: Option<i32>,
    pub blocks: Option<i32>,
    pub turnovers: Option<i32>,
    pub personal_fouls: Option<i32>,
    pub field_goals_made: Option<i32>,
    pub field_goals_attempted: Option<i32>,
    pub three_pointers_made: Option<i32>,
    pub three_pointers_attempted: Option<i32>,
    pub free_throws_made: Option<i32>,
    pub free_throws_attempted: Option<i32>,
    pub fast_break_points: Option<i32>,
    pub points_in_paint: Option<i32>,
    pub second_chance_points: Option<i32>,
    pub bench_points: Option<i32>,
    pub computed_at: Option<String>,
}
```

- [ ] **Step 4: Write `model/team_season_per_game.rs`**

```rust
/// A row from the `team_season_per_game` materialized table.
///
/// One row per `(team_id, season_id, season_type, source)`.
/// Stat columns hold `total / games_played`; `None` when the total was `None`.
#[derive(Debug, Clone, PartialEq)]
pub struct TeamSeasonPerGame {
    pub id: i64,
    pub team_id: String,
    pub season_id: String,
    pub season_type: String,
    pub source: String,
    pub games_played: i32,
    pub points: Option<f64>,
    pub rebounds_offensive: Option<f64>,
    pub rebounds_defensive: Option<f64>,
    pub rebounds_total: Option<f64>,
    pub assists: Option<f64>,
    pub steals: Option<f64>,
    pub blocks: Option<f64>,
    pub turnovers: Option<f64>,
    pub personal_fouls: Option<f64>,
    pub field_goals_made: Option<f64>,
    pub field_goals_attempted: Option<f64>,
    pub three_pointers_made: Option<f64>,
    pub three_pointers_attempted: Option<f64>,
    pub free_throws_made: Option<f64>,
    pub free_throws_attempted: Option<f64>,
    pub fast_break_points: Option<f64>,
    pub points_in_paint: Option<f64>,
    pub second_chance_points: Option<f64>,
    pub bench_points: Option<f64>,
    pub computed_at: Option<String>,
}
```

- [ ] **Step 5: Update `model.rs`**

Replace the existing content with:

```rust
pub mod game;
pub mod player;
pub mod player_game_box;
pub mod player_season_per_game;
pub mod player_season_totals;
pub mod team;
pub mod team_game_box;
pub mod team_season_per_game;
pub mod team_season_totals;
```

- [ ] **Step 6: Write `queries/season.rs`**

```rust
use duckdb::{params, Connection};

use crate::error::Result;

/// Inserts a season dimension row, ignoring conflicts.
///
/// `season_id` must match `metis_core::Season::to_string()` format, e.g. `"2023-24"`.
/// `end_year` is derived as `start_year + 1`.
pub(crate) fn upsert(
    conn: &Connection,
    season_id: &str,
    league_id: &str,
    start_year: i16,
) -> Result<()> {
    conn.execute(
        "INSERT INTO season (id, league_id, start_year, end_year)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (id) DO NOTHING",
        params![season_id, league_id, start_year, start_year + 1],
    )?;
    Ok(())
}
```

- [ ] **Step 7: Write `repos/season.rs`**

```rust
use duckdb::Connection;

use crate::error::Result;
use crate::queries;

/// Repository for the `season` dimension table.
///
/// Obtain via [`crate::Db::seasons`].
pub struct SeasonRepo<'conn> {
    conn: &'conn Connection,
}

impl<'conn> SeasonRepo<'conn> {
    pub(crate) fn new(conn: &'conn Connection) -> Self {
        Self { conn }
    }

    /// Inserts or ignores a season row.
    ///
    /// `season_id` must match `metis_core::Season::to_string()` format, e.g. `"2023-24"`.
    /// `start_year` is the first calendar year of the season (e.g. `2023`).
    pub fn upsert(&self, season_id: &str, league_id: &str, start_year: i16) -> Result<()> {
        queries::season::upsert(self.conn, season_id, league_id, start_year)
    }
}
```

- [ ] **Step 8: Update `queries.rs`**

```rust
pub mod game;
pub mod player;
pub mod player_game_box;
pub mod season;
pub mod season_rollup;
pub mod team;
pub mod team_game_box;
```

- [ ] **Step 9: Update `repos.rs`**

```rust
pub mod game;
pub mod player;
pub mod player_game_box;
pub mod season;
pub mod season_rollup;
pub mod team;
pub mod team_game_box;
```

- [ ] **Step 10: Add accessors to `db.rs`**

Add these two methods inside the `impl Db` block, after the existing `team_game_boxes()` method:

```rust
    /// Returns a handle to the season dimension repository.
    pub fn seasons(&self) -> crate::repos::season::SeasonRepo<'_> {
        crate::repos::season::SeasonRepo::new(&self.conn)
    }

    /// Returns a handle to the season rollup compute repository.
    pub fn season_rollups(&self) -> crate::repos::season_rollup::SeasonRollupRepo<'_> {
        crate::repos::season_rollup::SeasonRollupRepo::new(&self.conn)
    }
```

- [ ] **Step 11: Compile check**

```bash
cargo check -p metis-db 2>&1
```

Expected: no errors. The `queries/season_rollup.rs` and `repos/season_rollup.rs` files don't exist yet, so you will see "file not found" errors for those modules. Create empty placeholder files to unblock:

```bash
touch crates/metis-db/src/queries/season_rollup.rs
touch crates/metis-db/src/repos/season_rollup.rs
```

Then re-run:

```bash
cargo check -p metis-db 2>&1
```

Expected: no errors (empty modules are valid Rust).

- [ ] **Step 12: Commit**

```bash
git add crates/metis-db/src/model/ crates/metis-db/src/model.rs \
        crates/metis-db/src/queries/season.rs crates/metis-db/src/queries/season_rollup.rs \
        crates/metis-db/src/queries.rs \
        crates/metis-db/src/repos/season.rs crates/metis-db/src/repos/season_rollup.rs \
        crates/metis-db/src/repos.rs crates/metis-db/src/db.rs
git commit -m "feat(db): add season rollup model structs, SeasonRepo, and module wiring"
```

---

## Task 3: Player Rollup Queries + Repo (TDD)

**Files:**
- Modify: `crates/metis-db/src/queries/season_rollup.rs`
- Modify: `crates/metis-db/src/repos/season_rollup.rs`

- [ ] **Step 1: Write failing tests in `repos/season_rollup.rs`**

Replace the empty file with:

```rust
use duckdb::Connection;

use crate::error::Result;
use crate::model::player_season_per_game::PlayerSeasonPerGame;
use crate::model::player_season_totals::PlayerSeasonTotals;
use crate::model::team_season_per_game::TeamSeasonPerGame;
use crate::model::team_season_totals::TeamSeasonTotals;
use crate::queries;

/// Repository for computing and reading season rollup materialized tables.
///
/// Obtain via [`crate::Db::season_rollups`].
pub struct SeasonRollupRepo<'conn> {
    conn: &'conn Connection,
}

impl<'conn> SeasonRollupRepo<'conn> {
    pub(crate) fn new(conn: &'conn Connection) -> Self {
        Self { conn }
    }

    /// Returns the number of `player_game_box` rows for the given season and source.
    /// Used as a pre-flight check before computing rollups.
    pub fn count_player_box_rows(&self, season_id: &str, source: &str) -> Result<u64> {
        queries::season_rollup::count_player_box_rows(self.conn, season_id, source)
    }

    /// Aggregates `player_game_box` into `player_season_totals` for the given season+source.
    /// Returns the number of rows inserted or updated.
    pub fn compute_player_totals(&self, season_id: &str, source: &str) -> Result<u64> {
        queries::season_rollup::upsert_player_totals(self.conn, season_id, source)
    }

    /// Derives `player_season_per_game` from `player_season_totals` by dividing each stat
    /// by `games_played`. Must be called after `compute_player_totals`.
    /// Returns the number of rows inserted or updated.
    pub fn compute_player_per_game(&self, season_id: &str, source: &str) -> Result<u64> {
        queries::season_rollup::upsert_player_per_game(self.conn, season_id, source)
    }

    /// Returns all `player_season_totals` rows for the given season+source.
    pub fn list_player_totals(
        &self,
        season_id: &str,
        source: &str,
    ) -> Result<Vec<PlayerSeasonTotals>> {
        queries::season_rollup::list_player_totals(self.conn, season_id, source)
    }

    /// Returns all `player_season_per_game` rows for the given season+source.
    pub fn list_player_per_game(
        &self,
        season_id: &str,
        source: &str,
    ) -> Result<Vec<PlayerSeasonPerGame>> {
        queries::season_rollup::list_player_per_game(self.conn, season_id, source)
    }

    /// Aggregates `team_game_box` into `team_season_totals` for the given season+source.
    /// Returns the number of rows inserted or updated.
    pub fn compute_team_totals(&self, season_id: &str, source: &str) -> Result<u64> {
        queries::season_rollup::upsert_team_totals(self.conn, season_id, source)
    }

    /// Derives `team_season_per_game` from `team_season_totals`. Must be called after
    /// `compute_team_totals`. Returns the number of rows inserted or updated.
    pub fn compute_team_per_game(&self, season_id: &str, source: &str) -> Result<u64> {
        queries::season_rollup::upsert_team_per_game(self.conn, season_id, source)
    }

    /// Returns all `team_season_totals` rows for the given season+source.
    pub fn list_team_totals(
        &self,
        season_id: &str,
        source: &str,
    ) -> Result<Vec<TeamSeasonTotals>> {
        queries::season_rollup::list_team_totals(self.conn, season_id, source)
    }

    /// Returns all `team_season_per_game` rows for the given season+source.
    pub fn list_team_per_game(
        &self,
        season_id: &str,
        source: &str,
    ) -> Result<Vec<TeamSeasonPerGame>> {
        queries::season_rollup::list_team_per_game(self.conn, season_id, source)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::player_game_box::PlayerGameBox;
    use crate::test_helpers::{insert_game, insert_player, insert_season, insert_team, open_test_db};

    fn player_box(game_id: &str, player_id: &str, points: i16, minutes: f64) -> PlayerGameBox {
        PlayerGameBox {
            id: 0,
            game_id: game_id.to_string(),
            player_id: player_id.to_string(),
            team_id: "NBA_LAL".to_string(),
            season_id: "2023-24".to_string(),
            season_type: "Regular".to_string(),
            starter: Some(true),
            minutes_played: Some(minutes),
            points: Some(points),
            rebounds_offensive: Some(1),
            rebounds_defensive: Some(5),
            rebounds_total: Some(6),
            assists: Some(4),
            steals: Some(1),
            blocks: Some(0),
            turnovers: Some(2),
            personal_fouls: Some(2),
            field_goals_made: Some(5),
            field_goals_attempted: Some(12),
            three_pointers_made: Some(1),
            three_pointers_attempted: Some(3),
            free_throws_made: Some(2),
            free_throws_attempted: Some(3),
            plus_minus: Some(4),
            source: "nba_stats".to_string(),
            source_url: "https://stats.nba.com/".to_string(),
            fetched_at: "2024-01-15 12:00:00".to_string(),
            source_payload: "{}".to_string(),
            ingested_at: None,
        }
    }

    fn setup(db: &crate::Db) {
        insert_team(db, "NBA_LAL", "NBA");
        insert_team(db, "NBA_BOS", "NBA");
        insert_player(db, "NBA_P001", "NBA");
        insert_player(db, "NBA_P002", "NBA");
        insert_season(db, "2023-24", "NBA");
        insert_game(db, "G001", "NBA", "2023-24", "NBA_LAL", "NBA_BOS");
        insert_game(db, "G002", "NBA", "2023-24", "NBA_LAL", "NBA_BOS");
    }

    #[test]
    fn count_player_box_rows_zero_when_empty() {
        let db = open_test_db();
        setup(&db);
        let n = db
            .season_rollups()
            .count_player_box_rows("2023-24", "nba_stats")
            .unwrap();
        assert_eq!(n, 0);
    }

    #[test]
    fn count_player_box_rows_after_insert() {
        let db = open_test_db();
        setup(&db);
        db.player_game_boxes()
            .upsert(&player_box("G001", "NBA_P001", 28, 36.0))
            .unwrap();
        let n = db
            .season_rollups()
            .count_player_box_rows("2023-24", "nba_stats")
            .unwrap();
        assert_eq!(n, 1);
    }

    #[test]
    fn compute_player_totals_sums_correctly() {
        let db = open_test_db();
        setup(&db);
        let boxes = db.player_game_boxes();
        // P001 plays two games: 28 pts + 22 pts = 50 pts total, 2 games
        boxes.upsert(&player_box("G001", "NBA_P001", 28, 36.0)).unwrap();
        boxes.upsert(&player_box("G002", "NBA_P001", 22, 32.0)).unwrap();

        let repo = db.season_rollups();
        let n = repo.compute_player_totals("2023-24", "nba_stats").unwrap();
        assert_eq!(n, 1, "one player → one totals row");

        let rows = repo.list_player_totals("2023-24", "nba_stats").unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].player_id, "NBA_P001");
        assert_eq!(rows[0].games_played, 2);
        assert_eq!(rows[0].points, Some(50));
        // minutes: 36.0 + 32.0 = 68.0
        assert_eq!(rows[0].minutes_played, Some(68.0));
        // field_goals_made: 5 + 5 = 10
        assert_eq!(rows[0].field_goals_made, Some(10));
    }

    #[test]
    fn compute_player_totals_separates_two_players() {
        let db = open_test_db();
        setup(&db);
        let boxes = db.player_game_boxes();
        boxes.upsert(&player_box("G001", "NBA_P001", 28, 36.0)).unwrap();
        boxes.upsert(&player_box("G001", "NBA_P002", 15, 24.0)).unwrap();

        let repo = db.season_rollups();
        let n = repo.compute_player_totals("2023-24", "nba_stats").unwrap();
        assert_eq!(n, 2, "two players → two totals rows");

        let rows = repo.list_player_totals("2023-24", "nba_stats").unwrap();
        assert_eq!(rows.len(), 2);
    }

    #[test]
    fn compute_player_totals_is_idempotent() {
        let db = open_test_db();
        setup(&db);
        db.player_game_boxes()
            .upsert(&player_box("G001", "NBA_P001", 28, 36.0))
            .unwrap();

        let repo = db.season_rollups();
        repo.compute_player_totals("2023-24", "nba_stats").unwrap();
        repo.compute_player_totals("2023-24", "nba_stats").unwrap();

        let rows = repo.list_player_totals("2023-24", "nba_stats").unwrap();
        assert_eq!(rows.len(), 1, "re-run must not duplicate rows");
    }

    #[test]
    fn compute_player_per_game_divides_correctly() {
        let db = open_test_db();
        setup(&db);
        let boxes = db.player_game_boxes();
        boxes.upsert(&player_box("G001", "NBA_P001", 28, 36.0)).unwrap();
        boxes.upsert(&player_box("G002", "NBA_P001", 22, 32.0)).unwrap();
        // totals: 50 pts over 2 games → 25.0 ppg; 68.0 min → 34.0 mpg

        let repo = db.season_rollups();
        repo.compute_player_totals("2023-24", "nba_stats").unwrap();
        let n = repo
            .compute_player_per_game("2023-24", "nba_stats")
            .unwrap();
        assert_eq!(n, 1);

        let rows = repo.list_player_per_game("2023-24", "nba_stats").unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].games_played, 2);
        assert_eq!(rows[0].points, Some(25.0));
        assert_eq!(rows[0].minutes_played, Some(34.0));
    }

    #[test]
    fn compute_player_per_game_is_idempotent() {
        let db = open_test_db();
        setup(&db);
        db.player_game_boxes()
            .upsert(&player_box("G001", "NBA_P001", 28, 36.0))
            .unwrap();

        let repo = db.season_rollups();
        repo.compute_player_totals("2023-24", "nba_stats").unwrap();
        repo.compute_player_per_game("2023-24", "nba_stats").unwrap();
        repo.compute_player_per_game("2023-24", "nba_stats").unwrap();

        let rows = repo.list_player_per_game("2023-24", "nba_stats").unwrap();
        assert_eq!(rows.len(), 1, "re-run must not duplicate rows");
    }
}
```

- [ ] **Step 2: Run failing tests**

```bash
cargo test -p metis-db season_rollup 2>&1 | head -30
```

Expected: compilation error — functions in `queries::season_rollup` don't exist yet.

- [ ] **Step 3: Implement player functions in `queries/season_rollup.rs`**

Replace the empty file with:

```rust
use duckdb::{params, Connection};

use crate::error::Result;
use crate::model::player_season_per_game::PlayerSeasonPerGame;
use crate::model::player_season_totals::PlayerSeasonTotals;
use crate::model::team_season_per_game::TeamSeasonPerGame;
use crate::model::team_season_totals::TeamSeasonTotals;

// ── Player queries ───────────────────────────────────────────────────────────

pub(crate) fn count_player_box_rows(
    conn: &Connection,
    season_id: &str,
    source: &str,
) -> Result<u64> {
    let n: i64 = conn.query_row(
        "SELECT COUNT(*) FROM player_game_box WHERE season_id = ? AND source = ?",
        params![season_id, source],
        |row| row.get(0),
    )?;
    Ok(n as u64)
}

const UPSERT_PLAYER_TOTALS: &str = "
    INSERT INTO player_season_totals (
        player_id, season_id, season_type, source, games_played,
        minutes_played, points, rebounds_offensive, rebounds_defensive,
        rebounds_total, assists, steals, blocks, turnovers, personal_fouls,
        field_goals_made, field_goals_attempted,
        three_pointers_made, three_pointers_attempted,
        free_throws_made, free_throws_attempted
    )
    SELECT
        player_id,
        season_id,
        season_type,
        source,
        COUNT(DISTINCT game_id)               AS games_played,
        SUM(minutes_played)                   AS minutes_played,
        SUM(points)                           AS points,
        SUM(rebounds_offensive)               AS rebounds_offensive,
        SUM(rebounds_defensive)               AS rebounds_defensive,
        SUM(rebounds_total)                   AS rebounds_total,
        SUM(assists)                          AS assists,
        SUM(steals)                           AS steals,
        SUM(blocks)                           AS blocks,
        SUM(turnovers)                        AS turnovers,
        SUM(personal_fouls)                   AS personal_fouls,
        SUM(field_goals_made)                 AS field_goals_made,
        SUM(field_goals_attempted)            AS field_goals_attempted,
        SUM(three_pointers_made)              AS three_pointers_made,
        SUM(three_pointers_attempted)         AS three_pointers_attempted,
        SUM(free_throws_made)                 AS free_throws_made,
        SUM(free_throws_attempted)            AS free_throws_attempted
    FROM player_game_box
    WHERE season_id = ? AND source = ?
    GROUP BY player_id, season_id, season_type, source
    ON CONFLICT (player_id, season_id, season_type, source) DO UPDATE SET
        games_played             = excluded.games_played,
        minutes_played           = excluded.minutes_played,
        points                   = excluded.points,
        rebounds_offensive       = excluded.rebounds_offensive,
        rebounds_defensive       = excluded.rebounds_defensive,
        rebounds_total           = excluded.rebounds_total,
        assists                  = excluded.assists,
        steals                   = excluded.steals,
        blocks                   = excluded.blocks,
        turnovers                = excluded.turnovers,
        personal_fouls           = excluded.personal_fouls,
        field_goals_made         = excluded.field_goals_made,
        field_goals_attempted    = excluded.field_goals_attempted,
        three_pointers_made      = excluded.three_pointers_made,
        three_pointers_attempted = excluded.three_pointers_attempted,
        free_throws_made         = excluded.free_throws_made,
        free_throws_attempted    = excluded.free_throws_attempted,
        computed_at              = now()
";

pub(crate) fn upsert_player_totals(
    conn: &Connection,
    season_id: &str,
    source: &str,
) -> Result<u64> {
    let n = conn.execute(UPSERT_PLAYER_TOTALS, params![season_id, source])?;
    Ok(n as u64)
}

const UPSERT_PLAYER_PER_GAME: &str = "
    INSERT INTO player_season_per_game (
        player_id, season_id, season_type, source, games_played,
        minutes_played, points, rebounds_offensive, rebounds_defensive,
        rebounds_total, assists, steals, blocks, turnovers, personal_fouls,
        field_goals_made, field_goals_attempted,
        three_pointers_made, three_pointers_attempted,
        free_throws_made, free_throws_attempted
    )
    SELECT
        player_id,
        season_id,
        season_type,
        source,
        games_played,
        CAST(minutes_played           AS DECIMAL(6,2)) / games_played,
        CAST(points                   AS DECIMAL(6,2)) / games_played,
        CAST(rebounds_offensive       AS DECIMAL(6,2)) / games_played,
        CAST(rebounds_defensive       AS DECIMAL(6,2)) / games_played,
        CAST(rebounds_total           AS DECIMAL(6,2)) / games_played,
        CAST(assists                  AS DECIMAL(6,2)) / games_played,
        CAST(steals                   AS DECIMAL(6,2)) / games_played,
        CAST(blocks                   AS DECIMAL(6,2)) / games_played,
        CAST(turnovers                AS DECIMAL(6,2)) / games_played,
        CAST(personal_fouls           AS DECIMAL(6,2)) / games_played,
        CAST(field_goals_made         AS DECIMAL(6,2)) / games_played,
        CAST(field_goals_attempted    AS DECIMAL(6,2)) / games_played,
        CAST(three_pointers_made      AS DECIMAL(6,2)) / games_played,
        CAST(three_pointers_attempted AS DECIMAL(6,2)) / games_played,
        CAST(free_throws_made         AS DECIMAL(6,2)) / games_played,
        CAST(free_throws_attempted    AS DECIMAL(6,2)) / games_played
    FROM player_season_totals
    WHERE season_id = ? AND source = ?
    ON CONFLICT (player_id, season_id, season_type, source) DO UPDATE SET
        games_played             = excluded.games_played,
        minutes_played           = excluded.minutes_played,
        points                   = excluded.points,
        rebounds_offensive       = excluded.rebounds_offensive,
        rebounds_defensive       = excluded.rebounds_defensive,
        rebounds_total           = excluded.rebounds_total,
        assists                  = excluded.assists,
        steals                   = excluded.steals,
        blocks                   = excluded.blocks,
        turnovers                = excluded.turnovers,
        personal_fouls           = excluded.personal_fouls,
        field_goals_made         = excluded.field_goals_made,
        field_goals_attempted    = excluded.field_goals_attempted,
        three_pointers_made      = excluded.three_pointers_made,
        three_pointers_attempted = excluded.three_pointers_attempted,
        free_throws_made         = excluded.free_throws_made,
        free_throws_attempted    = excluded.free_throws_attempted,
        computed_at              = now()
";

pub(crate) fn upsert_player_per_game(
    conn: &Connection,
    season_id: &str,
    source: &str,
) -> Result<u64> {
    let n = conn.execute(UPSERT_PLAYER_PER_GAME, params![season_id, source])?;
    Ok(n as u64)
}

const LIST_PLAYER_TOTALS: &str = "
    SELECT id, player_id, season_id, season_type, source, games_played,
           CAST(minutes_played AS DOUBLE),
           points, rebounds_offensive, rebounds_defensive, rebounds_total,
           assists, steals, blocks, turnovers, personal_fouls,
           field_goals_made, field_goals_attempted,
           three_pointers_made, three_pointers_attempted,
           free_throws_made, free_throws_attempted,
           CAST(computed_at AS VARCHAR)
    FROM player_season_totals
    WHERE season_id = ? AND source = ?
    ORDER BY player_id, season_type
";

fn map_player_totals(row: &duckdb::Row<'_>) -> duckdb::Result<PlayerSeasonTotals> {
    Ok(PlayerSeasonTotals {
        id: row.get(0)?,
        player_id: row.get(1)?,
        season_id: row.get(2)?,
        season_type: row.get(3)?,
        source: row.get(4)?,
        games_played: row.get(5)?,
        minutes_played: row.get(6)?,
        points: row.get(7)?,
        rebounds_offensive: row.get(8)?,
        rebounds_defensive: row.get(9)?,
        rebounds_total: row.get(10)?,
        assists: row.get(11)?,
        steals: row.get(12)?,
        blocks: row.get(13)?,
        turnovers: row.get(14)?,
        personal_fouls: row.get(15)?,
        field_goals_made: row.get(16)?,
        field_goals_attempted: row.get(17)?,
        three_pointers_made: row.get(18)?,
        three_pointers_attempted: row.get(19)?,
        free_throws_made: row.get(20)?,
        free_throws_attempted: row.get(21)?,
        computed_at: row.get(22)?,
    })
}

pub(crate) fn list_player_totals(
    conn: &Connection,
    season_id: &str,
    source: &str,
) -> Result<Vec<PlayerSeasonTotals>> {
    let mut stmt = conn.prepare(LIST_PLAYER_TOTALS)?;
    let rows = stmt.query_map(params![season_id, source], map_player_totals)?;
    rows.collect::<duckdb::Result<Vec<_>>>().map_err(Into::into)
}

const LIST_PLAYER_PER_GAME: &str = "
    SELECT id, player_id, season_id, season_type, source, games_played,
           CAST(minutes_played AS DOUBLE),
           CAST(points AS DOUBLE),
           CAST(rebounds_offensive AS DOUBLE),
           CAST(rebounds_defensive AS DOUBLE),
           CAST(rebounds_total AS DOUBLE),
           CAST(assists AS DOUBLE),
           CAST(steals AS DOUBLE),
           CAST(blocks AS DOUBLE),
           CAST(turnovers AS DOUBLE),
           CAST(personal_fouls AS DOUBLE),
           CAST(field_goals_made AS DOUBLE),
           CAST(field_goals_attempted AS DOUBLE),
           CAST(three_pointers_made AS DOUBLE),
           CAST(three_pointers_attempted AS DOUBLE),
           CAST(free_throws_made AS DOUBLE),
           CAST(free_throws_attempted AS DOUBLE),
           CAST(computed_at AS VARCHAR)
    FROM player_season_per_game
    WHERE season_id = ? AND source = ?
    ORDER BY player_id, season_type
";

fn map_player_per_game(row: &duckdb::Row<'_>) -> duckdb::Result<PlayerSeasonPerGame> {
    Ok(PlayerSeasonPerGame {
        id: row.get(0)?,
        player_id: row.get(1)?,
        season_id: row.get(2)?,
        season_type: row.get(3)?,
        source: row.get(4)?,
        games_played: row.get(5)?,
        minutes_played: row.get(6)?,
        points: row.get(7)?,
        rebounds_offensive: row.get(8)?,
        rebounds_defensive: row.get(9)?,
        rebounds_total: row.get(10)?,
        assists: row.get(11)?,
        steals: row.get(12)?,
        blocks: row.get(13)?,
        turnovers: row.get(14)?,
        personal_fouls: row.get(15)?,
        field_goals_made: row.get(16)?,
        field_goals_attempted: row.get(17)?,
        three_pointers_made: row.get(18)?,
        three_pointers_attempted: row.get(19)?,
        free_throws_made: row.get(20)?,
        free_throws_attempted: row.get(21)?,
        computed_at: row.get(22)?,
    })
}

pub(crate) fn list_player_per_game(
    conn: &Connection,
    season_id: &str,
    source: &str,
) -> Result<Vec<PlayerSeasonPerGame>> {
    let mut stmt = conn.prepare(LIST_PLAYER_PER_GAME)?;
    let rows = stmt.query_map(params![season_id, source], map_player_per_game)?;
    rows.collect::<duckdb::Result<Vec<_>>>().map_err(Into::into)
}

// ── Team queries (stubs — implemented in Task 4) ─────────────────────────────

pub(crate) fn upsert_team_totals(
    conn: &Connection,
    season_id: &str,
    source: &str,
) -> Result<u64> {
    todo!("implemented in Task 4")
}

pub(crate) fn upsert_team_per_game(
    conn: &Connection,
    season_id: &str,
    source: &str,
) -> Result<u64> {
    todo!("implemented in Task 4")
}

pub(crate) fn list_team_totals(
    conn: &Connection,
    season_id: &str,
    source: &str,
) -> Result<Vec<TeamSeasonTotals>> {
    todo!("implemented in Task 4")
}

pub(crate) fn list_team_per_game(
    conn: &Connection,
    season_id: &str,
    source: &str,
) -> Result<Vec<TeamSeasonPerGame>> {
    todo!("implemented in Task 4")
}
```

- [ ] **Step 4: Run player tests**

```bash
cargo test -p metis-db season_rollup 2>&1
```

Expected: all player-side tests pass. The team stubs (with `todo!()`) won't be hit by player tests.

- [ ] **Step 5: Commit**

```bash
git add crates/metis-db/src/queries/season_rollup.rs crates/metis-db/src/repos/season_rollup.rs
git commit -m "feat(db): player season rollup queries and repo (TDD)"
```

---

## Task 4: Team Rollup Queries (TDD)

**Files:**
- Modify: `crates/metis-db/src/queries/season_rollup.rs`
- Modify: `crates/metis-db/src/repos/season_rollup.rs`

- [ ] **Step 1: Add team tests to the `#[cfg(test)]` block in `repos/season_rollup.rs`**

Add these tests inside the existing `mod tests { ... }` block, after the existing tests:

```rust
    fn team_box(game_id: &str, team_id: &str, opp_id: &str, points: i16) -> crate::model::team_game_box::TeamGameBox {
        crate::model::team_game_box::TeamGameBox {
            id: 0,
            game_id: game_id.to_string(),
            team_id: team_id.to_string(),
            opponent_team_id: opp_id.to_string(),
            season_id: "2023-24".to_string(),
            season_type: "Regular".to_string(),
            is_home: team_id == "NBA_LAL",
            points: Some(points),
            rebounds_offensive: Some(8),
            rebounds_defensive: Some(35),
            rebounds_total: Some(43),
            assists: Some(25),
            steals: Some(7),
            blocks: Some(4),
            turnovers: Some(13),
            personal_fouls: Some(20),
            field_goals_made: Some(42),
            field_goals_attempted: Some(88),
            three_pointers_made: Some(12),
            three_pointers_attempted: Some(35),
            free_throws_made: Some(10),
            free_throws_attempted: Some(14),
            fast_break_points: Some(15),
            points_in_paint: Some(44),
            second_chance_points: Some(10),
            bench_points: Some(30),
            source: "nba_stats".to_string(),
            source_url: "https://stats.nba.com/".to_string(),
            fetched_at: "2024-01-15 12:00:00".to_string(),
            source_payload: "{}".to_string(),
            ingested_at: None,
        }
    }

    #[test]
    fn compute_team_totals_sums_correctly() {
        let db = open_test_db();
        setup(&db);
        let boxes = db.team_game_boxes();
        // LAL: 110 + 105 = 215 pts over 2 games
        boxes.upsert(&team_box("G001", "NBA_LAL", "NBA_BOS", 110)).unwrap();
        boxes.upsert(&team_box("G002", "NBA_LAL", "NBA_BOS", 105)).unwrap();

        let repo = db.season_rollups();
        let n = repo.compute_team_totals("2023-24", "nba_stats").unwrap();
        assert_eq!(n, 1, "one team → one totals row");

        let rows = repo.list_team_totals("2023-24", "nba_stats").unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].team_id, "NBA_LAL");
        assert_eq!(rows[0].games_played, 2);
        assert_eq!(rows[0].points, Some(215));
        assert_eq!(rows[0].fast_break_points, Some(30)); // 15 + 15
    }

    #[test]
    fn compute_team_totals_is_idempotent() {
        let db = open_test_db();
        setup(&db);
        db.team_game_boxes()
            .upsert(&team_box("G001", "NBA_LAL", "NBA_BOS", 110))
            .unwrap();

        let repo = db.season_rollups();
        repo.compute_team_totals("2023-24", "nba_stats").unwrap();
        repo.compute_team_totals("2023-24", "nba_stats").unwrap();

        let rows = repo.list_team_totals("2023-24", "nba_stats").unwrap();
        assert_eq!(rows.len(), 1, "re-run must not duplicate rows");
    }

    #[test]
    fn compute_team_per_game_divides_correctly() {
        let db = open_test_db();
        setup(&db);
        let boxes = db.team_game_boxes();
        boxes.upsert(&team_box("G001", "NBA_LAL", "NBA_BOS", 110)).unwrap();
        boxes.upsert(&team_box("G002", "NBA_LAL", "NBA_BOS", 106)).unwrap();
        // points total: 216, games: 2 → 108.0 ppg

        let repo = db.season_rollups();
        repo.compute_team_totals("2023-24", "nba_stats").unwrap();
        let n = repo.compute_team_per_game("2023-24", "nba_stats").unwrap();
        assert_eq!(n, 1);

        let rows = repo.list_team_per_game("2023-24", "nba_stats").unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].games_played, 2);
        assert_eq!(rows[0].points, Some(108.0));
    }

    #[test]
    fn compute_team_per_game_is_idempotent() {
        let db = open_test_db();
        setup(&db);
        db.team_game_boxes()
            .upsert(&team_box("G001", "NBA_LAL", "NBA_BOS", 110))
            .unwrap();

        let repo = db.season_rollups();
        repo.compute_team_totals("2023-24", "nba_stats").unwrap();
        repo.compute_team_per_game("2023-24", "nba_stats").unwrap();
        repo.compute_team_per_game("2023-24", "nba_stats").unwrap();

        let rows = repo.list_team_per_game("2023-24", "nba_stats").unwrap();
        assert_eq!(rows.len(), 1, "re-run must not duplicate rows");
    }
```

- [ ] **Step 2: Run failing team tests**

```bash
cargo test -p metis-db season_rollup::tests::compute_team 2>&1 | head -30
```

Expected: panic on `todo!()`.

- [ ] **Step 3: Replace team stubs in `queries/season_rollup.rs`**

Replace the four `todo!()` functions at the bottom with the full implementations:

```rust
const UPSERT_TEAM_TOTALS: &str = "
    INSERT INTO team_season_totals (
        team_id, season_id, season_type, source, games_played,
        points, rebounds_offensive, rebounds_defensive, rebounds_total,
        assists, steals, blocks, turnovers, personal_fouls,
        field_goals_made, field_goals_attempted,
        three_pointers_made, three_pointers_attempted,
        free_throws_made, free_throws_attempted,
        fast_break_points, points_in_paint, second_chance_points, bench_points
    )
    SELECT
        team_id,
        season_id,
        season_type,
        source,
        COUNT(DISTINCT game_id)               AS games_played,
        SUM(points)                           AS points,
        SUM(rebounds_offensive)               AS rebounds_offensive,
        SUM(rebounds_defensive)               AS rebounds_defensive,
        SUM(rebounds_total)                   AS rebounds_total,
        SUM(assists)                          AS assists,
        SUM(steals)                           AS steals,
        SUM(blocks)                           AS blocks,
        SUM(turnovers)                        AS turnovers,
        SUM(personal_fouls)                   AS personal_fouls,
        SUM(field_goals_made)                 AS field_goals_made,
        SUM(field_goals_attempted)            AS field_goals_attempted,
        SUM(three_pointers_made)              AS three_pointers_made,
        SUM(three_pointers_attempted)         AS three_pointers_attempted,
        SUM(free_throws_made)                 AS free_throws_made,
        SUM(free_throws_attempted)            AS free_throws_attempted,
        SUM(fast_break_points)                AS fast_break_points,
        SUM(points_in_paint)                  AS points_in_paint,
        SUM(second_chance_points)             AS second_chance_points,
        SUM(bench_points)                     AS bench_points
    FROM team_game_box
    WHERE season_id = ? AND source = ?
    GROUP BY team_id, season_id, season_type, source
    ON CONFLICT (team_id, season_id, season_type, source) DO UPDATE SET
        games_played             = excluded.games_played,
        points                   = excluded.points,
        rebounds_offensive       = excluded.rebounds_offensive,
        rebounds_defensive       = excluded.rebounds_defensive,
        rebounds_total           = excluded.rebounds_total,
        assists                  = excluded.assists,
        steals                   = excluded.steals,
        blocks                   = excluded.blocks,
        turnovers                = excluded.turnovers,
        personal_fouls           = excluded.personal_fouls,
        field_goals_made         = excluded.field_goals_made,
        field_goals_attempted    = excluded.field_goals_attempted,
        three_pointers_made      = excluded.three_pointers_made,
        three_pointers_attempted = excluded.three_pointers_attempted,
        free_throws_made         = excluded.free_throws_made,
        free_throws_attempted    = excluded.free_throws_attempted,
        fast_break_points        = excluded.fast_break_points,
        points_in_paint          = excluded.points_in_paint,
        second_chance_points     = excluded.second_chance_points,
        bench_points             = excluded.bench_points,
        computed_at              = now()
";

pub(crate) fn upsert_team_totals(
    conn: &Connection,
    season_id: &str,
    source: &str,
) -> Result<u64> {
    let n = conn.execute(UPSERT_TEAM_TOTALS, params![season_id, source])?;
    Ok(n as u64)
}

const UPSERT_TEAM_PER_GAME: &str = "
    INSERT INTO team_season_per_game (
        team_id, season_id, season_type, source, games_played,
        points, rebounds_offensive, rebounds_defensive, rebounds_total,
        assists, steals, blocks, turnovers, personal_fouls,
        field_goals_made, field_goals_attempted,
        three_pointers_made, three_pointers_attempted,
        free_throws_made, free_throws_attempted,
        fast_break_points, points_in_paint, second_chance_points, bench_points
    )
    SELECT
        team_id,
        season_id,
        season_type,
        source,
        games_played,
        CAST(points                   AS DECIMAL(6,2)) / games_played,
        CAST(rebounds_offensive       AS DECIMAL(6,2)) / games_played,
        CAST(rebounds_defensive       AS DECIMAL(6,2)) / games_played,
        CAST(rebounds_total           AS DECIMAL(6,2)) / games_played,
        CAST(assists                  AS DECIMAL(6,2)) / games_played,
        CAST(steals                   AS DECIMAL(6,2)) / games_played,
        CAST(blocks                   AS DECIMAL(6,2)) / games_played,
        CAST(turnovers                AS DECIMAL(6,2)) / games_played,
        CAST(personal_fouls           AS DECIMAL(6,2)) / games_played,
        CAST(field_goals_made         AS DECIMAL(6,2)) / games_played,
        CAST(field_goals_attempted    AS DECIMAL(6,2)) / games_played,
        CAST(three_pointers_made      AS DECIMAL(6,2)) / games_played,
        CAST(three_pointers_attempted AS DECIMAL(6,2)) / games_played,
        CAST(free_throws_made         AS DECIMAL(6,2)) / games_played,
        CAST(free_throws_attempted    AS DECIMAL(6,2)) / games_played,
        CAST(fast_break_points        AS DECIMAL(6,2)) / games_played,
        CAST(points_in_paint          AS DECIMAL(6,2)) / games_played,
        CAST(second_chance_points     AS DECIMAL(6,2)) / games_played,
        CAST(bench_points             AS DECIMAL(6,2)) / games_played
    FROM team_season_totals
    WHERE season_id = ? AND source = ?
    ON CONFLICT (team_id, season_id, season_type, source) DO UPDATE SET
        games_played             = excluded.games_played,
        points                   = excluded.points,
        rebounds_offensive       = excluded.rebounds_offensive,
        rebounds_defensive       = excluded.rebounds_defensive,
        rebounds_total           = excluded.rebounds_total,
        assists                  = excluded.assists,
        steals                   = excluded.steals,
        blocks                   = excluded.blocks,
        turnovers                = excluded.turnovers,
        personal_fouls           = excluded.personal_fouls,
        field_goals_made         = excluded.field_goals_made,
        field_goals_attempted    = excluded.field_goals_attempted,
        three_pointers_made      = excluded.three_pointers_made,
        three_pointers_attempted = excluded.three_pointers_attempted,
        free_throws_made         = excluded.free_throws_made,
        free_throws_attempted    = excluded.free_throws_attempted,
        fast_break_points        = excluded.fast_break_points,
        points_in_paint          = excluded.points_in_paint,
        second_chance_points     = excluded.second_chance_points,
        bench_points             = excluded.bench_points,
        computed_at              = now()
";

pub(crate) fn upsert_team_per_game(
    conn: &Connection,
    season_id: &str,
    source: &str,
) -> Result<u64> {
    let n = conn.execute(UPSERT_TEAM_PER_GAME, params![season_id, source])?;
    Ok(n as u64)
}

const LIST_TEAM_TOTALS: &str = "
    SELECT id, team_id, season_id, season_type, source, games_played,
           points, rebounds_offensive, rebounds_defensive, rebounds_total,
           assists, steals, blocks, turnovers, personal_fouls,
           field_goals_made, field_goals_attempted,
           three_pointers_made, three_pointers_attempted,
           free_throws_made, free_throws_attempted,
           fast_break_points, points_in_paint, second_chance_points, bench_points,
           CAST(computed_at AS VARCHAR)
    FROM team_season_totals
    WHERE season_id = ? AND source = ?
    ORDER BY team_id, season_type
";

fn map_team_totals(row: &duckdb::Row<'_>) -> duckdb::Result<TeamSeasonTotals> {
    Ok(TeamSeasonTotals {
        id: row.get(0)?,
        team_id: row.get(1)?,
        season_id: row.get(2)?,
        season_type: row.get(3)?,
        source: row.get(4)?,
        games_played: row.get(5)?,
        points: row.get(6)?,
        rebounds_offensive: row.get(7)?,
        rebounds_defensive: row.get(8)?,
        rebounds_total: row.get(9)?,
        assists: row.get(10)?,
        steals: row.get(11)?,
        blocks: row.get(12)?,
        turnovers: row.get(13)?,
        personal_fouls: row.get(14)?,
        field_goals_made: row.get(15)?,
        field_goals_attempted: row.get(16)?,
        three_pointers_made: row.get(17)?,
        three_pointers_attempted: row.get(18)?,
        free_throws_made: row.get(19)?,
        free_throws_attempted: row.get(20)?,
        fast_break_points: row.get(21)?,
        points_in_paint: row.get(22)?,
        second_chance_points: row.get(23)?,
        bench_points: row.get(24)?,
        computed_at: row.get(25)?,
    })
}

pub(crate) fn list_team_totals(
    conn: &Connection,
    season_id: &str,
    source: &str,
) -> Result<Vec<TeamSeasonTotals>> {
    let mut stmt = conn.prepare(LIST_TEAM_TOTALS)?;
    let rows = stmt.query_map(params![season_id, source], map_team_totals)?;
    rows.collect::<duckdb::Result<Vec<_>>>().map_err(Into::into)
}

const LIST_TEAM_PER_GAME: &str = "
    SELECT id, team_id, season_id, season_type, source, games_played,
           CAST(points AS DOUBLE),
           CAST(rebounds_offensive AS DOUBLE),
           CAST(rebounds_defensive AS DOUBLE),
           CAST(rebounds_total AS DOUBLE),
           CAST(assists AS DOUBLE),
           CAST(steals AS DOUBLE),
           CAST(blocks AS DOUBLE),
           CAST(turnovers AS DOUBLE),
           CAST(personal_fouls AS DOUBLE),
           CAST(field_goals_made AS DOUBLE),
           CAST(field_goals_attempted AS DOUBLE),
           CAST(three_pointers_made AS DOUBLE),
           CAST(three_pointers_attempted AS DOUBLE),
           CAST(free_throws_made AS DOUBLE),
           CAST(free_throws_attempted AS DOUBLE),
           CAST(fast_break_points AS DOUBLE),
           CAST(points_in_paint AS DOUBLE),
           CAST(second_chance_points AS DOUBLE),
           CAST(bench_points AS DOUBLE),
           CAST(computed_at AS VARCHAR)
    FROM team_season_per_game
    WHERE season_id = ? AND source = ?
    ORDER BY team_id, season_type
";

fn map_team_per_game(row: &duckdb::Row<'_>) -> duckdb::Result<TeamSeasonPerGame> {
    Ok(TeamSeasonPerGame {
        id: row.get(0)?,
        team_id: row.get(1)?,
        season_id: row.get(2)?,
        season_type: row.get(3)?,
        source: row.get(4)?,
        games_played: row.get(5)?,
        points: row.get(6)?,
        rebounds_offensive: row.get(7)?,
        rebounds_defensive: row.get(8)?,
        rebounds_total: row.get(9)?,
        assists: row.get(10)?,
        steals: row.get(11)?,
        blocks: row.get(12)?,
        turnovers: row.get(13)?,
        personal_fouls: row.get(14)?,
        field_goals_made: row.get(15)?,
        field_goals_attempted: row.get(16)?,
        three_pointers_made: row.get(17)?,
        three_pointers_attempted: row.get(18)?,
        free_throws_made: row.get(19)?,
        free_throws_attempted: row.get(20)?,
        fast_break_points: row.get(21)?,
        points_in_paint: row.get(22)?,
        second_chance_points: row.get(23)?,
        bench_points: row.get(24)?,
        computed_at: row.get(25)?,
    })
}

pub(crate) fn list_team_per_game(
    conn: &Connection,
    season_id: &str,
    source: &str,
) -> Result<Vec<TeamSeasonPerGame>> {
    let mut stmt = conn.prepare(LIST_TEAM_PER_GAME)?;
    let rows = stmt.query_map(params![season_id, source], map_team_per_game)?;
    rows.collect::<duckdb::Result<Vec<_>>>().map_err(Into::into)
}
```

- [ ] **Step 4: Run all season_rollup tests**

```bash
cargo test -p metis-db season_rollup 2>&1
```

Expected: all tests pass.

- [ ] **Step 5: Run full metis-db test suite to check for regressions**

```bash
cargo test -p metis-db 2>&1
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add crates/metis-db/src/queries/season_rollup.rs crates/metis-db/src/repos/season_rollup.rs
git commit -m "feat(db): team season rollup queries and repo (TDD)"
```

---

## Task 5: `metis-compute` Scaffold + Error Types

**Files:**
- Modify: `crates/metis-compute/Cargo.toml`
- Create: `crates/metis-compute/src/error.rs`
- Modify: `crates/metis-compute/src/lib.rs`

- [ ] **Step 1: Update `Cargo.toml`**

Replace the full content of `crates/metis-compute/Cargo.toml`:

```toml
[package]
name = "metis-compute"
version.workspace = true
edition.workspace = true
license.workspace = true

[dependencies]
metis-core = { path = "../metis-core" }
metis-db   = { path = "../metis-db" }
thiserror  = { workspace = true }

[dev-dependencies]
metis-db = { path = "../metis-db" }

[lints.rust]
unused_imports = "deny"
unused_variables = "deny"

[lints.clippy]
all = { level = "deny", priority = -1 }
pedantic = "warn"
```

- [ ] **Step 2: Write `src/error.rs`**

```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ComputeError {
    #[error(
        "No player_game_box rows for season={season} source={source}. \
         Did you forget: metis-cli load box-scores --season {start_year} --source {source}?"
    )]
    NoSourceData {
        season: String,
        start_year: u16,
        source: String,
    },
    #[error(transparent)]
    Db(#[from] metis_db::DbError),
}
```

- [ ] **Step 3: Update `src/lib.rs`**

```rust
pub mod error;
pub mod season_rollups;

pub use error::ComputeError;
pub use season_rollups::{compute_season_rollups, RollupSummary};
```

- [ ] **Step 4: Create stub `src/season_rollups.rs`**

```rust
use metis_core::Season;
use metis_db::Db;

use crate::error::ComputeError;

/// Summary of a completed rollup run.
#[derive(Debug, Clone, PartialEq)]
pub struct RollupSummary {
    /// Number of `player_season_totals` rows written (inserts + updates).
    pub player_rows: u64,
    /// Number of `team_season_totals` rows written (inserts + updates).
    pub team_rows: u64,
}

/// Computes season rollups for all players and teams from the given source.
///
/// Execution order: player totals → player per-game → team totals → team per-game.
/// Returns `ComputeError::NoSourceData` if no `player_game_box` rows exist for the
/// requested `(season, source)` combination.
pub fn compute_season_rollups(
    _db: &Db,
    _season: Season,
    _source: &str,
) -> Result<RollupSummary, ComputeError> {
    todo!("implemented in Task 6")
}
```

- [ ] **Step 5: Compile check**

```bash
cargo check -p metis-compute 2>&1
```

Expected: no errors (the stub compiles).

- [ ] **Step 6: Commit**

```bash
git add crates/metis-compute/Cargo.toml crates/metis-compute/src/error.rs \
        crates/metis-compute/src/season_rollups.rs crates/metis-compute/src/lib.rs
git commit -m "feat(compute): scaffold metis-compute crate with error types"
```

---

## Task 6: `compute_season_rollups` Implementation (TDD)

**Files:**
- Create: `crates/metis-compute/tests/season_rollups.rs`
- Modify: `crates/metis-compute/src/season_rollups.rs`

- [ ] **Step 1: Write the integration test**

Create `crates/metis-compute/tests/season_rollups.rs`:

```rust
use std::path::Path;

use metis_compute::{compute_season_rollups, ComputeError};
use metis_core::Season;
use metis_db::model::game::Game;
use metis_db::model::player::Player;
use metis_db::model::player_game_box::PlayerGameBox;
use metis_db::model::team::Team;
use metis_db::model::team_game_box::TeamGameBox;
use metis_db::Db;

fn open_test_db() -> Db {
    let migrations = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("sql/migrations");
    let db = Db::open_with_migrations(":memory:", &migrations).expect("open test db");
    db.migrate().expect("migrate");
    db
}

fn setup(db: &Db) {
    db.teams()
        .upsert(&Team {
            id: "NBA_LAL".to_string(),
            league_id: "NBA".to_string(),
            abbreviation: "LAL".to_string(),
            full_name: "Los Angeles Lakers".to_string(),
            city: "Los Angeles".to_string(),
        })
        .unwrap();
    db.teams()
        .upsert(&Team {
            id: "NBA_BOS".to_string(),
            league_id: "NBA".to_string(),
            abbreviation: "BOS".to_string(),
            full_name: "Boston Celtics".to_string(),
            city: "Boston".to_string(),
        })
        .unwrap();
    db.players()
        .upsert(&Player {
            id: "NBA_P001".to_string(),
            league_id: "NBA".to_string(),
            first_name: "Test".to_string(),
            last_name: "Player".to_string(),
            birth_date: None,
        })
        .unwrap();
    db.seasons()
        .upsert("2024-25", "NBA", 2024)
        .unwrap();
    db.games()
        .upsert(&Game {
            id: "G001".to_string(),
            league_id: "NBA".to_string(),
            season_id: "2024-25".to_string(),
            season_type: "Regular".to_string(),
            game_date: "2025-01-10".to_string(),
            home_team_id: "NBA_LAL".to_string(),
            away_team_id: "NBA_BOS".to_string(),
            home_score: Some(110),
            away_score: Some(105),
            status: "final".to_string(),
        })
        .unwrap();
    db.games()
        .upsert(&Game {
            id: "G002".to_string(),
            league_id: "NBA".to_string(),
            season_id: "2024-25".to_string(),
            season_type: "Regular".to_string(),
            game_date: "2025-01-12".to_string(),
            home_team_id: "NBA_LAL".to_string(),
            away_team_id: "NBA_BOS".to_string(),
            home_score: Some(108),
            away_score: Some(100),
            status: "final".to_string(),
        })
        .unwrap();
}

fn player_box(game_id: &str, points: i16) -> PlayerGameBox {
    PlayerGameBox {
        id: 0,
        game_id: game_id.to_string(),
        player_id: "NBA_P001".to_string(),
        team_id: "NBA_LAL".to_string(),
        season_id: "2024-25".to_string(),
        season_type: "Regular".to_string(),
        starter: Some(true),
        minutes_played: Some(36.0),
        points: Some(points),
        rebounds_offensive: Some(1),
        rebounds_defensive: Some(5),
        rebounds_total: Some(6),
        assists: Some(4),
        steals: Some(1),
        blocks: Some(0),
        turnovers: Some(2),
        personal_fouls: Some(2),
        field_goals_made: Some(5),
        field_goals_attempted: Some(12),
        three_pointers_made: Some(1),
        three_pointers_attempted: Some(3),
        free_throws_made: Some(2),
        free_throws_attempted: Some(3),
        plus_minus: Some(4),
        source: "nba_stats".to_string(),
        source_url: "https://stats.nba.com/".to_string(),
        fetched_at: "2025-01-10 12:00:00".to_string(),
        source_payload: "{}".to_string(),
        ingested_at: None,
    }
}

fn team_box(game_id: &str, points: i16) -> TeamGameBox {
    TeamGameBox {
        id: 0,
        game_id: game_id.to_string(),
        team_id: "NBA_LAL".to_string(),
        opponent_team_id: "NBA_BOS".to_string(),
        season_id: "2024-25".to_string(),
        season_type: "Regular".to_string(),
        is_home: true,
        points: Some(points),
        rebounds_offensive: Some(8),
        rebounds_defensive: Some(35),
        rebounds_total: Some(43),
        assists: Some(25),
        steals: Some(7),
        blocks: Some(4),
        turnovers: Some(13),
        personal_fouls: Some(20),
        field_goals_made: Some(42),
        field_goals_attempted: Some(88),
        three_pointers_made: Some(12),
        three_pointers_attempted: Some(35),
        free_throws_made: Some(10),
        free_throws_attempted: Some(14),
        fast_break_points: Some(15),
        points_in_paint: Some(44),
        second_chance_points: Some(10),
        bench_points: Some(30),
        source: "nba_stats".to_string(),
        source_url: "https://stats.nba.com/".to_string(),
        fetched_at: "2025-01-10 12:00:00".to_string(),
        source_payload: "{}".to_string(),
        ingested_at: None,
    }
}

#[test]
fn returns_no_source_data_error_when_no_box_rows() {
    let db = open_test_db();
    setup(&db);
    let result = compute_season_rollups(&db, Season(2024), "nba_stats");
    assert!(matches!(result, Err(ComputeError::NoSourceData { .. })));
    let err = result.unwrap_err().to_string();
    assert!(err.contains("season=2024-25"), "error should name the season");
    assert!(err.contains("source=nba_stats"), "error should name the source");
    assert!(err.contains("--season 2024"), "hint should include the CLI flag");
}

#[test]
fn returns_correct_rollup_summary() {
    let db = open_test_db();
    setup(&db);
    db.player_game_boxes().upsert(&player_box("G001", 28)).unwrap();
    db.player_game_boxes().upsert(&player_box("G002", 22)).unwrap();
    db.team_game_boxes().upsert(&team_box("G001", 110)).unwrap();
    db.team_game_boxes().upsert(&team_box("G002", 108)).unwrap();

    let summary = compute_season_rollups(&db, Season(2024), "nba_stats").unwrap();
    assert_eq!(summary.player_rows, 1, "one player → one totals row");
    assert_eq!(summary.team_rows, 1, "one team → one totals row");
}

#[test]
fn rollup_is_idempotent() {
    let db = open_test_db();
    setup(&db);
    db.player_game_boxes().upsert(&player_box("G001", 28)).unwrap();
    db.team_game_boxes().upsert(&team_box("G001", 110)).unwrap();

    compute_season_rollups(&db, Season(2024), "nba_stats").unwrap();
    let summary = compute_season_rollups(&db, Season(2024), "nba_stats").unwrap();
    // Verify counts are still 1, not 2
    assert_eq!(summary.player_rows, 1);
    assert_eq!(summary.team_rows, 1);
}

#[test]
fn player_totals_values_are_correct() {
    let db = open_test_db();
    setup(&db);
    // P001: 28 + 22 = 50 pts over 2 games → 25.0 ppg
    db.player_game_boxes().upsert(&player_box("G001", 28)).unwrap();
    db.player_game_boxes().upsert(&player_box("G002", 22)).unwrap();
    db.team_game_boxes().upsert(&team_box("G001", 110)).unwrap();

    compute_season_rollups(&db, Season(2024), "nba_stats").unwrap();

    let totals = db
        .season_rollups()
        .list_player_totals("2024-25", "nba_stats")
        .unwrap();
    assert_eq!(totals[0].points, Some(50));
    assert_eq!(totals[0].games_played, 2);

    let pg = db
        .season_rollups()
        .list_player_per_game("2024-25", "nba_stats")
        .unwrap();
    assert_eq!(pg[0].points, Some(25.0));
}
```

- [ ] **Step 2: Run failing test**

```bash
cargo test -p metis-compute 2>&1 | head -20
```

Expected: panic on `todo!()` in `compute_season_rollups`.

- [ ] **Step 3: Implement `compute_season_rollups` in `src/season_rollups.rs`**

Replace the full content of `src/season_rollups.rs`:

```rust
use metis_core::Season;
use metis_db::Db;

use crate::error::ComputeError;

/// Summary of a completed rollup run.
#[derive(Debug, Clone, PartialEq)]
pub struct RollupSummary {
    /// Number of `player_season_totals` rows written (inserts + updates).
    pub player_rows: u64,
    /// Number of `team_season_totals` rows written (inserts + updates).
    pub team_rows: u64,
}

/// Computes season rollups for all players and teams from the given source.
///
/// Execution order: player totals → player per-game → team totals → team per-game.
/// Returns `ComputeError::NoSourceData` if no `player_game_box` rows exist for the
/// requested `(season, source)` combination.
pub fn compute_season_rollups(
    db: &Db,
    season: Season,
    source: &str,
) -> Result<RollupSummary, ComputeError> {
    let season_id = season.to_string();
    let repo = db.season_rollups();

    let count = repo.count_player_box_rows(&season_id, source)?;
    if count == 0 {
        return Err(ComputeError::NoSourceData {
            season: season_id,
            start_year: season.0,
            source: source.to_string(),
        });
    }

    let player_rows = repo.compute_player_totals(&season_id, source)?;
    repo.compute_player_per_game(&season_id, source)?;
    let team_rows = repo.compute_team_totals(&season_id, source)?;
    repo.compute_team_per_game(&season_id, source)?;

    Ok(RollupSummary {
        player_rows,
        team_rows,
    })
}
```

- [ ] **Step 4: Run integration tests**

```bash
cargo test -p metis-compute 2>&1
```

Expected: all tests pass.

- [ ] **Step 5: Run full workspace test suite**

```bash
cargo test 2>&1
```

Expected: all tests pass across all crates.

- [ ] **Step 6: Commit**

```bash
git add crates/metis-compute/src/season_rollups.rs crates/metis-compute/tests/season_rollups.rs
git commit -m "feat(compute): implement compute_season_rollups with NoSourceData guard"
```

---

## Task 7: `metis-cli` Compute Subcommand

**Files:**
- Modify: `crates/metis-cli/Cargo.toml`
- Modify: `crates/metis-cli/src/main.rs`

- [ ] **Step 1: Add `metis-compute` dependency to `Cargo.toml`**

Add to the `[dependencies]` section:

```toml
metis-compute = { path = "../metis-compute" }
metis-core    = { path = "../metis-core" }
```

Full file after edit:

```toml
[package]
name = "metis-cli"
version.workspace = true
edition.workspace = true
license.workspace = true

[[bin]]
name = "metis-cli"
path = "src/main.rs"

[dependencies]
anyhow        = { workspace = true }
clap          = { version = "4", features = ["derive"] }
metis-compute = { path = "../metis-compute" }
metis-core    = { path = "../metis-core" }
metis-db      = { path = "../metis-db" }

[lints]
workspace = true
```

- [ ] **Step 2: Add `Compute` subcommand to `main.rs`**

Replace the full content of `crates/metis-cli/src/main.rs`:

```rust
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use metis_compute::{compute_season_rollups, ComputeError};
use metis_core::Season;
use metis_db::Db;

#[derive(Parser)]
#[command(name = "metis-cli", about = "Metis admin CLI")]
struct Cli {
    /// Path to the DuckDB database file.
    #[arg(long, global = true, default_value = "data/duckdb/metis.duckdb")]
    db: PathBuf,

    /// Path to the SQL migrations directory.
    #[arg(long, global = true, default_value = "sql/migrations")]
    migrations: PathBuf,

    /// Root of the local data directory (contains `parquet/` subdirectory).
    #[arg(long, global = true, default_value = "data")]
    data_root: PathBuf,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Load data from Parquet files into the DuckDB database.
    Load(LoadArgs),
    /// Compute materialized rollup tables.
    Compute(ComputeArgs),
}

#[derive(clap::Args)]
struct LoadArgs {
    #[command(subcommand)]
    entity: LoadEntity,
}

#[derive(Subcommand)]
enum LoadEntity {
    /// Load player and team box scores for a season.
    ///
    /// Reads Parquet files from:
    ///   <data-root>/parquet/<source>/player_game_box/season=<SEASON>/
    ///   <data-root>/parquet/<source>/team_game_box/season=<SEASON>/
    ///
    /// Dimension rows (game, player, team) must already exist in the database.
    BoxScores {
        /// Season start year (e.g. 2024 for the 2024-25 season).
        #[arg(long)]
        season: u32,

        /// Ingest source name (must match the source written by the Python adapter).
        #[arg(long, default_value = "nba_stats")]
        source: String,
    },
}

#[derive(clap::Args)]
struct ComputeArgs {
    #[command(subcommand)]
    entity: ComputeEntity,
}

#[derive(Subcommand)]
enum ComputeEntity {
    /// Compute player and team season rollups from box score data.
    ///
    /// Reads from player_game_box and team_game_box and writes:
    ///   player_season_totals, player_season_per_game,
    ///   team_season_totals,   team_season_per_game
    ///
    /// Both --season and --source are required. Provenance must be explicit —
    /// see design spec for rationale.
    SeasonRollups {
        /// Season start year (e.g. 2024 for the 2024-25 season).
        #[arg(long)]
        season: u32,

        /// Ingest source name (must match the source used when loading box scores).
        #[arg(long)]
        source: String,
    },
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    let db = Db::open_with_migrations(&cli.db, &cli.migrations)
        .with_context(|| format!("failed to open database at {}", cli.db.display()))?;
    db.migrate().context("failed to apply migrations")?;

    match cli.command {
        Commands::Load(LoadArgs {
            entity: LoadEntity::BoxScores { season, source },
        }) => {
            cmd_load_box_scores(&db, &cli.data_root, season, &source)?;
        }
        Commands::Compute(ComputeArgs {
            entity: ComputeEntity::SeasonRollups { season, source },
        }) => {
            cmd_compute_season_rollups(&db, season, &source)?;
        }
    }

    Ok(())
}

fn cmd_load_box_scores(db: &Db, data_root: &Path, season: u32, source: &str) -> Result<()> {
    let parquet_root = data_root.join("parquet");

    let player_glob = parquet_root
        .join(source)
        .join("player_game_box")
        .join(format!("season={season}"))
        .join("*.parquet");

    let team_glob = parquet_root
        .join(source)
        .join("team_game_box")
        .join(format!("season={season}"))
        .join("*.parquet");

    let player_glob_str = player_glob
        .to_str()
        .context("player glob path is not valid UTF-8")?;
    let team_glob_str = team_glob
        .to_str()
        .context("team glob path is not valid UTF-8")?;

    let player_count = db
        .player_game_boxes()
        .load_from_parquet(player_glob_str)
        .with_context(|| format!("failed to load player box scores from {player_glob_str}"))?;

    let team_count = db
        .team_game_boxes()
        .load_from_parquet(team_glob_str)
        .with_context(|| format!("failed to load team box scores from {team_glob_str}"))?;

    println!("Loaded {player_count} player box score row(s) for {source} season={season}.");
    println!("Loaded {team_count} team box score row(s) for {source} season={season}.");

    Ok(())
}

fn cmd_compute_season_rollups(db: &Db, season: u32, source: &str) -> Result<()> {
    let season_typed = Season(season as u16);
    match compute_season_rollups(db, season_typed, source) {
        Ok(summary) => {
            println!(
                "Computed rollups for {} players, {} teams (season={}, source={}).",
                summary.player_rows,
                summary.team_rows,
                season_typed,
                source
            );
            Ok(())
        }
        Err(ComputeError::NoSourceData { .. } | ComputeError::Db(_)) => {
            Err(anyhow::anyhow!(
                compute_season_rollups(db, season_typed, source).unwrap_err()
            ))
        }
    }
}
```

> **Note on the error handler:** `anyhow::anyhow!` accepts a `Display` value. Since `ComputeError` implements `Display` via `thiserror`, the user-friendly hint message from `NoSourceData` will be printed to stderr by `main() -> Result<()>` and the process exits non-zero.

Wait — the implementation above re-calls `compute_season_rollups` to get the error, which is wrong. Use this corrected version instead:

```rust
fn cmd_compute_season_rollups(db: &Db, season: u32, source: &str) -> Result<()> {
    let season_typed = Season(season as u16);
    let summary = compute_season_rollups(db, season_typed, source)
        .map_err(|e| anyhow::anyhow!("{e}"))?;
    println!(
        "Computed rollups for {} players, {} teams (season={}, source={}).",
        summary.player_rows,
        summary.team_rows,
        season_typed,
        source
    );
    Ok(())
}
```

Make sure to use this single-call version in the file, not the match version above.

- [ ] **Step 3: Compile check**

```bash
cargo check -p metis-cli 2>&1
```

Expected: no errors.

- [ ] **Step 4: Verify CLI help output**

```bash
cargo run -p metis-cli -- compute season-rollups --help 2>&1
```

Expected output (approximately):
```
Compute player and team season rollups from box score data.

Usage: metis-cli compute season-rollups --season <SEASON> --source <SOURCE>

Options:
      --season <SEASON>  Season start year (e.g. 2024 for the 2024-25 season)
      --source <SOURCE>  Ingest source name ...
  -h, --help             Print help
```

- [ ] **Step 5: Verify error message when no data exists**

```bash
cargo run -p metis-cli -- compute season-rollups --season 2024 --source nba_stats 2>&1; echo "Exit: $?"
```

Expected: error message containing `"No player_game_box rows for season=2024-25 source=nba_stats"` and `"Exit: 1"`.

- [ ] **Step 6: Run full test suite one final time**

```bash
cargo test 2>&1
```

Expected: all tests pass, no warnings from `-D warnings`.

- [ ] **Step 7: Commit**

```bash
git add crates/metis-cli/Cargo.toml crates/metis-cli/src/main.rs
git commit -m "feat(cli): add compute season-rollups subcommand"
```

---

## Self-Review

**Spec coverage:**
- ✅ `player_season_totals` + `player_season_per_game` — Tasks 1, 3, 6
- ✅ `team_season_totals` + `team_season_per_game` — Tasks 1, 4, 6
- ✅ CLI: `metis-cli compute season-rollups --season 2024 --source nba_stats` — Task 7
- ✅ `--source` required, no default — Task 7 (`#[arg(long)]` with no `default_value`)
- ✅ Provenance `source TEXT NOT NULL` on rollup tables — Task 1 schema
- ✅ Uniqueness `(player_id, season_id, season_type, source)` — Task 1 unique indexes
- ✅ Totals-first → per-game derived — Task 6 (`compute_player_totals` before `compute_player_per_game`)
- ✅ All `season_type` values rolled up in one pass — `GROUP BY` includes `season_type`
- ✅ `NoSourceData` error with hint — Tasks 5, 6
- ✅ Idempotent (re-run = same count) — tested in Tasks 3, 4, 6
- ✅ `plus_minus` excluded from rollups — not in 0005 migration or queries
- ✅ `now()` not `current_timestamp` in ON CONFLICT SET — queries use `now()`
- ✅ SQL in `metis-db/src/queries/season_rollup.rs` — Tasks 3, 4

**No placeholders found.**

**Type consistency:** `PlayerSeasonTotals.points: Option<i32>` defined in Task 2, read as `row.get(7)?` in Task 3 map function, asserted as `Some(50)` (i32) in Task 6. `PlayerSeasonPerGame.points: Option<f64>` defined in Task 2, read via `CAST(points AS DOUBLE)` in Task 3, asserted as `Some(25.0)` (f64) in Task 6. ✅
