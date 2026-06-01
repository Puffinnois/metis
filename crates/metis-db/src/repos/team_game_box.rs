use duckdb::Connection;
use metis_core::Season;

use crate::error::Result;
use crate::model::team_game_box::TeamGameBox;
use crate::queries;

/// Repository for the `team_game_box` fact table.
///
/// Obtain via [`crate::Db::team_game_boxes`].
///
/// Uniqueness is per `(game_id, team_id, source)`. Multiple sources may contribute
/// rows for the same team-game; the reconciliation layer selects a canonical value.
///
/// Foreign-key integrity is not enforced by DuckDB at runtime. Callers must ensure
/// that `game_id`, `team_id`, and `opponent_team_id` reference existing rows.
pub struct TeamGameBoxRepo<'conn> {
    conn: &'conn Connection,
}

impl<'conn> TeamGameBoxRepo<'conn> {
    pub(crate) fn new(conn: &'conn Connection) -> Self {
        Self { conn }
    }

    /// Insert or update a team box score row.
    ///
    /// On conflict by `(game_id, team_id, source)`, updates all stat and provenance
    /// columns. `row.id` is ignored — the DB sequence assigns surrogate keys.
    pub fn upsert(&self, row: &TeamGameBox) -> Result<()> {
        queries::team_game_box::upsert(self.conn, row)
    }

    /// Returns the row with the given surrogate `id`, or `None` if not found.
    pub fn find_by_id(&self, id: i64) -> Result<Option<TeamGameBox>> {
        queries::team_game_box::find_by_id(self.conn, id)
    }

    /// Returns all team box score rows for the given game, ordered by team then source.
    pub fn find_by_game(&self, game_id: &str) -> Result<Vec<TeamGameBox>> {
        queries::team_game_box::find_by_game(self.conn, game_id)
    }

    /// Returns all team box score rows for the given season as an eagerly-loaded `Vec`,
    /// ordered by game, team, source.
    pub fn list_by_season(&self, season: Season) -> Result<Vec<TeamGameBox>> {
        queries::team_game_box::list_by_season(self.conn, &season.to_string())
    }

    /// Bulk-loads team box score rows from Parquet files matching `glob_path`.
    ///
    /// `glob_path` may use `*` and `**` wildcards understood by DuckDB's
    /// `read_parquet` (e.g. `"data/parquet/nba_stats/team_game_box/season=2024/*.parquet"`).
    ///
    /// Returns the number of rows inserted or updated.
    pub fn load_from_parquet(&self, glob_path: &str) -> Result<u64> {
        queries::team_game_box::load_from_parquet(self.conn, glob_path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helpers::{insert_game, insert_season, insert_team, open_test_db};

    fn box_row() -> TeamGameBox {
        TeamGameBox {
            id: 0,
            game_id: "nba_stats_001".to_string(),
            team_id: "NBA_BOS".to_string(),
            opponent_team_id: "NBA_LAL".to_string(),
            season_id: "2023-24".to_string(),
            season_type: "Regular".to_string(),
            is_home: true,
            points: Some(110),
            rebounds_offensive: Some(8),
            rebounds_defensive: Some(35),
            rebounds_total: Some(43),
            assists: Some(27),
            steals: Some(7),
            blocks: Some(5),
            turnovers: Some(12),
            personal_fouls: Some(18),
            field_goals_made: Some(42),
            field_goals_attempted: Some(88),
            three_pointers_made: Some(14),
            three_pointers_attempted: Some(38),
            free_throws_made: Some(12),
            free_throws_attempted: Some(15),
            fast_break_points: Some(16),
            points_in_paint: Some(44),
            second_chance_points: Some(10),
            bench_points: Some(32),
            source: "nba_stats".to_string(),
            source_url: "https://stats.nba.com/game/001".to_string(),
            fetched_at: "2024-01-15 12:00:00".to_string(),
            source_payload: "{}".to_string(),
            ingested_at: None,
        }
    }

    fn setup(db: &crate::Db) {
        insert_team(db, "NBA_BOS", "NBA");
        insert_team(db, "NBA_LAL", "NBA");
        insert_season(db, "2023-24", "NBA");
        insert_game(db, "nba_stats_001", "NBA", "2023-24", "NBA_BOS", "NBA_LAL");
    }

    #[test]
    fn upsert_and_find_by_game() {
        let db = open_test_db();
        setup(&db);
        let repo = db.team_game_boxes();
        repo.upsert(&box_row()).unwrap();
        let rows = repo.find_by_game("nba_stats_001").unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].team_id, "NBA_BOS");
        assert_eq!(rows[0].points, Some(110));
    }

    #[test]
    fn find_by_id_after_upsert() {
        let db = open_test_db();
        setup(&db);
        let repo = db.team_game_boxes();
        repo.upsert(&box_row()).unwrap();
        let inserted = repo.find_by_game("nba_stats_001").unwrap();
        let surrogate_id = inserted[0].id;
        assert!(surrogate_id > 0);
        let found = repo.find_by_id(surrogate_id).unwrap();
        assert_eq!(found.unwrap().team_id, "NBA_BOS");
    }

    #[test]
    fn find_by_id_missing_returns_none() {
        let db = open_test_db();
        let result = db.team_game_boxes().find_by_id(999_999).unwrap();
        assert_eq!(result, None);
    }

    #[test]
    fn upsert_is_idempotent() {
        let db = open_test_db();
        setup(&db);
        let repo = db.team_game_boxes();
        repo.upsert(&box_row()).unwrap();
        repo.upsert(&box_row()).unwrap();
        let rows = repo.find_by_game("nba_stats_001").unwrap();
        assert_eq!(rows.len(), 1);
    }

    #[test]
    fn upsert_updates_stats_on_conflict() {
        let db = open_test_db();
        setup(&db);
        let repo = db.team_game_boxes();
        repo.upsert(&box_row()).unwrap();
        let updated = TeamGameBox {
            points: Some(125),
            ..box_row()
        };
        repo.upsert(&updated).unwrap();
        let rows = repo.find_by_game("nba_stats_001").unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].points, Some(125));
    }

    #[test]
    fn multiple_sources_produce_separate_rows() {
        let db = open_test_db();
        setup(&db);
        let repo = db.team_game_boxes();
        repo.upsert(&box_row()).unwrap();
        let bref_row = TeamGameBox {
            source: "bref".to_string(),
            source_url: "https://www.basketball-reference.com/game/001".to_string(),
            ..box_row()
        };
        repo.upsert(&bref_row).unwrap();
        let rows = repo.find_by_game("nba_stats_001").unwrap();
        assert_eq!(rows.len(), 2);
    }

    #[test]
    fn list_by_season_returns_matching_rows() {
        let db = open_test_db();
        setup(&db);
        let repo = db.team_game_boxes();
        repo.upsert(&box_row()).unwrap();
        let rows = repo.list_by_season(Season(2023)).unwrap();
        assert_eq!(rows.len(), 1);
    }

    // ── load_from_parquet ────────────────────────────────────────────────────

    fn setup_load(db: &crate::Db) {
        insert_team(db, "NBA_BOS", "NBA");
        insert_team(db, "NBA_LAL", "NBA");
        insert_season(db, "2024-25", "NBA");
        insert_game(db, "NBA_G001", "NBA", "2024-25", "NBA_BOS", "NBA_LAL");
    }

    fn write_team_parquet(dir: &std::path::Path) -> std::path::PathBuf {
        let path = dir.join("part-fixture.parquet");
        let conn = duckdb::Connection::open_in_memory().expect("in-memory conn");
        conn.execute_batch(&format!(
            "COPY (
                SELECT
                    'NBA_G001'                           AS game_id,
                    'NBA_BOS'                            AS team_id,
                    'NBA_LAL'                            AS opponent_team_id,
                    '2024-25'                            AS season_id,
                    'Regular'                            AS season_type,
                    true                                 AS is_home,
                    110                                  AS points,
                    8                                    AS rebounds_offensive,
                    35                                   AS rebounds_defensive,
                    43                                   AS rebounds_total,
                    27                                   AS assists,
                    7                                    AS steals,
                    5                                    AS blocks,
                    12                                   AS turnovers,
                    18                                   AS personal_fouls,
                    42                                   AS field_goals_made,
                    88                                   AS field_goals_attempted,
                    14                                   AS three_pointers_made,
                    38                                   AS three_pointers_attempted,
                    12                                   AS free_throws_made,
                    15                                   AS free_throws_attempted,
                    NULL::INTEGER                        AS fast_break_points,
                    NULL::INTEGER                        AS points_in_paint,
                    NULL::INTEGER                        AS second_chance_points,
                    NULL::INTEGER                        AS bench_points,
                    'nba_stats'                          AS source,
                    'https://stats.nba.com/game/001'     AS source_url,
                    TIMESTAMPTZ '2024-01-15 12:00:00+00' AS fetched_at,
                    '{{\"test\": true}}'                 AS source_payload
            ) TO '{}' (FORMAT PARQUET)",
            path.display()
        ))
        .expect("write fixture parquet");
        path
    }

    #[test]
    fn load_from_parquet_inserts_rows() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let parquet = write_team_parquet(tmp.path());

        let db = open_test_db();
        setup_load(&db);
        let n = db
            .team_game_boxes()
            .load_from_parquet(parquet.to_str().unwrap())
            .unwrap();
        assert_eq!(n, 1);

        let rows = db.team_game_boxes().find_by_game("NBA_G001").unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].team_id, "NBA_BOS");
        assert_eq!(rows[0].points, Some(110));
        assert_eq!(rows[0].fast_break_points, None);
    }

    #[test]
    fn load_from_parquet_is_idempotent() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let parquet = write_team_parquet(tmp.path());
        let glob = parquet.to_str().unwrap();

        let db = open_test_db();
        setup_load(&db);
        let repo = db.team_game_boxes();
        repo.load_from_parquet(glob).unwrap();
        repo.load_from_parquet(glob).unwrap();

        let rows = repo.find_by_game("NBA_G001").unwrap();
        assert_eq!(rows.len(), 1, "second load must not duplicate rows");
    }
}
