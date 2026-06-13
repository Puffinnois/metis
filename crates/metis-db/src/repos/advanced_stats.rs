use duckdb::Connection;

use crate::error::Result;
use crate::queries;

/// Repository for computing and reading advanced stats materialised tables.
///
/// Covers `player_season_advanced`, `player_season_per_36`, and
/// `player_season_per_100`.
///
/// Obtain via [`crate::Db::advanced_stats`].
pub struct AdvancedStatsRepo<'conn> {
    conn: &'conn Connection,
}

impl<'conn> AdvancedStatsRepo<'conn> {
    pub(crate) fn new(conn: &'conn Connection) -> Self {
        Self { conn }
    }

    /// Returns the number of `player_season_totals` rows for the given
    /// season+source. Used as a pre-flight check before computing advanced stats.
    pub fn count_player_totals_rows(&self, season_id: &str, source: &str) -> Result<u64> {
        queries::advanced_stats::count_player_totals_rows(self.conn, season_id, source)
    }

    /// Computes TS%, eFG%, and USG% and upserts into `player_season_advanced`.
    ///
    /// Requires that `player_season_totals` and `team_season_totals` are already
    /// populated (i.e. `compute_season_rollups` has been run first).
    ///
    /// Returns the number of rows inserted or updated.
    pub fn upsert_player_advanced(&self, season_id: &str, source: &str) -> Result<u64> {
        queries::advanced_stats::upsert_player_advanced(self.conn, season_id, source)
    }

    /// Computes per-36-minute rates for all counting stats and upserts into
    /// `player_season_per_36`.
    ///
    /// Returns the number of rows inserted or updated.
    pub fn upsert_player_per_36(&self, season_id: &str, source: &str) -> Result<u64> {
        queries::advanced_stats::upsert_player_per_36(self.conn, season_id, source)
    }

    /// Computes per-100-possession rates for all counting stats and upserts into
    /// `player_season_per_100`.
    ///
    /// Returns the number of rows inserted or updated.
    pub fn upsert_player_per_100(&self, season_id: &str, source: &str) -> Result<u64> {
        queries::advanced_stats::upsert_player_per_100(self.conn, season_id, source)
    }
}

#[cfg(test)]
mod tests {
    use crate::model::player_game_box::PlayerGameBox;
    use crate::model::team_game_box::TeamGameBox;
    use crate::test_helpers::{
        insert_game, insert_player, insert_season, insert_team, open_test_db,
    };

    fn player_box(
        game_id: &str,
        player_id: &str,
        team_id: &str,
        pts: i16,
        min: f64,
        fgm: i16,
        fga: i16,
        fg3m: i16,
        fg3a: i16,
        ftm: i16,
        fta: i16,
        orb: i16,
        tov: i16,
    ) -> PlayerGameBox {
        PlayerGameBox {
            id: 0,
            game_id: game_id.to_string(),
            player_id: player_id.to_string(),
            team_id: team_id.to_string(),
            season_id: "2023-24".to_string(),
            season_type: "Regular".to_string(),
            starter: Some(true),
            minutes_played: Some(min),
            points: Some(pts),
            rebounds_offensive: Some(orb),
            rebounds_defensive: Some(3),
            rebounds_total: Some(orb + 3),
            assists: Some(5),
            steals: Some(1),
            blocks: Some(0),
            turnovers: Some(tov),
            personal_fouls: Some(2),
            field_goals_made: Some(fgm),
            field_goals_attempted: Some(fga),
            three_pointers_made: Some(fg3m),
            three_pointers_attempted: Some(fg3a),
            free_throws_made: Some(ftm),
            free_throws_attempted: Some(fta),
            plus_minus: Some(0),
            source: "nba_stats".to_string(),
            source_url: "https://stats.nba.com/".to_string(),
            fetched_at: "2024-01-15 12:00:00".to_string(),
            source_payload: "{}".to_string(),
            ingested_at: None,
        }
    }

    fn team_box(game_id: &str, team_id: &str, opp_id: &str, pts: i16) -> TeamGameBox {
        TeamGameBox {
            id: 0,
            game_id: game_id.to_string(),
            team_id: team_id.to_string(),
            opponent_team_id: opp_id.to_string(),
            season_id: "2023-24".to_string(),
            season_type: "Regular".to_string(),
            is_home: team_id == "NBA_LAL",
            points: Some(pts),
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

    fn setup(db: &crate::Db) {
        insert_team(db, "NBA_LAL", "NBA");
        insert_team(db, "NBA_BOS", "NBA");
        insert_player(db, "NBA_P001", "NBA");
        insert_season(db, "2023-24", "NBA");
        insert_game(db, "G001", "NBA", "2023-24", "NBA_LAL", "NBA_BOS");
    }

    /// Insert one player box + one team box, then run rollups so that totals tables
    /// are populated. Returns the player's raw totals for assertion reuse.
    fn seed_rollups(db: &crate::Db) {
        setup(db);

        // Player: 28 pts, 36 min, 10 FGM / 20 FGA, 3 3PM / 6 3PA, 5 FTM / 8 FTA, 2 ORB, 3 TOV
        db.player_game_boxes()
            .upsert(&player_box(
                "G001", "NBA_P001", "NBA_LAL", 28, 36.0, 10, 20, 3, 6, 5, 8, 2, 3,
            ))
            .unwrap();

        // Team box to populate team_season_totals
        db.team_game_boxes()
            .upsert(&team_box("G001", "NBA_LAL", "NBA_BOS", 110))
            .unwrap();

        let rollups = db.season_rollups();
        rollups
            .compute_player_totals("2023-24", "nba_stats")
            .unwrap();
        rollups
            .compute_player_per_game("2023-24", "nba_stats")
            .unwrap();
        rollups.compute_team_totals("2023-24", "nba_stats").unwrap();
        rollups
            .compute_team_per_game("2023-24", "nba_stats")
            .unwrap();
    }

    #[test]
    fn count_player_totals_rows_zero_when_empty() {
        let db = open_test_db();
        setup(&db);
        let n = db
            .advanced_stats()
            .count_player_totals_rows("2023-24", "nba_stats")
            .unwrap();
        assert_eq!(n, 0);
    }

    #[test]
    fn upsert_player_per_36_computes_correctly() {
        let db = open_test_db();
        seed_rollups(&db);

        let n = db
            .advanced_stats()
            .upsert_player_per_36("2023-24", "nba_stats")
            .unwrap();
        assert_eq!(n, 1, "one player → one per-36 row");

        // Verify via raw SQL: pts * 36 / 36 = 28.0, fgm * 36 / 36 = 10.0
        let conn = db.raw_conn();
        let (pts_36, fgm_36): (f64, f64) = conn
            .query_row(
                "SELECT CAST(points AS DOUBLE), CAST(field_goals_made AS DOUBLE)
                 FROM player_season_per_36
                 WHERE player_id = 'NBA_P001' AND season_id = '2023-24' AND source = 'nba_stats'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        // 28 pts × 36 / 36 min = 28.0
        assert!((pts_36 - 28.0).abs() < 0.01, "pts/36 = {pts_36}");
        // 10 FGM × 36 / 36 min = 10.0
        assert!((fgm_36 - 10.0).abs() < 0.01, "fgm/36 = {fgm_36}");
    }

    #[test]
    fn upsert_player_per_36_is_idempotent() {
        let db = open_test_db();
        seed_rollups(&db);

        let repo = db.advanced_stats();
        repo.upsert_player_per_36("2023-24", "nba_stats").unwrap();
        repo.upsert_player_per_36("2023-24", "nba_stats").unwrap();

        let count: i64 = db
            .raw_conn()
            .query_row(
                "SELECT COUNT(*) FROM player_season_per_36 WHERE season_id='2023-24'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "re-run must not duplicate rows");
    }

    #[test]
    fn upsert_player_per_100_computes_correctly() {
        let db = open_test_db();
        seed_rollups(&db);

        let n = db
            .advanced_stats()
            .upsert_player_per_100("2023-24", "nba_stats")
            .unwrap();
        assert_eq!(n, 1);

        // est_poss = FGA + 0.44*FTA + TOV - ORB = 20 + 0.44*8 + 3 - 2 = 24.52
        // pts/100 = 28 * 100 / 24.52 ≈ 114.17
        let pts_100: f64 = db
            .raw_conn()
            .query_row(
                "SELECT CAST(points AS DOUBLE) FROM player_season_per_100
                 WHERE player_id = 'NBA_P001' AND season_id = '2023-24' AND source = 'nba_stats'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        let est_poss = 20.0 + 0.44 * 8.0 + 3.0 - 2.0; // 24.52
        let expected = 28.0 * 100.0 / est_poss;
        assert!(
            (pts_100 - expected).abs() < 0.01,
            "pts/100 = {pts_100}, expected {expected}"
        );
    }

    #[test]
    fn upsert_player_per_100_is_idempotent() {
        let db = open_test_db();
        seed_rollups(&db);

        let repo = db.advanced_stats();
        repo.upsert_player_per_100("2023-24", "nba_stats").unwrap();
        repo.upsert_player_per_100("2023-24", "nba_stats").unwrap();

        let count: i64 = db
            .raw_conn()
            .query_row(
                "SELECT COUNT(*) FROM player_season_per_100 WHERE season_id='2023-24'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "re-run must not duplicate rows");
    }

    #[test]
    fn upsert_player_advanced_computes_ts_and_efg() {
        let db = open_test_db();
        seed_rollups(&db);

        let n = db
            .advanced_stats()
            .upsert_player_advanced("2023-24", "nba_stats")
            .unwrap();
        assert_eq!(n, 1);

        // TS% = 28 / (2*(20 + 0.44*8)) = 28 / (2*23.52) = 28 / 47.04 ≈ 0.5952
        // eFG% = (10 + 0.5*3) / 20 = 11.5 / 20 = 0.575
        let (ts, efg): (f64, f64) = db
            .raw_conn()
            .query_row(
                "SELECT CAST(true_shooting_pct AS DOUBLE), CAST(effective_fg_pct AS DOUBLE)
                 FROM player_season_advanced
                 WHERE player_id = 'NBA_P001' AND season_id = '2023-24' AND source = 'nba_stats'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();

        let expected_ts = 28.0 / (2.0 * (20.0 + 0.44 * 8.0));
        let expected_efg = (10.0 + 0.5 * 3.0) / 20.0;
        assert!(
            (ts - expected_ts).abs() < 0.0001,
            "TS% = {ts}, expected {expected_ts}"
        );
        assert!(
            (efg - expected_efg).abs() < 0.0001,
            "eFG% = {efg}, expected {expected_efg}"
        );
    }

    #[test]
    fn upsert_player_advanced_is_idempotent() {
        let db = open_test_db();
        seed_rollups(&db);

        let repo = db.advanced_stats();
        repo.upsert_player_advanced("2023-24", "nba_stats").unwrap();
        repo.upsert_player_advanced("2023-24", "nba_stats").unwrap();

        let count: i64 = db
            .raw_conn()
            .query_row(
                "SELECT COUNT(*) FROM player_season_advanced WHERE season_id='2023-24'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "re-run must not duplicate rows");
    }
}
