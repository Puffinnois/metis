use std::path::Path;

use metis_compute::{reconcile_season, ComputeError};
use metis_core::Season;
use metis_db::model::game::Game;
use metis_db::model::player::Player;
use metis_db::model::player_game_box::PlayerGameBox;
use metis_db::model::team::Team;
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
    db.players()
        .upsert(&Player {
            id: "NBA_P002".to_string(),
            league_id: "NBA".to_string(),
            first_name: "Test".to_string(),
            last_name: "Player2".to_string(),
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

fn player_box(game_id: &str, player_id: &str, points: i16, source: &str) -> PlayerGameBox {
    PlayerGameBox {
        id: 0,
        game_id: game_id.to_string(),
        player_id: player_id.to_string(),
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
        source: source.to_string(),
        source_url: "https://example.com/".to_string(),
        fetched_at: "2025-01-10 12:00:00".to_string(),
        source_payload: "{}".to_string(),
        ingested_at: None,
    }
}

fn seed_rollups(db: &Db, source: &str) {
    db.player_game_boxes()
        .upsert(&player_box("G001", "NBA_P001", 28, source))
        .unwrap();
    db.player_game_boxes()
        .upsert(&player_box("G002", "NBA_P001", 22, source))
        .unwrap();
    metis_compute::compute_season_rollups(db, Season(2024), source).unwrap();
}

// ── Error cases ───────────────────────────────────────────────────────────────

#[test]
fn returns_no_rollup_data_error_when_no_totals_rows() {
    let db = open_test_db();
    setup(&db);

    let result = reconcile_season(&db, Season(2024), "nba_stats");
    assert!(
        matches!(result, Err(ComputeError::NoRollupData { .. })),
        "expected NoRollupData, got: {result:?}"
    );
    let err = result.unwrap_err().to_string();
    assert!(
        err.contains("2024-25"),
        "error should name the season: {err}"
    );
    assert!(
        err.contains("--season 2024"),
        "hint should include CLI flag: {err}"
    );
}

// ── Single source (no disagreements) ─────────────────────────────────────────

#[test]
fn canonical_created_from_single_source_no_disagreements() {
    let db = open_test_db();
    setup(&db);
    seed_rollups(&db, "nba_stats");

    let summary = reconcile_season(&db, Season(2024), "nba_stats").unwrap();
    assert_eq!(summary.canonical_rows, 1, "one player → one canonical row");
    assert_eq!(
        summary.disagreement_rows, 0,
        "single source → no disagreements"
    );

    let canonical = db.reconcile().list_canonical("2024-25").unwrap();
    assert_eq!(canonical.len(), 1);
    assert_eq!(canonical[0].primary_source, "nba_stats");
    assert_eq!(canonical[0].points, Some(50)); // 28 + 22
    assert_eq!(canonical[0].games_played, 2);
}

// ── Two sources: canonical picks primary source ───────────────────────────────

#[test]
fn canonical_picks_primary_source_when_two_sources_present() {
    let db = open_test_db();
    setup(&db);

    // Seed nba_stats: 28 + 22 = 50 pts
    seed_rollups(&db, "nba_stats");

    // Seed bref: different box rows for same games (different source)
    // We insert box rows then run rollups for bref
    db.player_game_boxes()
        .upsert(&player_box("G001", "NBA_P001", 29, "bref")) // 1pt higher game 1
        .unwrap();
    db.player_game_boxes()
        .upsert(&player_box("G002", "NBA_P001", 22, "bref"))
        .unwrap();
    metis_compute::compute_season_rollups(&db, Season(2024), "bref").unwrap();

    let summary = reconcile_season(&db, Season(2024), "nba_stats").unwrap();
    assert_eq!(summary.canonical_rows, 1, "one player → one canonical row");

    // Canonical uses nba_stats values (50 pts), not bref (51 pts)
    let canonical = db.reconcile().list_canonical("2024-25").unwrap();
    assert_eq!(canonical[0].primary_source, "nba_stats");
    assert_eq!(canonical[0].points, Some(50));
}

// ── Disagreements logged ──────────────────────────────────────────────────────

#[test]
fn disagreements_are_logged_when_sources_differ() {
    let db = open_test_db();
    setup(&db);

    // nba_stats: P001 = 50 pts
    seed_rollups(&db, "nba_stats");

    // bref: P001 = 51 pts (game 1 has 29 instead of 28)
    db.player_game_boxes()
        .upsert(&player_box("G001", "NBA_P001", 29, "bref"))
        .unwrap();
    db.player_game_boxes()
        .upsert(&player_box("G002", "NBA_P001", 22, "bref"))
        .unwrap();
    metis_compute::compute_season_rollups(&db, Season(2024), "bref").unwrap();

    reconcile_season(&db, Season(2024), "nba_stats").unwrap();

    let disagreements = db.reconcile().list_disagreements("2024-25").unwrap();
    assert!(
        !disagreements.is_empty(),
        "expected disagreements to be logged"
    );

    let points_d = disagreements
        .iter()
        .find(|d| d.stat_name == "points")
        .expect("expected a points disagreement");

    // Sources stored in lexicographic order: "bref" < "nba_stats"
    assert_eq!(points_d.source_a, "bref");
    assert_eq!(points_d.value_a, Some(51.0)); // bref total
    assert_eq!(points_d.source_b, "nba_stats");
    assert_eq!(points_d.value_b, Some(50.0)); // nba_stats total
    assert_eq!(points_d.delta, Some(1.0));
}

// ── Idempotency ───────────────────────────────────────────────────────────────

#[test]
fn reconcile_is_idempotent() {
    let db = open_test_db();
    setup(&db);
    seed_rollups(&db, "nba_stats");

    let s1 = reconcile_season(&db, Season(2024), "nba_stats").unwrap();
    let s2 = reconcile_season(&db, Season(2024), "nba_stats").unwrap();

    assert_eq!(s1, s2, "re-run must produce same summary");

    let canonical = db.reconcile().list_canonical("2024-25").unwrap();
    assert_eq!(
        canonical.len(),
        1,
        "re-run must not duplicate canonical rows"
    );
}

#[test]
fn reconcile_is_idempotent_with_disagreements() {
    let db = open_test_db();
    setup(&db);
    seed_rollups(&db, "nba_stats");

    db.player_game_boxes()
        .upsert(&player_box("G001", "NBA_P001", 30, "bref"))
        .unwrap();
    db.player_game_boxes()
        .upsert(&player_box("G002", "NBA_P001", 22, "bref"))
        .unwrap();
    metis_compute::compute_season_rollups(&db, Season(2024), "bref").unwrap();

    reconcile_season(&db, Season(2024), "nba_stats").unwrap();
    reconcile_season(&db, Season(2024), "nba_stats").unwrap();

    let disagreements = db.reconcile().list_disagreements("2024-25").unwrap();
    let canonical = db.reconcile().list_canonical("2024-25").unwrap();

    // No duplicates from repeated runs
    assert_eq!(canonical.len(), 1);
    let points_count = disagreements
        .iter()
        .filter(|d| d.stat_name == "points")
        .count();
    assert_eq!(points_count, 1, "must not duplicate disagreement rows");
}

// ── Summary return value ──────────────────────────────────────────────────────

#[test]
fn reconcile_summary_counts_are_correct() {
    let db = open_test_db();
    setup(&db);
    seed_rollups(&db, "nba_stats");

    // Add second player from same source to verify multi-player count
    db.player_game_boxes()
        .upsert(&player_box("G001", "NBA_P002", 15, "nba_stats"))
        .unwrap();
    metis_compute::compute_season_rollups(&db, Season(2024), "nba_stats").unwrap();

    let summary = reconcile_season(&db, Season(2024), "nba_stats").unwrap();
    assert_eq!(
        summary.canonical_rows, 2,
        "two players → two canonical rows"
    );
    assert_eq!(
        summary.disagreement_rows, 0,
        "single source → no disagreements"
    );
}
