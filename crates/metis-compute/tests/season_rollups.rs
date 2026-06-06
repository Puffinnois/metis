use std::path::Path;

use metis_compute::{compute_season_rollups, ComputeError};
use metis_core::Season;
use metis_db::model::game::Game;
use metis_db::model::player::Player;
use metis_db::model::player_game_box::PlayerGameBox;
use metis_db::model::team::Team;
use metis_db::model::team_game_box::TeamGameBox;
use metis_db::Db;

fn open_test_db() -> Db {
    let migrations = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("sql/migrations");
    let db = Db::open_with_migrations(":memory:", &migrations).expect("open test db");
    db.migrate().expect("migrate");
    db
}

fn setup(db: &Db) {
    db.teams()
        .upsert(&Team {
            id: "NBA_LAL".to_string(),
            league_id: "NBA".to_string(),
            abbreviation: "LAL".to_string(),
            full_name: "Los Angeles Lakers".to_string(),
            city: "Los Angeles".to_string(),
        })
        .unwrap();
    db.teams()
        .upsert(&Team {
            id: "NBA_BOS".to_string(),
            league_id: "NBA".to_string(),
            abbreviation: "BOS".to_string(),
            full_name: "Boston Celtics".to_string(),
            city: "Boston".to_string(),
        })
        .unwrap();
    db.players()
        .upsert(&Player {
            id: "NBA_P001".to_string(),
            league_id: "NBA".to_string(),
            first_name: "Test".to_string(),
            last_name: "Player".to_string(),
            birth_date: None,
        })
        .unwrap();
    db.seasons().upsert("2024-25", "NBA", 2024).unwrap();
    db.games()
        .upsert(&Game {
            id: "G001".to_string(),
            league_id: "NBA".to_string(),
            season_id: "2024-25".to_string(),
            season_type: "Regular".to_string(),
            game_date: "2025-01-10".to_string(),
            home_team_id: "NBA_LAL".to_string(),
            away_team_id: "NBA_BOS".to_string(),
            home_score: Some(110),
            away_score: Some(105),
            status: "final".to_string(),
        })
        .unwrap();
    db.games()
        .upsert(&Game {
            id: "G002".to_string(),
            league_id: "NBA".to_string(),
            season_id: "2024-25".to_string(),
            season_type: "Regular".to_string(),
            game_date: "2025-01-12".to_string(),
            home_team_id: "NBA_LAL".to_string(),
            away_team_id: "NBA_BOS".to_string(),
            home_score: Some(108),
            away_score: Some(100),
            status: "final".to_string(),
        })
        .unwrap();
}

fn player_box(game_id: &str, points: i16) -> PlayerGameBox {
    PlayerGameBox {
        id: 0,
        game_id: game_id.to_string(),
        player_id: "NBA_P001".to_string(),
        team_id: "NBA_LAL".to_string(),
        season_id: "2024-25".to_string(),
        season_type: "Regular".to_string(),
        starter: Some(true),
        minutes_played: Some(36.0),
        points: Some(points),
        rebounds_offensive: Some(1),
        rebounds_defensive: Some(5),
        rebounds_total: Some(6),
        assists: Some(4),
        steals: Some(1),
        blocks: Some(0),
        turnovers: Some(2),
        personal_fouls: Some(2),
        field_goals_made: Some(5),
        field_goals_attempted: Some(12),
        three_pointers_made: Some(1),
        three_pointers_attempted: Some(3),
        free_throws_made: Some(2),
        free_throws_attempted: Some(3),
        plus_minus: Some(4),
        source: "nba_stats".to_string(),
        source_url: "https://stats.nba.com/".to_string(),
        fetched_at: "2025-01-10 12:00:00".to_string(),
        source_payload: "{}".to_string(),
        ingested_at: None,
    }
}

fn team_box(game_id: &str, points: i16) -> TeamGameBox {
    TeamGameBox {
        id: 0,
        game_id: game_id.to_string(),
        team_id: "NBA_LAL".to_string(),
        opponent_team_id: "NBA_BOS".to_string(),
        season_id: "2024-25".to_string(),
        season_type: "Regular".to_string(),
        is_home: true,
        points: Some(points),
        rebounds_offensive: Some(8),
        rebounds_defensive: Some(35),
        rebounds_total: Some(43),
        assists: Some(25),
        steals: Some(7),
        blocks: Some(4),
        turnovers: Some(13),
        personal_fouls: Some(20),
        field_goals_made: Some(42),
        field_goals_attempted: Some(88),
        three_pointers_made: Some(12),
        three_pointers_attempted: Some(35),
        free_throws_made: Some(10),
        free_throws_attempted: Some(14),
        fast_break_points: Some(15),
        points_in_paint: Some(44),
        second_chance_points: Some(10),
        bench_points: Some(30),
        source: "nba_stats".to_string(),
        source_url: "https://stats.nba.com/".to_string(),
        fetched_at: "2025-01-10 12:00:00".to_string(),
        source_payload: "{}".to_string(),
        ingested_at: None,
    }
}

#[test]
fn returns_no_source_data_error_when_no_box_rows() {
    let db = open_test_db();
    setup(&db);
    let result = compute_season_rollups(&db, Season(2024), "nba_stats");
    assert!(
        matches!(result, Err(ComputeError::NoSourceData { .. })),
        "expected NoSourceData, got: {result:?}"
    );
    let err = result.unwrap_err().to_string();
    assert!(
        err.contains("season=2024-25"),
        "error should name the season: {err}"
    );
    assert!(
        err.contains("source=nba_stats"),
        "error should name the source: {err}"
    );
    assert!(
        err.contains("--season 2024"),
        "hint should include CLI flag: {err}"
    );
}

#[test]
fn returns_correct_rollup_summary() {
    let db = open_test_db();
    setup(&db);
    db.player_game_boxes()
        .upsert(&player_box("G001", 28))
        .unwrap();
    db.player_game_boxes()
        .upsert(&player_box("G002", 22))
        .unwrap();
    db.team_game_boxes().upsert(&team_box("G001", 110)).unwrap();
    db.team_game_boxes().upsert(&team_box("G002", 108)).unwrap();

    let summary = compute_season_rollups(&db, Season(2024), "nba_stats").unwrap();
    assert_eq!(summary.player_rows, 1, "one player → one totals row");
    assert_eq!(summary.team_rows, 1, "one team → one totals row");
}

#[test]
fn rollup_is_idempotent() {
    let db = open_test_db();
    setup(&db);
    db.player_game_boxes()
        .upsert(&player_box("G001", 28))
        .unwrap();
    db.team_game_boxes().upsert(&team_box("G001", 110)).unwrap();

    compute_season_rollups(&db, Season(2024), "nba_stats").unwrap();
    let summary = compute_season_rollups(&db, Season(2024), "nba_stats").unwrap();
    assert_eq!(summary.player_rows, 1);
    assert_eq!(summary.team_rows, 1);
}

#[test]
fn player_totals_and_per_game_values_are_correct() {
    let db = open_test_db();
    setup(&db);
    // P001: 28 + 22 = 50 pts over 2 games → 25.0 ppg
    db.player_game_boxes()
        .upsert(&player_box("G001", 28))
        .unwrap();
    db.player_game_boxes()
        .upsert(&player_box("G002", 22))
        .unwrap();
    db.team_game_boxes().upsert(&team_box("G001", 110)).unwrap();

    compute_season_rollups(&db, Season(2024), "nba_stats").unwrap();

    let totals = db
        .season_rollups()
        .list_player_totals("2024-25", "nba_stats")
        .unwrap();
    assert_eq!(totals[0].points, Some(50));
    assert_eq!(totals[0].games_played, 2);

    let pg = db
        .season_rollups()
        .list_player_per_game("2024-25", "nba_stats")
        .unwrap();
    assert_eq!(pg[0].points, Some(25.0));
}
