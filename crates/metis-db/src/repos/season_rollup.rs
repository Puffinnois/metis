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
    pub fn compute_team_totals(&self, season_id: &str, source: &str) -> Result<u64> {
        queries::season_rollup::upsert_team_totals(self.conn, season_id, source)
    }

    /// Derives `team_season_per_game` from `team_season_totals`. Must be called after
    /// `compute_team_totals`.
    pub fn compute_team_per_game(&self, season_id: &str, source: &str) -> Result<u64> {
        queries::season_rollup::upsert_team_per_game(self.conn, season_id, source)
    }

    /// Returns all `team_season_totals` rows for the given season+source.
    pub fn list_team_totals(&self, season_id: &str, source: &str) -> Result<Vec<TeamSeasonTotals>> {
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
    use crate::model::player_game_box::PlayerGameBox;
    use crate::test_helpers::{
        insert_game, insert_player, insert_season, insert_team, open_test_db,
    };

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
        boxes
            .upsert(&player_box("G001", "NBA_P001", 28, 36.0))
            .unwrap();
        boxes
            .upsert(&player_box("G002", "NBA_P001", 22, 32.0))
            .unwrap();

        let repo = db.season_rollups();
        let n = repo.compute_player_totals("2023-24", "nba_stats").unwrap();
        assert_eq!(n, 1, "one player → one totals row");

        let rows = repo.list_player_totals("2023-24", "nba_stats").unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].player_id, "NBA_P001");
        assert_eq!(rows[0].games_played, 2);
        assert_eq!(rows[0].points, Some(50));
        assert_eq!(rows[0].minutes_played, Some(68.0));
        assert_eq!(rows[0].field_goals_made, Some(10));
    }

    #[test]
    fn compute_player_totals_separates_two_players() {
        let db = open_test_db();
        setup(&db);
        let boxes = db.player_game_boxes();
        boxes
            .upsert(&player_box("G001", "NBA_P001", 28, 36.0))
            .unwrap();
        boxes
            .upsert(&player_box("G001", "NBA_P002", 15, 24.0))
            .unwrap();

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
        boxes
            .upsert(&player_box("G001", "NBA_P001", 28, 36.0))
            .unwrap();
        boxes
            .upsert(&player_box("G002", "NBA_P001", 22, 32.0))
            .unwrap();

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
        repo.compute_player_per_game("2023-24", "nba_stats")
            .unwrap();
        repo.compute_player_per_game("2023-24", "nba_stats")
            .unwrap();

        let rows = repo.list_player_per_game("2023-24", "nba_stats").unwrap();
        assert_eq!(rows.len(), 1, "re-run must not duplicate rows");
    }
}
