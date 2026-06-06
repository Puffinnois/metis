use duckdb::Connection;
use metis_core::Season;

use crate::error::Result;
use crate::model::player_lineup_stats::PlayerLineupStats;
use crate::queries;

/// Repository for the `player_lineup_stats` compute-output table.
///
/// Obtain via [`crate::Db::player_lineup_stats`].
///
/// Uniqueness is per `(player_id, team_id, season_id, season_type)`. Populated by
/// [`compute_for_season`][Self::compute_for_season], not the ingest pipeline.
pub struct PlayerLineupStatsRepo<'conn> {
    conn: &'conn Connection,
}

impl<'conn> PlayerLineupStatsRepo<'conn> {
    pub(crate) fn new(conn: &'conn Connection) -> Self {
        Self { conn }
    }

    /// Returns the row with the given surrogate `id`, or `None` if not found.
    pub fn find_by_id(&self, id: i64) -> Result<Option<PlayerLineupStats>> {
        queries::player_lineup_stats::find_by_id(self.conn, id)
    }

    /// Returns all on-off rows for a player in the given season and season type,
    /// ordered by team. A player who changed teams mid-season returns multiple rows.
    pub fn find_by_player_season(
        &self,
        player_id: &str,
        season: Season,
        season_type: &str,
    ) -> Result<Vec<PlayerLineupStats>> {
        queries::player_lineup_stats::find_by_player_season(
            self.conn,
            player_id,
            &season.to_string(),
            season_type,
        )
    }

    /// Computes on-off and lineup net ratings for all players in `season` from
    /// `lineup_stint` data and upserts the results into `player_lineup_stats`.
    ///
    /// All season types present in `lineup_stint` for the given season are computed
    /// together. Running this multiple times is safe — subsequent calls overwrite the
    /// previous compute output.
    ///
    /// Returns the number of rows inserted or updated.
    pub fn compute_for_season(&self, season: Season) -> Result<u64> {
        queries::player_lineup_stats::compute_for_season(self.conn, &season.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        model::lineup_stint::LineupStint,
        test_helpers::{insert_game, insert_player, insert_season, insert_team, open_test_db},
    };

    /// Players: P1–P7 on LAL vs BOS, one game, one period.
    ///
    /// Three stints — same possessions/points each to produce clean numbers:
    ///
    /// | Stint | On-floor                 | Poss off | Poss def | Pts for | Pts against | Sec |
    /// |-------|--------------------------|----------|----------|---------|-------------|-----|
    /// | A     | P1, P2, P3, P4, P5       | 10       | 10       | 10      | 8           | 120 |
    /// | B     | P1, P2, P3, P4, P6 (P5–) | 10       | 10       | 10      | 10          | 120 |
    /// | C     | P3, P4, P5, P6, P7 (P1–) | 10       | 10       | 10      | 12          | 120 |
    ///
    /// Expected for P1 (on in A+B, off in C):
    ///   on:  poss_off=20, poss_def=20, pts_for=20, pts_against=18, min=4.0
    ///   net_rating_on  = (20-18)*200 / 40 = 10.0
    ///   off: poss_off=10, poss_def=10, pts_for=10, pts_against=12, min=2.0
    ///   net_rating_off = (10-12)*200 / 20 = -20.0
    ///   on_off = 30.0
    ///
    /// Expected for P5 (on in A+C, off in B):
    ///   net_rating_on  = (20-20)*200 / 40 = 0.0
    ///   net_rating_off = (10-10)*200 / 20 = 0.0
    ///   on_off = 0.0
    fn make_stint(
        player_ids: [&str; 5],
        start: f64,
        points_for: i16,
        points_against: i16,
    ) -> LineupStint {
        LineupStint {
            id: 0,
            game_id: "NBA_G001".to_string(),
            period: 1,
            team_id: "NBA_LAL".to_string(),
            player1_id: Some(player_ids[0].to_string()),
            player2_id: Some(player_ids[1].to_string()),
            player3_id: Some(player_ids[2].to_string()),
            player4_id: Some(player_ids[3].to_string()),
            player5_id: Some(player_ids[4].to_string()),
            lineup_id: player_ids.join("-"),
            start_time_remaining: start,
            end_time_remaining: Some(start - 120.0),
            duration_seconds: Some(120.0),
            possessions_offense: 10,
            possessions_defense: 10,
            points_for,
            points_against,
            plus_minus: points_for - points_against,
            season_id: "2024-25".to_string(),
            season_type: "Regular".to_string(),
            source: "pbpstats".to_string(),
            source_url: "https://pbpstats.com/game/NBA_G001".to_string(),
            fetched_at: "2024-12-01 10:00:00".to_string(),
            source_payload: "{}".to_string(),
            ingested_at: None,
        }
    }

    fn setup(db: &crate::Db) {
        for team in ["NBA_LAL", "NBA_BOS"] {
            insert_team(db, team, "NBA");
        }
        for player in [
            "NBA_P1", "NBA_P2", "NBA_P3", "NBA_P4", "NBA_P5", "NBA_P6", "NBA_P7",
        ] {
            insert_player(db, player, "NBA");
        }
        insert_season(db, "2024-25", "NBA");
        insert_game(db, "NBA_G001", "NBA", "2024-25", "NBA_LAL", "NBA_BOS");
    }

    fn insert_stints(db: &crate::Db) {
        let repo = db.lineup_stints();
        // Stint A: P1–P5 on floor
        repo.upsert(&make_stint(
            ["NBA_P1", "NBA_P2", "NBA_P3", "NBA_P4", "NBA_P5"],
            720.0,
            10,
            8,
        ))
        .unwrap();
        // Stint B: P1–P4 + P6 (P5 off)
        repo.upsert(&make_stint(
            ["NBA_P1", "NBA_P2", "NBA_P3", "NBA_P4", "NBA_P6"],
            600.0,
            10,
            10,
        ))
        .unwrap();
        // Stint C: P3–P7 (P1, P2 off)
        repo.upsert(&make_stint(
            ["NBA_P3", "NBA_P4", "NBA_P5", "NBA_P6", "NBA_P7"],
            480.0,
            10,
            12,
        ))
        .unwrap();
    }

    #[test]
    fn compute_produces_correct_on_off_for_p1() {
        let db = open_test_db();
        setup(&db);
        insert_stints(&db);

        let n = db
            .player_lineup_stats()
            .compute_for_season(Season(2024))
            .unwrap();
        assert!(n > 0, "compute must produce at least one row");

        let rows = db
            .player_lineup_stats()
            .find_by_player_season("NBA_P1", Season(2024), "Regular")
            .unwrap();
        assert_eq!(rows.len(), 1);
        let r = &rows[0];

        assert_eq!(r.possessions_on_offense, Some(20));
        assert_eq!(r.possessions_on_defense, Some(20));
        assert_eq!(r.points_for_on, Some(20));
        assert_eq!(r.points_against_on, Some(18));
        assert!((r.minutes_on_court.unwrap() - 4.0).abs() < 1e-6);

        let net_on = r.net_rating_on.unwrap();
        assert!((net_on - 10.0).abs() < 1e-6, "net_rating_on={net_on}");

        assert_eq!(r.possessions_off_offense, Some(10));
        assert_eq!(r.possessions_off_defense, Some(10));
        assert_eq!(r.points_for_off, Some(10));
        assert_eq!(r.points_against_off, Some(12));
        assert!((r.minutes_off_court.unwrap() - 2.0).abs() < 1e-6);

        let net_off = r.net_rating_off.unwrap();
        assert!((net_off - (-20.0)).abs() < 1e-6, "net_rating_off={net_off}");

        let on_off = r.on_off_net_rating.unwrap();
        assert!((on_off - 30.0).abs() < 1e-6, "on_off={on_off}");
    }

    #[test]
    fn compute_produces_correct_on_off_for_p5() {
        let db = open_test_db();
        setup(&db);
        insert_stints(&db);

        db.player_lineup_stats()
            .compute_for_season(Season(2024))
            .unwrap();

        let rows = db
            .player_lineup_stats()
            .find_by_player_season("NBA_P5", Season(2024), "Regular")
            .unwrap();
        assert_eq!(rows.len(), 1);
        let r = &rows[0];

        assert!((r.net_rating_on.unwrap() - 0.0).abs() < 1e-6);
        assert!((r.net_rating_off.unwrap() - 0.0).abs() < 1e-6);
        assert!((r.on_off_net_rating.unwrap() - 0.0).abs() < 1e-6);
    }

    #[test]
    fn compute_is_idempotent() {
        let db = open_test_db();
        setup(&db);
        insert_stints(&db);

        db.player_lineup_stats()
            .compute_for_season(Season(2024))
            .unwrap();
        db.player_lineup_stats()
            .compute_for_season(Season(2024))
            .unwrap();

        let rows = db
            .player_lineup_stats()
            .find_by_player_season("NBA_P1", Season(2024), "Regular")
            .unwrap();
        assert_eq!(rows.len(), 1, "second compute must not duplicate rows");
    }

    #[test]
    fn find_by_id_missing_returns_none() {
        let db = open_test_db();
        let result = db.player_lineup_stats().find_by_id(999_999).unwrap();
        assert_eq!(result, None);
    }

    #[test]
    fn empty_season_produces_no_rows() {
        let db = open_test_db();
        setup(&db);
        let n = db
            .player_lineup_stats()
            .compute_for_season(Season(2023))
            .unwrap();
        assert_eq!(n, 0);
    }
}
