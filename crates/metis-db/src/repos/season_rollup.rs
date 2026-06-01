use duckdb::Connection;

/// Repository for season rollup materialized tables.
///
/// Obtain via [`crate::Db::season_rollups`].
/// To be fully implemented in Task 3.
pub struct SeasonRollupRepo<'conn> {
    #[allow(dead_code)]
    conn: &'conn Connection,
}

impl<'conn> SeasonRollupRepo<'conn> {
    pub(crate) fn new(conn: &'conn Connection) -> Self {
        Self { conn }
    }
}
