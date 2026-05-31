use duckdb::Connection;

use crate::error::Result;
use crate::model::team::Team;
use crate::queries;

/// Repository for the `team` dimension table.
///
/// Obtain via [`crate::Db::teams`].
///
/// Foreign-key integrity (e.g. `league_id` must exist in `league`) is not enforced
/// by DuckDB at runtime. Callers are responsible for ensuring referenced entities
/// exist before calling `upsert`.
pub struct TeamRepo<'conn> {
    conn: &'conn Connection,
}

impl<'conn> TeamRepo<'conn> {
    pub(crate) fn new(conn: &'conn Connection) -> Self {
        Self { conn }
    }

    /// Insert or update a team. On conflict by `id`, updates name fields and abbreviation.
    pub fn upsert(&self, team: &Team) -> Result<()> {
        queries::team::upsert(self.conn, team)
    }

    /// Returns the team with the given composite `id`, or `None` if not found.
    pub fn find_by_id(&self, id: &str) -> Result<Option<Team>> {
        queries::team::find_by_id(self.conn, id)
    }

    /// Constructs the composite id `{league_id}_{external_id}` and looks up the team.
    ///
    /// For example, `find_by_external_id("NBA", "BOS")` finds team `"NBA_BOS"`.
    /// `league_id` is the league prefix (e.g. `"NBA"`), not the ingest adapter name.
    pub fn find_by_external_id(&self, league_id: &str, external_id: &str) -> Result<Option<Team>> {
        let id = format!("{league_id}_{external_id}");
        queries::team::find_by_id(self.conn, &id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helpers::open_test_db;

    fn celtics() -> Team {
        Team {
            id: "NBA_BOS".to_string(),
            league_id: "NBA".to_string(),
            abbreviation: "BOS".to_string(),
            full_name: "Boston Celtics".to_string(),
            city: "Boston".to_string(),
        }
    }

    #[test]
    fn upsert_and_find_by_id() {
        let db = open_test_db();
        let repo = db.teams();
        repo.upsert(&celtics()).unwrap();
        let found = repo.find_by_id("NBA_BOS").unwrap();
        assert_eq!(found, Some(celtics()));
    }

    #[test]
    fn find_by_id_missing_returns_none() {
        let db = open_test_db();
        let result = db.teams().find_by_id("NBA_NOBODY").unwrap();
        assert_eq!(result, None);
    }

    #[test]
    fn upsert_is_idempotent() {
        let db = open_test_db();
        let repo = db.teams();
        repo.upsert(&celtics()).unwrap();
        repo.upsert(&celtics()).unwrap();
        let found = repo.find_by_id("NBA_BOS").unwrap();
        assert_eq!(found, Some(celtics()));
    }

    #[test]
    fn upsert_updates_on_conflict() {
        let db = open_test_db();
        let repo = db.teams();
        repo.upsert(&celtics()).unwrap();
        let updated = Team {
            city: "Cambridge".to_string(),
            ..celtics()
        };
        repo.upsert(&updated).unwrap();
        let found = repo.find_by_id("NBA_BOS").unwrap().unwrap();
        assert_eq!(found.city, "Cambridge");
    }

    #[test]
    fn find_by_external_id() {
        let db = open_test_db();
        let repo = db.teams();
        repo.upsert(&celtics()).unwrap();
        let found = repo.find_by_external_id("NBA", "BOS").unwrap();
        assert_eq!(found, Some(celtics()));
    }

    #[test]
    fn find_by_external_id_missing_returns_none() {
        let db = open_test_db();
        let result = db.teams().find_by_external_id("NBA", "NOBODY").unwrap();
        assert_eq!(result, None);
    }
}
