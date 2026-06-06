use duckdb::Connection;

use crate::error::Result;
use crate::model::lineup_stint::LineupStint;
use crate::queries;

/// Repository for the `lineup_stint` fact table.
///
/// Obtain via [`crate::Db::lineup_stints`].
///
/// Uniqueness is per `(game_id, period, team_id, lineup_id, start_time_remaining, source)`.
/// Multiple sources may contribute rows for the same stint.
pub struct LineupStintRepo<'conn> {
    conn: &'conn Connection,
}

impl<'conn> LineupStintRepo<'conn> {
    pub(crate) fn new(conn: &'conn Connection) -> Self {
        Self { conn }
    }

    /// Insert or update a lineup stint row.
    ///
    /// On conflict by `(game_id, period, team_id, lineup_id, start_time_remaining, source)`,
    /// updates all stat and provenance columns. `row.id` is ignored.
    pub fn upsert(&self, row: &LineupStint) -> Result<()> {
        queries::lineup_stint::upsert(self.conn, row)
    }

    /// Returns the row with the given surrogate `id`, or `None` if not found.
    pub fn find_by_id(&self, id: i64) -> Result<Option<LineupStint>> {
        queries::lineup_stint::find_by_id(self.conn, id)
    }

    /// Bulk-loads lineup stint rows from Parquet files matching `glob_path`.
    ///
    /// Returns the number of rows inserted or updated.
    pub fn load_from_parquet(&self, glob_path: &str) -> Result<u64> {
        queries::lineup_stint::load_from_parquet(self.conn, glob_path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helpers::{
        insert_game, insert_player, insert_season, insert_team, open_test_db,
    };

    fn make_stint(
        game_id: &str,
        team_id: &str,
        p1: &str,
        p2: &str,
        p3: &str,
        p4: &str,
        p5: &str,
        start: f64,
    ) -> LineupStint {
        LineupStint {
            id: 0,
            game_id: game_id.to_string(),
            period: 1,
            team_id: team_id.to_string(),
            player1_id: Some(p1.to_string()),
            player2_id: Some(p2.to_string()),
            player3_id: Some(p3.to_string()),
            player4_id: Some(p4.to_string()),
            player5_id: Some(p5.to_string()),
            lineup_id: format!("{}-{}-{}-{}-{}", p1, p2, p3, p4, p5),
            start_time_remaining: start,
            end_time_remaining: Some(start - 120.0),
            duration_seconds: Some(120.0),
            possessions_offense: 10,
            possessions_defense: 10,
            points_for: 12,
            points_against: 10,
            plus_minus: 2,
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
        for player in ["NBA_P1", "NBA_P2", "NBA_P3", "NBA_P4", "NBA_P5"] {
            insert_player(db, player, "NBA");
        }
        insert_season(db, "2024-25", "NBA");
        insert_game(db, "NBA_G001", "NBA", "2024-25", "NBA_LAL", "NBA_BOS");
    }

    #[test]
    fn upsert_and_find_by_id() {
        let db = open_test_db();
        setup(&db);
        let stint = make_stint(
            "NBA_G001", "NBA_LAL", "NBA_P1", "NBA_P2", "NBA_P3", "NBA_P4", "NBA_P5", 720.0,
        );
        db.lineup_stints().upsert(&stint).unwrap();
        let row = db.lineup_stints().find_by_id(1).unwrap().unwrap();
        assert_eq!(row.team_id, "NBA_LAL");
        assert_eq!(row.possessions_offense, 10);
    }

    #[test]
    fn upsert_is_idempotent() {
        let db = open_test_db();
        setup(&db);
        let stint = make_stint(
            "NBA_G001", "NBA_LAL", "NBA_P1", "NBA_P2", "NBA_P3", "NBA_P4", "NBA_P5", 720.0,
        );
        db.lineup_stints().upsert(&stint).unwrap();
        db.lineup_stints().upsert(&stint).unwrap();
        let row = db.lineup_stints().find_by_id(1).unwrap().unwrap();
        assert_eq!(row.possessions_offense, 10);
    }

    #[test]
    fn upsert_updates_on_conflict() {
        let db = open_test_db();
        setup(&db);
        let stint = make_stint(
            "NBA_G001", "NBA_LAL", "NBA_P1", "NBA_P2", "NBA_P3", "NBA_P4", "NBA_P5", 720.0,
        );
        db.lineup_stints().upsert(&stint).unwrap();
        let updated = LineupStint {
            points_for: 20,
            ..make_stint(
                "NBA_G001", "NBA_LAL", "NBA_P1", "NBA_P2", "NBA_P3", "NBA_P4", "NBA_P5", 720.0,
            )
        };
        db.lineup_stints().upsert(&updated).unwrap();
        let row = db.lineup_stints().find_by_id(1).unwrap().unwrap();
        assert_eq!(row.points_for, 20);
    }

    #[test]
    fn find_by_id_missing_returns_none() {
        let db = open_test_db();
        let result = db.lineup_stints().find_by_id(999_999).unwrap();
        assert_eq!(result, None);
    }

    #[test]
    fn load_from_parquet_inserts_rows() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let path = tmp.path().join("part-fixture.parquet");
        let conn = duckdb::Connection::open_in_memory().expect("in-memory");
        conn.execute_batch(&format!(
            "COPY (
                SELECT
                    'NBA_G001'                              AS game_id,
                    1                                       AS period,
                    'NBA_LAL'                               AS team_id,
                    'NBA_P1'                                AS player1_id,
                    'NBA_P2'                                AS player2_id,
                    'NBA_P3'                                AS player3_id,
                    'NBA_P4'                                AS player4_id,
                    'NBA_P5'                                AS player5_id,
                    'NBA_P1-NBA_P2-NBA_P3-NBA_P4-NBA_P5'   AS lineup_id,
                    720.0                                   AS start_time_remaining,
                    600.0                                   AS end_time_remaining,
                    120.0                                   AS duration_seconds,
                    10                                      AS possessions_offense,
                    10                                      AS possessions_defense,
                    12                                      AS points_for,
                    10                                      AS points_against,
                    2                                       AS plus_minus,
                    '2024-25'                               AS season_id,
                    'Regular'                               AS season_type,
                    'pbpstats'                              AS source,
                    'https://pbpstats.com/game/NBA_G001'    AS source_url,
                    TIMESTAMPTZ '2024-12-01 10:00:00+00'    AS fetched_at,
                    '{{}}'                                  AS source_payload
            ) TO '{}' (FORMAT PARQUET)",
            path.display()
        ))
        .expect("write fixture");

        let db = open_test_db();
        setup(&db);
        let n = db
            .lineup_stints()
            .load_from_parquet(path.to_str().unwrap())
            .unwrap();
        assert_eq!(n, 1);
        let row = db.lineup_stints().find_by_id(1).unwrap().unwrap();
        assert_eq!(row.points_for, 12);
    }

    #[test]
    fn load_from_parquet_is_idempotent() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let path = tmp.path().join("part-fixture.parquet");
        let conn = duckdb::Connection::open_in_memory().expect("in-memory");
        conn.execute_batch(&format!(
            "COPY (
                SELECT
                    'NBA_G001'                              AS game_id,
                    1                                       AS period,
                    'NBA_LAL'                               AS team_id,
                    'NBA_P1'                                AS player1_id,
                    'NBA_P2'                                AS player2_id,
                    'NBA_P3'                                AS player3_id,
                    'NBA_P4'                                AS player4_id,
                    'NBA_P5'                                AS player5_id,
                    'NBA_P1-NBA_P2-NBA_P3-NBA_P4-NBA_P5'   AS lineup_id,
                    720.0                                   AS start_time_remaining,
                    600.0                                   AS end_time_remaining,
                    120.0                                   AS duration_seconds,
                    10                                      AS possessions_offense,
                    10                                      AS possessions_defense,
                    12                                      AS points_for,
                    10                                      AS points_against,
                    2                                       AS plus_minus,
                    '2024-25'                               AS season_id,
                    'Regular'                               AS season_type,
                    'pbpstats'                              AS source,
                    'https://pbpstats.com/game/NBA_G001'    AS source_url,
                    TIMESTAMPTZ '2024-12-01 10:00:00+00'    AS fetched_at,
                    '{{}}'                                  AS source_payload
            ) TO '{}' (FORMAT PARQUET)",
            path.display()
        ))
        .expect("write fixture");

        let db = open_test_db();
        setup(&db);
        let repo = db.lineup_stints();
        repo.load_from_parquet(path.to_str().unwrap()).unwrap();
        repo.load_from_parquet(path.to_str().unwrap()).unwrap();
        let row = db.lineup_stints().find_by_id(1).unwrap().unwrap();
        assert_eq!(row.points_for, 12, "second load must not duplicate rows");
    }
}
