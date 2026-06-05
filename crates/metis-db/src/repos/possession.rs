use duckdb::Connection;

use crate::error::Result;
use crate::model::possession::Possession;
use crate::queries;

/// Repository for the `possession` fact table.
///
/// Obtain via [`crate::Db::possessions`].
///
/// Uniqueness is per `(game_id, period, possession_num, source)`. Multiple sources
/// may contribute rows for the same possession; the reconciliation layer selects a
/// canonical value.
pub struct PossessionRepo<'conn> {
    conn: &'conn Connection,
}

impl<'conn> PossessionRepo<'conn> {
    pub(crate) fn new(conn: &'conn Connection) -> Self {
        Self { conn }
    }

    /// Insert or update a possession row.
    ///
    /// On conflict by `(game_id, period, possession_num, source)`, updates all stat
    /// and provenance columns. `row.id` is ignored — the DB sequence assigns surrogate keys.
    pub fn upsert(&self, row: &Possession) -> Result<()> {
        queries::possession::upsert(self.conn, row)
    }

    /// Returns the row with the given surrogate `id`, or `None` if not found.
    pub fn find_by_id(&self, id: i64) -> Result<Option<Possession>> {
        queries::possession::find_by_id(self.conn, id)
    }

    /// Bulk-loads possession rows from Parquet files matching `glob_path`.
    ///
    /// Returns the number of rows inserted or updated.
    pub fn load_from_parquet(&self, glob_path: &str) -> Result<u64> {
        queries::possession::load_from_parquet(self.conn, glob_path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helpers::{insert_game, insert_season, insert_team, open_test_db};

    fn make_possession() -> Possession {
        Possession {
            id: 0,
            game_id: "NBA_G001".to_string(),
            period: 1,
            possession_num: 1,
            global_possession_num: 1,
            offense_team_id: "NBA_LAL".to_string(),
            defense_team_id: Some("NBA_BOS".to_string()),
            start_time_remaining: Some(720.0),
            end_time_remaining: Some(706.0),
            duration_seconds: Some(14.0),
            score_margin: Some(0),
            possession_start_type: Some("JumpBall".to_string()),
            points_scored: 2,
            offense_lineup_id: Some("203500-1628384".to_string()),
            defense_lineup_id: Some("202326-1626164".to_string()),
            num_events: 3,
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
        insert_team(db, "NBA_LAL", "NBA");
        insert_team(db, "NBA_BOS", "NBA");
        insert_season(db, "2024-25", "NBA");
        insert_game(db, "NBA_G001", "NBA", "2024-25", "NBA_LAL", "NBA_BOS");
    }

    #[test]
    fn upsert_and_find_by_id() {
        let db = open_test_db();
        setup(&db);
        let repo = db.possessions();
        repo.upsert(&make_possession()).unwrap();
        let inserted = repo.find_by_id(1).unwrap();
        assert!(inserted.is_some());
        let row = inserted.unwrap();
        assert_eq!(row.offense_team_id, "NBA_LAL");
        assert_eq!(row.points_scored, 2);
    }

    #[test]
    fn upsert_is_idempotent() {
        let db = open_test_db();
        setup(&db);
        let repo = db.possessions();
        repo.upsert(&make_possession()).unwrap();
        repo.upsert(&make_possession()).unwrap();
        let row = repo.find_by_id(1).unwrap().unwrap();
        assert_eq!(row.points_scored, 2);
    }

    #[test]
    fn upsert_updates_on_conflict() {
        let db = open_test_db();
        setup(&db);
        let repo = db.possessions();
        repo.upsert(&make_possession()).unwrap();
        let updated = Possession {
            points_scored: 3,
            ..make_possession()
        };
        repo.upsert(&updated).unwrap();
        let row = repo.find_by_id(1).unwrap().unwrap();
        assert_eq!(row.points_scored, 3);
    }

    #[test]
    fn find_by_id_missing_returns_none() {
        let db = open_test_db();
        let result = db.possessions().find_by_id(999_999).unwrap();
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
                    1                                       AS possession_num,
                    1                                       AS global_possession_num,
                    'NBA_LAL'                               AS offense_team_id,
                    'NBA_BOS'                               AS defense_team_id,
                    720.0                                   AS start_time_remaining,
                    706.0                                   AS end_time_remaining,
                    14.0                                    AS duration_seconds,
                    0                                       AS score_margin,
                    'JumpBall'                              AS possession_start_type,
                    2                                       AS points_scored,
                    '203500-1628384'                        AS offense_lineup_id,
                    '202326-1626164'                        AS defense_lineup_id,
                    3                                       AS num_events,
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
            .possessions()
            .load_from_parquet(path.to_str().unwrap())
            .unwrap();
        assert_eq!(n, 1);

        let row = db.possessions().find_by_id(1).unwrap().unwrap();
        assert_eq!(row.points_scored, 2);
        assert_eq!(row.offense_team_id, "NBA_LAL");
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
                    1                                       AS possession_num,
                    1                                       AS global_possession_num,
                    'NBA_LAL'                               AS offense_team_id,
                    'NBA_BOS'                               AS defense_team_id,
                    720.0                                   AS start_time_remaining,
                    706.0                                   AS end_time_remaining,
                    14.0                                    AS duration_seconds,
                    0                                       AS score_margin,
                    NULL::VARCHAR                           AS possession_start_type,
                    2                                       AS points_scored,
                    NULL::VARCHAR                           AS offense_lineup_id,
                    NULL::VARCHAR                           AS defense_lineup_id,
                    3                                       AS num_events,
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
        let repo = db.possessions();
        repo.load_from_parquet(path.to_str().unwrap()).unwrap();
        repo.load_from_parquet(path.to_str().unwrap()).unwrap();

        let row = db.possessions().find_by_id(1).unwrap().unwrap();
        assert_eq!(row.points_scored, 2, "second load must not duplicate rows");
    }
}
