use std::path::Path;

use crate::Db;

pub(crate) fn open_test_db() -> Db {
    let migrations = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("sql/migrations");
    let db = Db::open_with_migrations(":memory:", migrations).expect("open in-memory db");
    db.migrate().expect("migrate");
    db
}

pub(crate) fn insert_team(db: &Db, id: &str, league_id: &str) {
    db.teams()
        .upsert(&crate::model::team::Team {
            id: id.to_string(),
            league_id: league_id.to_string(),
            abbreviation: id.split('_').last().unwrap_or(id).to_string(),
            full_name: id.to_string(),
            city: "Test City".to_string(),
        })
        .expect("insert test team");
}

pub(crate) fn insert_player(db: &Db, id: &str, league_id: &str) {
    db.players()
        .upsert(&crate::model::player::Player {
            id: id.to_string(),
            league_id: league_id.to_string(),
            first_name: "Test".to_string(),
            last_name: "Player".to_string(),
            birth_date: None,
        })
        .expect("insert test player");
}

pub(crate) fn insert_season(db: &Db, season_id: &str, league_id: &str) {
    let parts: Vec<&str> = season_id.split('-').collect();
    let start_year: i16 = parts[0].parse().expect("valid start year");
    db.raw_conn()
        .execute(
            "INSERT INTO season (id, league_id, start_year, end_year)
             VALUES (?, ?, ?, ?)
             ON CONFLICT (id) DO NOTHING",
            duckdb::params![season_id, league_id, start_year, start_year + 1],
        )
        .expect("insert test season");
}

pub(crate) fn insert_game(
    db: &Db,
    game_id: &str,
    league_id: &str,
    season_id: &str,
    home_team_id: &str,
    away_team_id: &str,
) {
    db.games()
        .upsert(&crate::model::game::Game {
            id: game_id.to_string(),
            league_id: league_id.to_string(),
            season_id: season_id.to_string(),
            season_type: "Regular".to_string(),
            game_date: "2024-01-15".to_string(),
            home_team_id: home_team_id.to_string(),
            away_team_id: away_team_id.to_string(),
            home_score: None,
            away_score: None,
            status: "scheduled".to_string(),
        })
        .expect("insert test game");
}
