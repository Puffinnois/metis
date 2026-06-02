use duckdb::Connection;

use crate::error::Result;
use crate::model::player_season_canonical::PlayerSeasonCanonical;
use crate::model::player_season_totals::PlayerSeasonTotals;
use crate::model::stat_disagreement::StatDisagreement;
use crate::queries;

/// Repository for the reconciliation layer.
///
/// Obtain via [`crate::Db::reconcile`].
pub struct ReconcileRepo<'conn> {
    conn: &'conn Connection,
}

impl<'conn> ReconcileRepo<'conn> {
    pub(crate) fn new(conn: &'conn Connection) -> Self {
        Self { conn }
    }

    /// Returns the number of `player_season_totals` rows for the given season (any source).
    /// Used as a pre-flight check before reconciling.
    pub fn count_season_totals_rows(&self, season_id: &str) -> Result<u64> {
        queries::reconcile::count_season_totals_rows(self.conn, season_id)
    }

    /// Returns the distinct ingest sources present in `player_season_totals` for the season.
    pub fn list_distinct_sources(&self, season_id: &str) -> Result<Vec<String>> {
        queries::reconcile::list_distinct_sources(self.conn, season_id)
    }

    /// Returns all `player_season_totals` rows for the given season and source.
    pub fn list_totals_for_source(
        &self,
        season_id: &str,
        source: &str,
    ) -> Result<Vec<PlayerSeasonTotals>> {
        queries::reconcile::list_totals_for_source(self.conn, season_id, source)
    }

    /// Copies `player_season_totals` rows for `primary_source` into `player_season_canonical`.
    /// Returns the number of rows inserted or updated.
    pub fn upsert_canonical(&self, season_id: &str, primary_source: &str) -> Result<u64> {
        queries::reconcile::upsert_canonical(self.conn, season_id, primary_source)
    }

    /// Inserts or updates a single disagreement record.
    pub fn insert_disagreement(&self, d: &StatDisagreement) -> Result<()> {
        queries::reconcile::insert_disagreement(self.conn, d)
    }

    /// Returns all `player_season_canonical` rows for the given season.
    pub fn list_canonical(&self, season_id: &str) -> Result<Vec<PlayerSeasonCanonical>> {
        queries::reconcile::list_canonical(self.conn, season_id)
    }

    /// Returns all `stat_disagreement` rows for the given season.
    pub fn list_disagreements(&self, season_id: &str) -> Result<Vec<StatDisagreement>> {
        queries::reconcile::list_disagreements(self.conn, season_id)
    }
}

#[cfg(test)]
mod tests {
    use crate::test_helpers::{
        insert_game, insert_player, insert_season, insert_team, open_test_db,
    };

    use super::*;

    fn setup(db: &crate::Db) {
        insert_team(db, "NBA_LAL", "NBA");
        insert_team(db, "NBA_BOS", "NBA");
        insert_player(db, "NBA_P001", "NBA");
        insert_season(db, "2023-24", "NBA");
        insert_game(db, "G001", "NBA", "2023-24", "NBA_LAL", "NBA_BOS");
    }

    fn seed_totals_row(db: &crate::Db, player_id: &str, source: &str, points: i32) {
        db.raw_conn()
            .execute(
                "INSERT INTO player_season_totals
                    (player_id, season_id, season_type, source, games_played, points,
                     rebounds_offensive, rebounds_defensive, rebounds_total, assists,
                     steals, blocks, turnovers, personal_fouls,
                     field_goals_made, field_goals_attempted,
                     three_pointers_made, three_pointers_attempted,
                     free_throws_made, free_throws_attempted)
                 VALUES (?, '2023-24', 'Regular', ?, 10, ?, 2, 5, 7, 3, 1, 0, 2, 2, 4, 10, 1, 3, 2, 3)
                 ON CONFLICT (player_id, season_id, season_type, source) DO NOTHING",
                duckdb::params![player_id, source, points],
            )
            .expect("seed totals row");
    }

    #[test]
    fn count_season_totals_rows_zero_when_empty() {
        let db = open_test_db();
        setup(&db);
        let n = db.reconcile().count_season_totals_rows("2023-24").unwrap();
        assert_eq!(n, 0);
    }

    #[test]
    fn list_distinct_sources_returns_both_sources() {
        let db = open_test_db();
        setup(&db);
        seed_totals_row(&db, "NBA_P001", "nba_stats", 20);
        seed_totals_row(&db, "NBA_P001", "bref", 21);
        let sources = db.reconcile().list_distinct_sources("2023-24").unwrap();
        assert_eq!(sources, vec!["bref", "nba_stats"]); // lexicographic order
    }

    #[test]
    fn upsert_canonical_creates_row_from_primary_source() {
        let db = open_test_db();
        setup(&db);
        seed_totals_row(&db, "NBA_P001", "nba_stats", 25);
        seed_totals_row(&db, "NBA_P001", "bref", 26);

        let repo = db.reconcile();
        let n = repo.upsert_canonical("2023-24", "nba_stats").unwrap();
        assert_eq!(n, 1);

        let rows = repo.list_canonical("2023-24").unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].primary_source, "nba_stats");
        assert_eq!(rows[0].points, Some(25));
    }

    #[test]
    fn upsert_canonical_is_idempotent() {
        let db = open_test_db();
        setup(&db);
        seed_totals_row(&db, "NBA_P001", "nba_stats", 25);

        let repo = db.reconcile();
        repo.upsert_canonical("2023-24", "nba_stats").unwrap();
        repo.upsert_canonical("2023-24", "nba_stats").unwrap();

        let rows = repo.list_canonical("2023-24").unwrap();
        assert_eq!(rows.len(), 1, "re-run must not duplicate rows");
    }

    #[test]
    fn insert_disagreement_round_trips() {
        let db = open_test_db();
        setup(&db);

        let d = StatDisagreement {
            id: 0,
            player_id: "NBA_P001".to_string(),
            season_id: "2023-24".to_string(),
            season_type: "Regular".to_string(),
            stat_name: "points".to_string(),
            source_a: "bref".to_string(),
            value_a: Some(21.0),
            source_b: "nba_stats".to_string(),
            value_b: Some(25.0),
            delta: Some(4.0),
            recorded_at: None,
        };

        let repo = db.reconcile();
        repo.insert_disagreement(&d).unwrap();

        let rows = repo.list_disagreements("2023-24").unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].stat_name, "points");
        assert_eq!(rows[0].value_a, Some(21.0));
        assert_eq!(rows[0].value_b, Some(25.0));
        assert_eq!(rows[0].delta, Some(4.0));
    }
}
