use std::path::Path;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use metis_db::Db;
use tower::ServiceExt;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn open_test_db() -> Db {
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

fn seed(db: &Db) {
    // Dimensions must be inserted in FK order: season → team → player → game.
    db.seasons()
        .upsert("2023-24", "NBA", 2023)
        .expect("seed season");
    db.teams()
        .upsert(&metis_db::Team {
            id: "NBA_BOS".to_string(),
            league_id: "NBA".to_string(),
            abbreviation: "BOS".to_string(),
            full_name: "Boston Celtics".to_string(),
            city: "Boston".to_string(),
        })
        .expect("seed team BOS");
    db.teams()
        .upsert(&metis_db::Team {
            id: "NBA_LAL".to_string(),
            league_id: "NBA".to_string(),
            abbreviation: "LAL".to_string(),
            full_name: "Los Angeles Lakers".to_string(),
            city: "Los Angeles".to_string(),
        })
        .expect("seed team LAL");
    db.players()
        .upsert(&metis_db::Player {
            id: "NBA_2544".to_string(),
            league_id: "NBA".to_string(),
            first_name: "LeBron".to_string(),
            last_name: "James".to_string(),
            birth_date: Some("1984-12-30".to_string()),
        })
        .expect("seed player");
    db.games()
        .upsert(&metis_db::Game {
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
        })
        .expect("seed game");
}

async fn body_json(body: Body) -> serde_json::Value {
    let bytes = body.collect().await.expect("collect body").to_bytes();
    serde_json::from_slice(&bytes).expect("parse JSON body")
}

fn make_app() -> axum::Router {
    let db = open_test_db();
    seed(&db);
    metis_api::router(db)
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

#[tokio::test]
async fn get_players_200() {
    let app = make_app();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/players")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp.into_body()).await;
    let data = json["data"].as_array().expect("data array");
    assert_eq!(data.len(), 1);
    assert_eq!(data[0]["id"], "NBA_2544");
    assert_eq!(json["coverage"], "full");
    assert_eq!(json["total"], 1);
}

#[tokio::test]
async fn get_players_filter_by_league() {
    let app = make_app();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/players?league_id=NBA")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp.into_body()).await;
    assert_eq!(json["total"], 1);
}

#[tokio::test]
async fn get_players_filter_by_league_no_match() {
    let app = make_app();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/players?league_id=WNBA")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp.into_body()).await;
    assert_eq!(json["total"], 0);
}

#[tokio::test]
async fn get_players_search_matches() {
    let app = make_app();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/players?search=lebron")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp.into_body()).await;
    assert_eq!(json["total"], 1);
}

#[tokio::test]
async fn get_players_search_no_match() {
    let app = make_app();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/players?search=nobody")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp.into_body()).await;
    assert_eq!(json["total"], 0);
}

#[tokio::test]
async fn get_player_by_id_200() {
    let app = make_app();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/players/NBA_2544")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp.into_body()).await;
    assert_eq!(json["data"]["id"], "NBA_2544");
    assert_eq!(json["data"]["first_name"], "LeBron");
    assert_eq!(json["coverage"], "full");
}

#[tokio::test]
async fn get_player_by_id_404() {
    let app = make_app();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/players/NBA_9999")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    let json = body_json(resp.into_body()).await;
    assert_eq!(json["error"], "not_found");
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

#[tokio::test]
async fn get_teams_200() {
    let app = make_app();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/teams")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp.into_body()).await;
    // 2 teams seeded
    assert_eq!(json["total"], 2);
    assert_eq!(json["coverage"], "full");
}

#[tokio::test]
async fn get_teams_filter_by_league() {
    let app = make_app();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/teams?league_id=NBA")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp.into_body()).await;
    assert_eq!(json["total"], 2);
}

#[tokio::test]
async fn get_team_by_id_200() {
    let app = make_app();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/teams/NBA_BOS")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp.into_body()).await;
    assert_eq!(json["data"]["id"], "NBA_BOS");
    assert_eq!(json["data"]["full_name"], "Boston Celtics");
}

#[tokio::test]
async fn get_team_by_id_404() {
    let app = make_app();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/teams/NBA_NOBODY")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    let json = body_json(resp.into_body()).await;
    assert_eq!(json["error"], "not_found");
}

// ---------------------------------------------------------------------------
// Seasons
// ---------------------------------------------------------------------------

#[tokio::test]
async fn get_seasons_200() {
    let app = make_app();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/seasons")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp.into_body()).await;
    assert_eq!(json["total"], 1);
    assert_eq!(json["data"][0]["id"], "2023-24");
    assert_eq!(json["data"][0]["start_year"], 2023);
    assert_eq!(json["coverage"], "full");
}

#[tokio::test]
async fn get_seasons_filter_by_league() {
    let app = make_app();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/seasons?league_id=NBA")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp.into_body()).await;
    assert_eq!(json["total"], 1);
}

#[tokio::test]
async fn get_seasons_filter_no_match() {
    let app = make_app();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/seasons?league_id=WNBA")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp.into_body()).await;
    assert_eq!(json["total"], 0);
}

// ---------------------------------------------------------------------------
// Games
// ---------------------------------------------------------------------------

#[tokio::test]
async fn get_games_200() {
    let app = make_app();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/games")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp.into_body()).await;
    assert_eq!(json["total"], 1);
    assert_eq!(json["coverage"], "full");
    assert_eq!(json["data"][0]["id"], "nba_stats_001");
}

#[tokio::test]
async fn get_games_filter_by_season() {
    let app = make_app();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/games?season_id=2023-24")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp.into_body()).await;
    assert_eq!(json["total"], 1);
}

#[tokio::test]
async fn get_games_filter_by_season_no_match() {
    let app = make_app();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/games?season_id=2022-23")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp.into_body()).await;
    assert_eq!(json["total"], 0);
}

#[tokio::test]
async fn get_games_filter_by_team() {
    let app = make_app();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/games?team_id=NBA_BOS")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp.into_body()).await;
    assert_eq!(json["total"], 1);
}

#[tokio::test]
async fn get_games_filter_by_away_team() {
    let app = make_app();
    // LAL is the away team — should still match
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/games?team_id=NBA_LAL")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp.into_body()).await;
    assert_eq!(json["total"], 1);
}

#[tokio::test]
async fn get_games_filter_combined() {
    let app = make_app();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/games?season_id=2023-24&season_type=Regular")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp.into_body()).await;
    assert_eq!(json["total"], 1);
}

#[tokio::test]
async fn get_game_by_id_200() {
    let app = make_app();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/games/nba_stats_001")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp.into_body()).await;
    assert_eq!(json["data"]["id"], "nba_stats_001");
    assert_eq!(json["data"]["home_score"], 110);
    assert_eq!(json["data"]["away_score"], 105);
}

#[tokio::test]
async fn get_game_by_id_404() {
    let app = make_app();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/games/nba_stats_MISSING")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    let json = body_json(resp.into_body()).await;
    assert_eq!(json["error"], "not_found");
}

// ---------------------------------------------------------------------------
// Player stats (T061)
// ---------------------------------------------------------------------------

fn player_box(
    id: i64,
    game_id: &str,
    player_id: &str,
    team_id: &str,
    season_id: &str,
    points: i16,
    minutes: f64,
) -> metis_db::model::player_game_box::PlayerGameBox {
    metis_db::model::player_game_box::PlayerGameBox {
        id,
        game_id: game_id.to_string(),
        player_id: player_id.to_string(),
        team_id: team_id.to_string(),
        season_id: season_id.to_string(),
        season_type: "Regular".to_string(),
        starter: Some(true),
        minutes_played: Some(minutes),
        points: Some(points),
        rebounds_offensive: Some(1),
        rebounds_defensive: Some(2),
        rebounds_total: Some(3),
        assists: Some(4),
        steals: Some(1),
        blocks: Some(1),
        turnovers: Some(2),
        personal_fouls: Some(2),
        field_goals_made: Some(8),
        field_goals_attempted: Some(16),
        three_pointers_made: Some(2),
        three_pointers_attempted: Some(5),
        free_throws_made: Some(2),
        free_throws_attempted: Some(3),
        plus_minus: Some(5),
        source: "nba_stats".to_string(),
        source_url: "https://example.com".to_string(),
        fetched_at: "2024-01-15T00:00:00Z".to_string(),
        source_payload: "{}".to_string(),
        ingested_at: None,
    }
}

fn seed_player_stats(db: &Db) {
    // Two seasons for the same player: a season-rollup row computed from box
    // scores (2022-23, via compute_player_totals), and box scores for
    // 2023-24 across a home win and an away loss (used to exercise the
    // aggregation path: date range, home/away, win/loss, team filter).
    db.seasons()
        .upsert("2022-23", "NBA", 2022)
        .expect("seed season 2022-23");

    db.games()
        .upsert(&metis_db::Game {
            id: "nba_stats_prior_season".to_string(),
            league_id: "NBA".to_string(),
            season_id: "2022-23".to_string(),
            season_type: "Regular".to_string(),
            game_date: "2023-01-10".to_string(),
            // BOS plays away and loses, so this row does not match the
            // home_away=home or win_loss=win filters used in 2023-24 tests below.
            home_team_id: "NBA_LAL".to_string(),
            away_team_id: "NBA_BOS".to_string(),
            home_score: Some(100),
            away_score: Some(90),
            status: "final".to_string(),
        })
        .expect("seed game prior_season");
    db.player_game_boxes()
        .upsert(&player_box(
            1,
            "nba_stats_prior_season",
            "NBA_2544",
            "NBA_BOS",
            "2022-23",
            30,
            32.0,
        ))
        .expect("seed prior-season box row");
    db.season_rollups()
        .compute_player_totals("2022-23", "nba_stats")
        .expect("compute 2022-23 player totals");

    // Box scores for the home-win / away-loss / date-range aggregation tests.
    db.games()
        .upsert(&metis_db::Game {
            id: "nba_stats_home_win".to_string(),
            league_id: "NBA".to_string(),
            season_id: "2023-24".to_string(),
            season_type: "Regular".to_string(),
            game_date: "2024-01-10".to_string(),
            home_team_id: "NBA_BOS".to_string(),
            away_team_id: "NBA_LAL".to_string(),
            home_score: Some(110),
            away_score: Some(100),
            status: "final".to_string(),
        })
        .expect("seed game home_win");
    db.games()
        .upsert(&metis_db::Game {
            id: "nba_stats_away_loss".to_string(),
            league_id: "NBA".to_string(),
            season_id: "2023-24".to_string(),
            season_type: "Regular".to_string(),
            game_date: "2024-01-20".to_string(),
            home_team_id: "NBA_LAL".to_string(),
            away_team_id: "NBA_BOS".to_string(),
            home_score: Some(120),
            away_score: Some(90),
            status: "final".to_string(),
        })
        .expect("seed game away_loss");

    // LeBron plays for BOS in both games: home win (30 min, 20 pts), away loss
    // (25 min, 10 pts).
    db.player_game_boxes()
        .upsert(&player_box(
            2,
            "nba_stats_home_win",
            "NBA_2544",
            "NBA_BOS",
            "2023-24",
            20,
            30.0,
        ))
        .expect("seed box row home_win");
    db.player_game_boxes()
        .upsert(&player_box(
            3,
            "nba_stats_away_loss",
            "NBA_2544",
            "NBA_BOS",
            "2023-24",
            10,
            25.0,
        ))
        .expect("seed box row away_loss");
    db.season_rollups()
        .compute_player_totals("2023-24", "nba_stats")
        .expect("compute 2023-24 player totals");

    // Populate player_team_season_totals so the team fast path has data to serve.
    db.player_team_season_rollups()
        .compute_for_season("2022-23", "nba_stats")
        .expect("compute 2022-23 player team rollups");
    db.player_team_season_rollups()
        .compute_for_season("2023-24", "nba_stats")
        .expect("compute 2023-24 player team rollups");
}

fn make_app_with_player_stats() -> axum::Router {
    let db = open_test_db();
    seed(&db);
    seed_player_stats(&db);
    metis_api::router(db)
}

#[tokio::test]
async fn get_players_stats_no_filters_default_pagination() {
    let app = make_app_with_player_stats();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/players/stats")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp.into_body()).await;
    assert_eq!(json["page"], 1);
    assert_eq!(json["page_size"], 50);
    assert_eq!(json["total"], 2);
    assert_eq!(json["coverage"], "full");
    let rows = json["rows"].as_array().expect("rows array");
    assert_eq!(rows.len(), 2);
}

#[tokio::test]
async fn get_players_stats_filter_by_season_narrows_results() {
    let app = make_app_with_player_stats();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/players/stats?season_id=2023-24")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp.into_body()).await;
    assert_eq!(json["total"], 1);
    assert_eq!(json["rows"][0]["season_id"], "2023-24");
    // Season totals rollup: 20 pts (home win) + 10 pts (away loss) = 30.
    assert_eq!(json["rows"][0]["points"], 30.0);
}

#[tokio::test]
async fn get_players_stats_per_36_matches_formula() {
    let app = make_app_with_player_stats();
    // team_id filter forces the aggregation path, which is where per-36 is
    // computed from raw player_game_box totals (the season rollup tables
    // don't carry team_id).
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/players/stats?display_mode=per_36&team_id=NBA_BOS&season_id=2023-24")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp.into_body()).await;
    assert_eq!(json["total"], 1);
    let points = json["rows"][0]["points"].as_f64().expect("points present");
    // total points = 30, total minutes = 55 => per-36 = 30 * 36 / 55
    let expected = 30.0 * 36.0 / 55.0;
    assert!((points - expected).abs() < 1e-9);
}

#[tokio::test]
async fn get_players_stats_home_away_filters_to_home_games() {
    let app = make_app_with_player_stats();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/players/stats?home_away=home")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp.into_body()).await;
    assert_eq!(json["total"], 1);
    assert_eq!(json["rows"][0]["games_played"], 1);
    assert_eq!(json["rows"][0]["points"], 20.0);
}

#[tokio::test]
async fn get_players_stats_win_loss_filters_to_wins() {
    let app = make_app_with_player_stats();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/players/stats?win_loss=win")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp.into_body()).await;
    assert_eq!(json["total"], 1);
    assert_eq!(json["rows"][0]["points"], 20.0);
}

#[tokio::test]
async fn get_players_stats_invalid_sort_by_400() {
    let app = make_app_with_player_stats();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/players/stats?sort_by=nonexistent_column")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    let json = body_json(resp.into_body()).await;
    assert_eq!(json["error"], "bad_request");
}

#[tokio::test]
async fn get_players_stats_invalid_display_mode_400() {
    let app = make_app_with_player_stats();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/players/stats?display_mode=nonsense")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn get_players_stats_page_size_clamped_to_max() {
    let app = make_app_with_player_stats();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/players/stats?page_size=500")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp.into_body()).await;
    // page_size above MAX_PAGE_SIZE (200) is clamped, not rejected.
    assert_eq!(json["page_size"], 200);
}

#[tokio::test]
async fn get_players_stats_pagination_returns_one_row_per_page() {
    let app = make_app_with_player_stats();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/players/stats?page_size=1&page=1&sort_by=season_id&sort_dir=asc")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp.into_body()).await;
    assert_eq!(json["total"], 2);
    let rows = json["rows"].as_array().expect("rows array");
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0]["season_id"], "2022-23");
}

// ---------------------------------------------------------------------------
// Coverage marker tests (ADR 008)
// ---------------------------------------------------------------------------

/// Season from 2023 — within all source coverage windows → "full".
#[tokio::test]
async fn player_stats_coverage_full_for_modern_season() {
    let app = make_app_with_player_stats();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/players/stats?season_id=2023-24&source=nba_stats")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp.into_body()).await;
    assert_eq!(json["coverage"], "full");
}

/// Season 1990-91 with source=nba_stats (started 1996) → "partial".
#[tokio::test]
async fn player_stats_coverage_partial_nba_stats_pre_1996() {
    let app = make_app_with_player_stats();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/players/stats?season_id=1990-91&source=nba_stats")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp.into_body()).await;
    assert_eq!(json["coverage"], "partial");
}

/// Season 1975-76 with bref per_36 (bref advanced starts 1979) → "partial".
#[tokio::test]
async fn player_stats_coverage_partial_bref_per36_pre_1979() {
    let app = make_app_with_player_stats();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/players/stats?season_id=1975-76&source=bref&display_mode=per_36")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp.into_body()).await;
    assert_eq!(json["coverage"], "partial");
}

/// Season 1975-76 with bref totals (box scores go back to 1946) → "full".
#[tokio::test]
async fn player_stats_coverage_full_bref_totals_pre_1979() {
    let app = make_app_with_player_stats();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/players/stats?season_id=1975-76&source=bref&display_mode=totals")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp.into_body()).await;
    assert_eq!(json["coverage"], "full");
}

/// No season filter → full coverage (returns whatever data exists).
#[tokio::test]
async fn player_stats_coverage_full_when_no_season_filter() {
    let app = make_app_with_player_stats();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/players/stats")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp.into_body()).await;
    assert_eq!(json["coverage"], "full");
}

// ---------------------------------------------------------------------------
// OpenAPI spec endpoint
// ---------------------------------------------------------------------------

#[tokio::test]
async fn openapi_json_200() {
    let app = make_app();
    let resp = app
        .oneshot(
            Request::builder()
                .uri("/openapi.json")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let json = body_json(resp.into_body()).await;
    // Verify it looks like an OpenAPI document
    assert_eq!(json["info"]["title"], "Metis NBA Stats API");
}
