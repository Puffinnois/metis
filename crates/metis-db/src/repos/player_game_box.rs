use duckdb::Connection;
use metis_core::Season;

use crate::error::Result;
use crate::model::player_game_box::PlayerGameBox;
use crate::queries;

/// Repository for the `player_game_box` fact table.
///
/// Obtain via [`crate::Db::player_game_boxes`].
///
/// Uniqueness is per `(game_id, player_id, source)`. Multiple sources may contribute
/// rows for the same player-game; the reconciliation layer selects a canonical value.
///
/// Foreign-key integrity is not enforced by DuckDB at runtime. Callers must ensure
/// that `game_id`, `player_id`, and `team_id` reference existing rows.
pub struct PlayerGameBoxRepo<'conn> {
    conn: &'conn Connection,
}

impl<'conn> PlayerGameBoxRepo<'conn> {
    pub(crate) fn new(conn: &'conn Connection) -> Self {
        Self { conn }
    }

    /// Insert or update a player box score row.
    ///
    /// On conflict by `(game_id, player_id, source)`, updates all stat and provenance
    /// columns. `row.id` is ignored — the DB sequence assigns surrogate keys.
    pub fn upsert(&self, row: &PlayerGameBox) -> Result<()> {
        queries::player_game_box::upsert(self.conn, row)
    }

    /// Returns the row with the given surrogate `id`, or `None` if not found.
    pub fn find_by_id(&self, id: i64) -> Result<Option<PlayerGameBox>> {
        queries::player_game_box::find_by_id(self.conn, id)
    }

    /// Returns all player box score rows for the given game, ordered by player then source.
    pub fn find_by_game(&self, game_id: &str) -> Result<Vec<PlayerGameBox>> {
        queries::player_game_box::find_by_game(self.conn, game_id)
    }

    /// Returns all player box score rows for the given season as an eagerly-loaded `Vec`,
    /// ordered by game, player, source.
    pub fn list_by_season(&self, season: Season) -> Result<Vec<PlayerGameBox>> {
        queries::player_game_box::list_by_season(self.conn, &season.to_string())
    }

    /// Bulk-loads player box score rows from Parquet files matching `glob_path`.
    ///
    /// `glob_path` may use `*` and `**` wildcards understood by DuckDB's
    /// `read_parquet` (e.g. `"data/parquet/nba_stats/player_game_box/season=2024/*.parquet"`).
    ///
    /// Returns the number of rows inserted or updated.
    pub fn load_from_parquet(&self, glob_path: &str) -> Result<u64> {
        queries::player_game_box::load_from_parquet(self.conn, glob_path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helpers::{
        insert_game, insert_player, insert_season, insert_team, open_test_db,
    };

    fn box_row() -> PlayerGameBox {
        PlayerGameBox {
            id: 0,
            game_id: "nba_stats_001".to_string(),
            player_id: "NBA_2544".to_string(),
            team_id: "NBA_LAL".to_string(),
            season_id: "2023-24".to_string(),
            season_type: "Regular".to_string(),
            starter: Some(true),
            minutes_played: Some(36.5),
            points: Some(28),
            rebounds_offensive: Some(1),
            rebounds_defensive: Some(6),
            rebounds_total: Some(7),
            assists: Some(8),
            steals: Some(1),
            blocks: Some(1),
            turnovers: Some(3),
            personal_fouls: Some(2),
            field_goals_made: Some(11),
            field_goals_attempted: Some(20),
            three_pointers_made: Some(2),
            three_pointers_attempted: Some(5),
            free_throws_made: Some(4),
            free_throws_attempted: Some(4),
            plus_minus: Some(8),
            source: "nba_stats".to_string(),
            source_url: "https://stats.nba.com/game/001".to_string(),
            fetched_at: "2024-01-15 12:00:00".to_string(),
            source_payload: "{}".to_string(),
            ingested_at: None,
        }
    }

    fn setup(db: &crate::Db) {
        insert_team(db, "NBA_LAL", "NBA");
        insert_team(db, "NBA_BOS", "NBA");
        insert_player(db, "NBA_2544", "NBA");
        insert_season(db, "2023-24", "NBA");
        insert_game(db, "nba_stats_001", "NBA", "2023-24", "NBA_LAL", "NBA_BOS");
    }

    #[test]
    fn upsert_and_find_by_game() {
        let db = open_test_db();
        setup(&db);
        let repo = db.player_game_boxes();
        repo.upsert(&box_row()).unwrap();
        let rows = repo.find_by_game("nba_stats_001").unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].player_id, "NBA_2544");
        assert_eq!(rows[0].points, Some(28));
    }

    #[test]
    fn find_by_id_after_upsert() {
        let db = open_test_db();
        setup(&db);
        let repo = db.player_game_boxes();
        repo.upsert(&box_row()).unwrap();
        let inserted = repo.find_by_game("nba_stats_001").unwrap();
        let surrogate_id = inserted[0].id;
        assert!(surrogate_id > 0);
        let found = repo.find_by_id(surrogate_id).unwrap();
        assert_eq!(found.unwrap().player_id, "NBA_2544");
    }

    #[test]
    fn find_by_id_missing_returns_none() {
        let db = open_test_db();
        let result = db.player_game_boxes().find_by_id(999_999).unwrap();
        assert_eq!(result, None);
    }

    #[test]
    fn upsert_is_idempotent() {
        let db = open_test_db();
        setup(&db);
        let repo = db.player_game_boxes();
        repo.upsert(&box_row()).unwrap();
        repo.upsert(&box_row()).unwrap();
        let rows = repo.find_by_game("nba_stats_001").unwrap();
        assert_eq!(rows.len(), 1);
    }

    #[test]
    fn upsert_updates_stats_on_conflict() {
        let db = open_test_db();
        setup(&db);
        let repo = db.player_game_boxes();
        repo.upsert(&box_row()).unwrap();
        let updated = PlayerGameBox {
            points: Some(35),
            ..box_row()
        };
        repo.upsert(&updated).unwrap();
        let rows = repo.find_by_game("nba_stats_001").unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].points, Some(35));
    }

    #[test]
    fn multiple_sources_produce_separate_rows() {
        let db = open_test_db();
        setup(&db);
        let repo = db.player_game_boxes();
        repo.upsert(&box_row()).unwrap();
        let bref_row = PlayerGameBox {
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
        let repo = db.player_game_boxes();
        repo.upsert(&box_row()).unwrap();
        let rows = repo.list_by_season(Season(2023)).unwrap();
        assert_eq!(rows.len(), 1);
    }

    #[test]
    fn list_by_season_empty_for_other_season() {
        let db = open_test_db();
        setup(&db);
        let repo = db.player_game_boxes();
        repo.upsert(&box_row()).unwrap();
        let rows = repo.list_by_season(Season(2020)).unwrap();
        assert!(rows.is_empty());
    }

    // ── load_from_parquet ────────────────────────────────────────────────────

    fn setup_load(db: &crate::Db) {
        insert_team(db, "NBA_LAL", "NBA");
        insert_team(db, "NBA_BOS", "NBA");
        insert_player(db, "NBA_P001", "NBA");
        insert_season(db, "2024-25", "NBA");
        insert_game(db, "NBA_G001", "NBA", "2024-25", "NBA_LAL", "NBA_BOS");
    }

    /// Write a one-row Parquet fixture using DuckDB's COPY … TO, then load it.
    fn write_player_parquet(dir: &std::path::Path) -> std::path::PathBuf {
        let path = dir.join("part-fixture.parquet");
        let conn = duckdb::Connection::open_in_memory().expect("in-memory conn");
        conn.execute_batch(&format!(
            "COPY (
                SELECT
                    'NBA_G001'                           AS game_id,
                    'NBA_P001'                           AS player_id,
                    'NBA_LAL'                            AS team_id,
                    '2024-25'                            AS season_id,
                    'Regular'                            AS season_type,
                    true                                 AS starter,
                    36.5                                 AS minutes_played,
                    28                                   AS points,
                    1                                    AS rebounds_offensive,
                    6                                    AS rebounds_defensive,
                    7                                    AS rebounds_total,
                    8                                    AS assists,
                    1                                    AS steals,
                    1                                    AS blocks,
                    3                                    AS turnovers,
                    2                                    AS personal_fouls,
                    11                                   AS field_goals_made,
                    20                                   AS field_goals_attempted,
                    2                                    AS three_pointers_made,
                    5                                    AS three_pointers_attempted,
                    4                                    AS free_throws_made,
                    4                                    AS free_throws_attempted,
                    8                                    AS plus_minus,
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
        let parquet = write_player_parquet(tmp.path());

        let db = open_test_db();
        setup_load(&db);
        let n = db
            .player_game_boxes()
            .load_from_parquet(parquet.to_str().unwrap())
            .unwrap();
        assert_eq!(n, 1);

        let rows = db.player_game_boxes().find_by_game("NBA_G001").unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].player_id, "NBA_P001");
        assert_eq!(rows[0].points, Some(28));
        assert_eq!(rows[0].assists, Some(8));
    }

    #[test]
    fn load_from_parquet_is_idempotent() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let parquet = write_player_parquet(tmp.path());
        let glob = parquet.to_str().unwrap();

        let db = open_test_db();
        setup_load(&db);
        let repo = db.player_game_boxes();
        repo.load_from_parquet(glob).unwrap();
        repo.load_from_parquet(glob).unwrap();

        let rows = repo.find_by_game("NBA_G001").unwrap();
        assert_eq!(rows.len(), 1, "second load must not duplicate rows");
    }
}
