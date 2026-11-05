//! Repository for computing and reading `player_team_season_totals` (T062).
//!
//! Obtain via [`crate::Db::player_team_season_rollups`].

use duckdb::Connection;

use crate::error::Result;
use crate::model::player_team_season_totals::PlayerTeamSeasonTotals;
use crate::queries;

/// Repository for the `player_team_season_totals` materialized rollup table.
pub struct PlayerTeamSeasonRollupRepo<'conn> {
    conn: &'conn Connection,
}

impl<'conn> PlayerTeamSeasonRollupRepo<'conn> {
    pub(crate) fn new(conn: &'conn Connection) -> Self {
        Self { conn }
    }

    /// Aggregates `player_game_box` into `player_team_season_totals` for a
    /// specific `(season_id, source)` pair.
    ///
    /// Returns the number of rows inserted or updated. Safe to call multiple
    /// times — subsequent calls upsert and refresh existing rows.
    pub fn compute_for_season(&self, season_id: &str, source: &str) -> Result<u64> {
        queries::player_team_season_rollup::upsert_player_team_totals_for_season(
            self.conn, season_id, source,
        )
    }

    /// Aggregates `player_game_box` into `player_team_season_totals` for **all**
    /// seasons for the given source.
    ///
    /// Returns the number of rows inserted or updated.
    pub fn compute_all_seasons(&self, source: &str) -> Result<u64> {
        queries::player_team_season_rollup::upsert_player_team_totals_all_seasons(
            self.conn, source,
        )
    }

    /// Returns all `player_team_season_totals` rows for the given
    /// `(season_id, source)`, ordered by `player_id, team_id`.
    pub fn list(&self, season_id: &str, source: &str) -> Result<Vec<PlayerTeamSeasonTotals>> {
        queries::player_team_season_rollup::list_player_team_totals(self.conn, season_id, source)
    }
}

#[cfg(test)]
mod tests {
    use crate::model::player_game_box::PlayerGameBox;
    use crate::test_helpers::{
        insert_game, insert_player, insert_season, insert_team, open_test_db,
    };

    fn player_box(
        game_id: &str,
        player_id: &str,
        team_id: &str,
        points: i16,
        minutes: f64,
    ) -> PlayerGameBox {
        PlayerGameBox {
            id: 0,
            game_id: game_id.to_string(),
            player_id: player_id.to_string(),
            team_id: team_id.to_string(),
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
        insert_game(db, "G003", "NBA", "2023-24", "NBA_LAL", "NBA_BOS");
    }

    #[test]
    fn compute_for_season_sums_correctly() {
        let db = open_test_db();
        setup(&db);
        let boxes = db.player_game_boxes();
        boxes
            .upsert(&player_box("G001", "NBA_P001", "NBA_LAL", 28, 36.0))
            .unwrap();
        boxes
            .upsert(&player_box("G002", "NBA_P001", "NBA_LAL", 22, 32.0))
            .unwrap();

        let repo = db.player_team_season_rollups();
        let n = repo.compute_for_season("2023-24", "nba_stats").unwrap();
        assert_eq!(n, 1, "one player+team combination → one row");

        let rows = repo.list("2023-24", "nba_stats").unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].player_id, "NBA_P001");
        assert_eq!(rows[0].team_id, "NBA_LAL");
        assert_eq!(rows[0].games_played, 2);
        assert_eq!(rows[0].points, Some(50));
    }

    #[test]
    fn compute_for_season_splits_by_team() {
        let db = open_test_db();
        setup(&db);
        let boxes = db.player_game_boxes();
        // P001 plays for LAL in G001 and BOS in G002 (mid-season trade)
        boxes
            .upsert(&player_box("G001", "NBA_P001", "NBA_LAL", 28, 36.0))
            .unwrap();
        boxes
            .upsert(&player_box("G002", "NBA_P001", "NBA_BOS", 22, 32.0))
            .unwrap();

        let repo = db.player_team_season_rollups();
        let n = repo.compute_for_season("2023-24", "nba_stats").unwrap();
        assert_eq!(n, 2, "two team stints → two rows");

        let rows = repo.list("2023-24", "nba_stats").unwrap();
        assert_eq!(rows.len(), 2);
        // sorted by player_id, team_id
        let bos = rows.iter().find(|r| r.team_id == "NBA_BOS").unwrap();
        let lal = rows.iter().find(|r| r.team_id == "NBA_LAL").unwrap();
        assert_eq!(bos.points, Some(22));
        assert_eq!(lal.points, Some(28));
    }

    #[test]
    fn compute_for_season_is_idempotent() {
        let db = open_test_db();
        setup(&db);
        db.player_game_boxes()
            .upsert(&player_box("G001", "NBA_P001", "NBA_LAL", 28, 36.0))
            .unwrap();

        let repo = db.player_team_season_rollups();
        repo.compute_for_season("2023-24", "nba_stats").unwrap();
        repo.compute_for_season("2023-24", "nba_stats").unwrap();

        let rows = repo.list("2023-24", "nba_stats").unwrap();
        assert_eq!(rows.len(), 1, "re-run must not duplicate rows");
    }

    #[test]
    fn compute_all_seasons_covers_multiple_seasons() {
        let db = open_test_db();
        setup(&db);
        insert_season(&db, "2022-23", "NBA");
        insert_game(&db, "G_OLD", "NBA", "2022-23", "NBA_LAL", "NBA_BOS");

        let mut old_box = player_box("G_OLD", "NBA_P001", "NBA_LAL", 30, 38.0);
        old_box.season_id = "2022-23".to_string();
        db.player_game_boxes().upsert(&old_box).unwrap();
        db.player_game_boxes()
            .upsert(&player_box("G001", "NBA_P001", "NBA_LAL", 20, 30.0))
            .unwrap();

        let repo = db.player_team_season_rollups();
        let n = repo.compute_all_seasons("nba_stats").unwrap();
        assert_eq!(n, 2, "two seasons → two rows");
    }
}
