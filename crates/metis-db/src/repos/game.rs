use duckdb::Connection;
use metis_core::Season;

use crate::error::Result;
use crate::model::game::Game;
use crate::queries;

/// Repository for the `game` dimension table.
///
/// Obtain via [`crate::Db::games`].
///
/// Foreign-key integrity (`league_id`, `season_id`, `home_team_id`, `away_team_id`)
/// is not enforced by DuckDB at runtime. Callers must ensure referenced entities exist.
pub struct GameRepo<'conn> {
    conn: &'conn Connection,
}

impl<'conn> GameRepo<'conn> {
    pub(crate) fn new(conn: &'conn Connection) -> Self {
        Self { conn }
    }

    /// Insert or update a game. On conflict by `id`, updates scores, status, and season type.
    pub fn upsert(&self, game: &Game) -> Result<()> {
        queries::game::upsert(self.conn, game)
    }

    /// Returns the game with the given `id`, or `None` if not found.
    pub fn find_by_id(&self, id: &str) -> Result<Option<Game>> {
        queries::game::find_by_id(self.conn, id)
    }

    /// Constructs the composite id `{source}_{external_id}` and looks up the game.
    ///
    /// For example, `find_by_external_id("nba_stats", "0022300001")` finds game
    /// `"nba_stats_0022300001"`. The id format must match what was used in `upsert`.
    pub fn find_by_external_id(&self, source: &str, external_id: &str) -> Result<Option<Game>> {
        let id = format!("{source}_{external_id}");
        queries::game::find_by_id(self.conn, &id)
    }

    /// Returns all games in the given season, ordered by date then id.
    pub fn list_by_season(&self, season: Season) -> Result<Vec<Game>> {
        queries::game::list_by_season(self.conn, &season.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helpers::{insert_season, insert_team, open_test_db};

    fn game() -> Game {
        Game {
            id: "nba_stats_001".to_string(),
            league_id: "NBA".to_string(),
            season_id: "2023-24".to_string(),
            season_type: "Regular".to_string(),
            game_date: "2024-01-15".to_string(),
            home_team_id: "NBA_BOS".to_string(),
            away_team_id: "NBA_LAL".to_string(),
            home_score: Some(110),
            away_score: Some(105),
            status: "final".to_string(),
        }
    }

    fn setup(db: &crate::Db) {
        insert_team(db, "NBA_BOS", "NBA");
        insert_team(db, "NBA_LAL", "NBA");
        insert_season(db, "2023-24", "NBA");
    }

    #[test]
    fn upsert_and_find_by_id() {
        let db = open_test_db();
        setup(&db);
        let repo = db.games();
        repo.upsert(&game()).unwrap();
        let found = repo.find_by_id("nba_stats_001").unwrap();
        assert_eq!(found, Some(game()));
    }

    #[test]
    fn find_by_id_missing_returns_none() {
        let db = open_test_db();
        let result = db.games().find_by_id("nba_stats_MISSING").unwrap();
        assert_eq!(result, None);
    }

    #[test]
    fn upsert_is_idempotent() {
        let db = open_test_db();
        setup(&db);
        let repo = db.games();
        repo.upsert(&game()).unwrap();
        repo.upsert(&game()).unwrap();
        let found = repo.find_by_id("nba_stats_001").unwrap();
        assert_eq!(found, Some(game()));
    }

    #[test]
    fn upsert_updates_scores_on_conflict() {
        let db = open_test_db();
        setup(&db);
        let repo = db.games();
        repo.upsert(&game()).unwrap();
        let updated = Game {
            home_score: Some(120),
            away_score: Some(115),
            ..game()
        };
        repo.upsert(&updated).unwrap();
        let found = repo.find_by_id("nba_stats_001").unwrap().unwrap();
        assert_eq!(found.home_score, Some(120));
        assert_eq!(found.away_score, Some(115));
    }

    #[test]
    fn find_by_external_id() {
        let db = open_test_db();
        setup(&db);
        let repo = db.games();
        let g = Game {
            id: "nba_stats_0022300001".to_string(),
            ..game()
        };
        repo.upsert(&g).unwrap();
        let found = repo.find_by_external_id("nba_stats", "0022300001").unwrap();
        assert_eq!(found.unwrap().id, "nba_stats_0022300001");
    }

    #[test]
    fn list_by_season_returns_all_games() {
        let db = open_test_db();
        setup(&db);
        let repo = db.games();
        repo.upsert(&game()).unwrap();
        let g2 = Game {
            id: "nba_stats_002".to_string(),
            game_date: "2024-01-16".to_string(),
            ..game()
        };
        repo.upsert(&g2).unwrap();

        let games = repo.list_by_season(Season(2023)).unwrap();
        assert_eq!(games.len(), 2);
        assert_eq!(games[0].id, "nba_stats_001");
        assert_eq!(games[1].id, "nba_stats_002");
    }

    #[test]
    fn list_by_season_empty_when_no_games() {
        let db = open_test_db();
        let games = db.games().list_by_season(Season(2020)).unwrap();
        assert!(games.is_empty());
    }
}
