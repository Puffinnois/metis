use duckdb::Connection;

use crate::error::Result;
use crate::queries;
use crate::queries::reconcile::PlayerSeasonTotalsRow;

/// Repository for the reconciliation layer.
///
/// Exposes read/write access to `player_season_canonical` and
/// `stat_disagreement`. Obtain via [`crate::Db::reconcile`].
pub struct ReconcileRepo<'conn> {
    conn: &'conn Connection,
}

impl<'conn> ReconcileRepo<'conn> {
    pub(crate) fn new(conn: &'conn Connection) -> Self {
        Self { conn }
    }

    /// Load all `player_season_totals` rows for the given season (all sources).
    pub fn load_season_totals(&self, season_id: &str) -> Result<Vec<PlayerSeasonTotalsRow>> {
        queries::reconcile::load_season_totals(self.conn, season_id)
    }

    /// Upsert one row into `player_season_canonical`.
    pub fn upsert_canonical(
        &self,
        row: &PlayerSeasonTotalsRow,
        canonical_source: &str,
    ) -> Result<()> {
        queries::reconcile::upsert_canonical(self.conn, row, canonical_source)
    }

    /// Insert a stat disagreement record.
    #[allow(clippy::too_many_arguments)]
    pub fn insert_disagreement(
        &self,
        player_id: &str,
        season_id: &str,
        season_type: &str,
        stat_name: &str,
        source_a: &str,
        value_a: Option<f64>,
        source_b: &str,
        value_b: Option<f64>,
        pct_diff: Option<f64>,
    ) -> Result<()> {
        queries::reconcile::insert_disagreement(
            self.conn,
            player_id,
            season_id,
            season_type,
            stat_name,
            source_a,
            value_a,
            source_b,
            value_b,
            pct_diff,
        )
    }

    /// Count `player_season_canonical` rows for the given season.
    pub fn count_canonical(&self, season_id: &str) -> Result<u64> {
        queries::reconcile::count_canonical(self.conn, season_id)
    }

    /// Count `stat_disagreement` rows for the given season.
    pub fn count_disagreements(&self, season_id: &str) -> Result<u64> {
        queries::reconcile::count_disagreements(self.conn, season_id)
    }
}
