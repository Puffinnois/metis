use duckdb::Connection;

use crate::error::Result;
use crate::model::player::Player;
use crate::queries;

/// Repository for the `player` dimension table.
///
/// Obtain via [`crate::Db::players`].
///
/// Foreign-key integrity (e.g. `league_id` must exist in `league`) is not enforced
/// by DuckDB at runtime. Callers are responsible for ensuring referenced entities
/// exist before calling `upsert`.
pub struct PlayerRepo<'conn> {
    conn: &'conn Connection,
}

impl<'conn> PlayerRepo<'conn> {
    pub(crate) fn new(conn: &'conn Connection) -> Self {
        Self { conn }
    }

    /// Insert or update a player. On conflict by `id`, updates name fields and `birth_date`.
    pub fn upsert(&self, player: &Player) -> Result<()> {
        queries::player::upsert(self.conn, player)
    }

    /// Returns the player with the given composite `id`, or `None` if not found.
    pub fn find_by_id(&self, id: &str) -> Result<Option<Player>> {
        queries::player::find_by_id(self.conn, id)
    }

    /// Constructs the composite id `{league_id}_{external_id}` and looks up the player.
    ///
    /// For example, `find_by_external_id("NBA", "2544")` finds player `"NBA_2544"`.
    /// `league_id` is the league prefix (e.g. `"NBA"`), not the ingest adapter name.
    pub fn find_by_external_id(
        &self,
        league_id: &str,
        external_id: &str,
    ) -> Result<Option<Player>> {
        let id = format!("{league_id}_{external_id}");
        queries::player::find_by_id(self.conn, &id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helpers::open_test_db;

    fn lebron() -> Player {
        Player {
            id: "NBA_2544".to_string(),
            league_id: "NBA".to_string(),
            first_name: "LeBron".to_string(),
            last_name: "James".to_string(),
            birth_date: Some("1984-12-30".to_string()),
        }
    }

    #[test]
    fn upsert_and_find_by_id() {
        let db = open_test_db();
        let repo = db.players();
        repo.upsert(&lebron()).unwrap();
        let found = repo.find_by_id("NBA_2544").unwrap();
        assert_eq!(found, Some(lebron()));
    }

    #[test]
    fn find_by_id_missing_returns_none() {
        let db = open_test_db();
        let result = db.players().find_by_id("NBA_NOBODY").unwrap();
        assert_eq!(result, None);
    }

    #[test]
    fn upsert_is_idempotent() {
        let db = open_test_db();
        let repo = db.players();
        repo.upsert(&lebron()).unwrap();
        repo.upsert(&lebron()).unwrap();
        let found = repo.find_by_id("NBA_2544").unwrap();
        assert_eq!(found, Some(lebron()));
    }

    #[test]
    fn upsert_updates_on_conflict() {
        let db = open_test_db();
        let repo = db.players();
        repo.upsert(&lebron()).unwrap();
        let updated = Player {
            first_name: "LeBron Updated".to_string(),
            ..lebron()
        };
        repo.upsert(&updated).unwrap();
        let found = repo.find_by_id("NBA_2544").unwrap().unwrap();
        assert_eq!(found.first_name, "LeBron Updated");
    }

    #[test]
    fn find_by_external_id() {
        let db = open_test_db();
        let repo = db.players();
        repo.upsert(&lebron()).unwrap();
        let found = repo.find_by_external_id("NBA", "2544").unwrap();
        assert_eq!(found, Some(lebron()));
    }

    #[test]
    fn find_by_external_id_missing_returns_none() {
        let db = open_test_db();
        let result = db.players().find_by_external_id("NBA", "NOBODY").unwrap();
        assert_eq!(result, None);
    }

    #[test]
    fn upsert_player_with_null_birth_date() {
        let db = open_test_db();
        let repo = db.players();
        let player = Player {
            id: "NBA_9999".to_string(),
            league_id: "NBA".to_string(),
            first_name: "Unknown".to_string(),
            last_name: "Player".to_string(),
            birth_date: None,
        };
        repo.upsert(&player).unwrap();
        let found = repo.find_by_id("NBA_9999").unwrap().unwrap();
        assert_eq!(found.birth_date, None);
    }
}
