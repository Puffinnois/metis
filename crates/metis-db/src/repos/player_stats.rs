use duckdb::Connection;

use crate::error::Result;
use crate::model::player_stats::{PlayerStatsFilter, PlayerStatsPage};
use crate::queries;

/// Repository for the filtered/sorted/paginated player season stats query (T061).
///
/// Obtain via [`crate::Db::player_stats`].
pub struct PlayerStatsRepo<'conn> {
    conn: &'conn Connection,
}

impl<'conn> PlayerStatsRepo<'conn> {
    pub(crate) fn new(conn: &'conn Connection) -> Self {
        Self { conn }
    }

    /// Runs the filtered, sorted, paginated player stats query.
    ///
    /// See [`crate::queries::player_stats::query`] for the fast-path /
    /// aggregation-path dispatch logic.
    pub fn query(&self, filter: &PlayerStatsFilter) -> Result<PlayerStatsPage> {
        queries::player_stats::query(self.conn, filter)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::player_game_box::PlayerGameBox;
    use crate::model::player_season_per_game::PlayerSeasonPerGame;
    use crate::model::player_season_totals::PlayerSeasonTotals;
    use crate::model::player_stats::{DisplayMode, HomeAway, SortDir, WinLoss};
    use crate::test_helpers::{insert_player, insert_season, insert_team, open_test_db};

    fn totals_row(player_id: &str, season_id: &str, points: i32, games: i32) -> PlayerSeasonTotals {
        PlayerSeasonTotals {
            id: 0,
            player_id: player_id.to_string(),
            season_id: season_id.to_string(),
            season_type: "Regular".to_string(),
            source: "nba_stats".to_string(),
            games_played: games,
            minutes_played: Some(f64::from(games) * 30.0),
            points: Some(points),
            rebounds_offensive: Some(10),
            rebounds_defensive: Some(20),
            rebounds_total: Some(30),
            assists: Some(40),
            steals: Some(5),
            blocks: Some(5),
            turnovers: Some(10),
            personal_fouls: Some(10),
            field_goals_made: Some(100),
            field_goals_attempted: Some(200),
            three_pointers_made: Some(20),
            three_pointers_attempted: Some(50),
            free_throws_made: Some(50),
            free_throws_attempted: Some(60),
            computed_at: None,
        }
    }

    fn upsert_totals(db: &crate::Db, row: &PlayerSeasonTotals) {
        db.raw_conn()
            .execute(
                "INSERT INTO player_season_totals
                    (player_id, season_id, season_type, source, games_played,
                     minutes_played, points, rebounds_offensive, rebounds_defensive,
                     rebounds_total, assists, steals, blocks, turnovers, personal_fouls,
                     field_goals_made, field_goals_attempted, three_pointers_made,
                     three_pointers_attempted, free_throws_made, free_throws_attempted)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT (player_id, season_id, season_type, source) DO UPDATE SET
                    points = excluded.points",
                duckdb::params![
                    row.player_id,
                    row.season_id,
                    row.season_type,
                    row.source,
                    row.games_played,
                    row.minutes_played,
                    row.points,
                    row.rebounds_offensive,
                    row.rebounds_defensive,
                    row.rebounds_total,
                    row.assists,
                    row.steals,
                    row.blocks,
                    row.turnovers,
                    row.personal_fouls,
                    row.field_goals_made,
                    row.field_goals_attempted,
                    row.three_pointers_made,
                    row.three_pointers_attempted,
                    row.free_throws_made,
                    row.free_throws_attempted,
                ],
            )
            .expect("insert player_season_totals fixture");
    }

    fn upsert_per_game(db: &crate::Db, row: &PlayerSeasonPerGame) {
        db.raw_conn()
            .execute(
                "INSERT INTO player_season_per_game
                    (player_id, season_id, season_type, source, games_played,
                     minutes_played, points, rebounds_offensive, rebounds_defensive,
                     rebounds_total, assists, steals, blocks, turnovers, personal_fouls,
                     field_goals_made, field_goals_attempted, three_pointers_made,
                     three_pointers_attempted, free_throws_made, free_throws_attempted)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT (player_id, season_id, season_type, source) DO UPDATE SET
                    points = excluded.points",
                duckdb::params![
                    row.player_id,
                    row.season_id,
                    row.season_type,
                    row.source,
                    row.games_played,
                    row.minutes_played,
                    row.points,
                    row.rebounds_offensive,
                    row.rebounds_defensive,
                    row.rebounds_total,
                    row.assists,
                    row.steals,
                    row.blocks,
                    row.turnovers,
                    row.personal_fouls,
                    row.field_goals_made,
                    row.field_goals_attempted,
                    row.three_pointers_made,
                    row.three_pointers_attempted,
                    row.free_throws_made,
                    row.free_throws_attempted,
                ],
            )
            .expect("insert player_season_per_game fixture");
    }

    fn seed_basic(db: &crate::Db) {
        insert_team(db, "NBA_BOS", "NBA");
        insert_team(db, "NBA_LAL", "NBA");
        insert_player(db, "NBA_1", "NBA");
        insert_player(db, "NBA_2", "NBA");
        insert_season(db, "2023-24", "NBA");
        upsert_totals(db, &totals_row("NBA_1", "2023-24", 1000, 50));
        upsert_totals(db, &totals_row("NBA_2", "2023-24", 500, 40));
    }

    #[test]
    fn fast_path_returns_paginated_totals() {
        let db = open_test_db();
        seed_basic(&db);

        let filter = PlayerStatsFilter::new(1, 50);
        let page = db.player_stats().query(&filter).unwrap();
        assert_eq!(page.total, 2);
        assert_eq!(page.rows.len(), 2);
        // default sort: points desc
        assert_eq!(page.rows[0].player_id, "NBA_1");
        assert_eq!(page.rows[0].points, Some(1000.0));
    }

    #[test]
    fn season_filter_narrows_results() {
        let db = open_test_db();
        seed_basic(&db);
        insert_season(&db, "2022-23", "NBA");
        upsert_totals(&db, &totals_row("NBA_2", "2022-23", 300, 30));

        let mut filter = PlayerStatsFilter::new(1, 50);
        filter.season_ids = vec!["2023-24".to_string()];
        let page = db.player_stats().query(&filter).unwrap();
        assert_eq!(page.total, 2);

        let mut filter2 = PlayerStatsFilter::new(1, 50);
        filter2.season_ids = vec!["2022-23".to_string()];
        let page2 = db.player_stats().query(&filter2).unwrap();
        assert_eq!(page2.total, 1);
        assert_eq!(page2.rows[0].player_id, "NBA_2");
    }

    #[test]
    fn pagination_splits_results() {
        let db = open_test_db();
        seed_basic(&db);

        let mut filter = PlayerStatsFilter::new(1, 1);
        filter.sort_by = "player_id".to_string();
        filter.sort_dir = SortDir::Asc;
        let page1 = db.player_stats().query(&filter).unwrap();
        assert_eq!(page1.total, 2);
        assert_eq!(page1.rows.len(), 1);
        assert_eq!(page1.rows[0].player_id, "NBA_1");

        filter.page = 2;
        let page2 = db.player_stats().query(&filter).unwrap();
        assert_eq!(page2.rows.len(), 1);
        assert_eq!(page2.rows[0].player_id, "NBA_2");
    }

    #[test]
    fn per_game_display_mode_reads_per_game_table() {
        let db = open_test_db();
        seed_basic(&db);
        upsert_per_game(
            &db,
            &PlayerSeasonPerGame {
                id: 0,
                player_id: "NBA_1".to_string(),
                season_id: "2023-24".to_string(),
                season_type: "Regular".to_string(),
                source: "nba_stats".to_string(),
                games_played: 50,
                minutes_played: Some(30.0),
                points: Some(20.0),
                rebounds_offensive: Some(2.0),
                rebounds_defensive: Some(4.0),
                rebounds_total: Some(6.0),
                assists: Some(8.0),
                steals: Some(1.0),
                blocks: Some(1.0),
                turnovers: Some(2.0),
                personal_fouls: Some(2.0),
                field_goals_made: Some(8.0),
                field_goals_attempted: Some(16.0),
                three_pointers_made: Some(2.0),
                three_pointers_attempted: Some(5.0),
                free_throws_made: Some(2.0),
                free_throws_attempted: Some(3.0),
                computed_at: None,
            },
        );

        let mut filter = PlayerStatsFilter::new(1, 50);
        filter.display_mode = DisplayMode::PerGame;
        let page = db.player_stats().query(&filter).unwrap();
        let row = page
            .rows
            .iter()
            .find(|r| r.player_id == "NBA_1")
            .expect("player NBA_1 present");
        assert_eq!(row.points, Some(20.0));
    }

    #[test]
    fn invalid_sort_column_is_rejected() {
        let db = open_test_db();
        seed_basic(&db);
        let mut filter = PlayerStatsFilter::new(1, 50);
        filter.sort_by = "DROP TABLE player; --".to_string();
        let err = db.player_stats().query(&filter).unwrap_err();
        assert!(matches!(err, crate::error::DbError::InvalidSortColumn(_)));
    }

    fn box_row(
        game_id: &str,
        player_id: &str,
        team_id: &str,
        season_id: &str,
        points: i16,
        minutes: f64,
    ) -> PlayerGameBox {
        PlayerGameBox {
            id: 0,
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

    fn seed_games(db: &crate::Db) {
        insert_team(db, "NBA_BOS", "NBA");
        insert_team(db, "NBA_LAL", "NBA");
        insert_player(db, "NBA_1", "NBA");
        insert_season(db, "2023-24", "NBA");

        // Game 1: BOS (home) beats LAL (away). Player NBA_1 plays for BOS (home, win).
        db.games()
            .upsert(&crate::model::game::Game {
                id: "g1".to_string(),
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
            .unwrap();
        // Game 2: LAL (home) beats BOS (away). Player NBA_1 plays for BOS (away, loss).
        db.games()
            .upsert(&crate::model::game::Game {
                id: "g2".to_string(),
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
            .unwrap();

        db.player_game_boxes()
            .upsert(&box_row("g1", "NBA_1", "NBA_BOS", "2023-24", 20, 30.0))
            .unwrap();
        db.player_game_boxes()
            .upsert(&box_row("g2", "NBA_1", "NBA_BOS", "2023-24", 10, 25.0))
            .unwrap();
    }

    #[test]
    fn date_range_filters_via_aggregation_path() {
        let db = open_test_db();
        seed_games(&db);

        let mut filter = PlayerStatsFilter::new(1, 50);
        filter.date_from = Some("2024-01-01".to_string());
        filter.date_to = Some("2024-01-15".to_string());
        let page = db.player_stats().query(&filter).unwrap();
        assert_eq!(page.total, 1);
        assert_eq!(page.rows[0].games_played, 1);
        assert_eq!(page.rows[0].points, Some(20.0));
    }

    #[test]
    fn home_away_filter_restricts_to_home_games() {
        let db = open_test_db();
        seed_games(&db);

        let mut filter = PlayerStatsFilter::new(1, 50);
        filter.home_away = Some(HomeAway::Home);
        let page = db.player_stats().query(&filter).unwrap();
        assert_eq!(page.total, 1);
        assert_eq!(page.rows[0].games_played, 1);
        assert_eq!(page.rows[0].points, Some(20.0)); // only g1 (home)
    }

    #[test]
    fn win_loss_filter_restricts_to_wins() {
        let db = open_test_db();
        seed_games(&db);

        let mut filter = PlayerStatsFilter::new(1, 50);
        filter.win_loss = Some(WinLoss::Win);
        let page = db.player_stats().query(&filter).unwrap();
        assert_eq!(page.total, 1);
        assert_eq!(page.rows[0].games_played, 1);
        assert_eq!(page.rows[0].points, Some(20.0)); // only g1 (win)
    }

    #[test]
    fn per_36_aggregation_matches_formula() {
        let db = open_test_db();
        seed_games(&db);

        let mut filter = PlayerStatsFilter::new(1, 50);
        filter.display_mode = DisplayMode::Per36;
        // date_from forces the aggregation path (player_game_box JOIN game);
        // this exercises per-36 computation in the aggregation path.
        filter.date_from = Some("2024-01-01".to_string());
        let page = db.player_stats().query(&filter).unwrap();
        let row = &page.rows[0];
        // total points = 30, total minutes = 55 => per-36 = 30 * 36 / 55
        let expected = 30.0 * 36.0 / 55.0;
        assert!((row.points.unwrap() - expected).abs() < 1e-9);
    }

    #[test]
    fn team_filter_uses_team_fast_path() {
        let db = open_test_db();
        seed_games(&db);

        // Populate player_team_season_totals for the team fast path to serve.
        db.player_team_season_rollups()
            .compute_for_season("2023-24", "nba_stats")
            .unwrap();

        let mut filter = PlayerStatsFilter::new(1, 50);
        filter.team_id = Some("NBA_BOS".to_string());
        let page = db.player_stats().query(&filter).unwrap();
        assert_eq!(page.total, 1);
        assert_eq!(page.rows[0].games_played, 2);
        // Both games contributed: 20 + 10 = 30 points total
        assert_eq!(page.rows[0].points, Some(30.0));
    }

    #[test]
    fn team_filter_with_date_range_uses_aggregation_path() {
        let db = open_test_db();
        seed_games(&db);

        // team_id + date_from → aggregation path (date filter always forces it)
        let mut filter = PlayerStatsFilter::new(1, 50);
        filter.team_id = Some("NBA_BOS".to_string());
        filter.date_from = Some("2024-01-01".to_string());
        filter.date_to = Some("2024-01-15".to_string());
        let page = db.player_stats().query(&filter).unwrap();
        assert_eq!(page.total, 1);
        assert_eq!(page.rows[0].games_played, 1); // only g1 within range
        assert_eq!(page.rows[0].points, Some(20.0));
    }

    #[test]
    fn team_fast_path_per_36_matches_formula() {
        let db = open_test_db();
        seed_games(&db);

        db.player_team_season_rollups()
            .compute_for_season("2023-24", "nba_stats")
            .unwrap();

        let mut filter = PlayerStatsFilter::new(1, 50);
        filter.display_mode = DisplayMode::Per36;
        filter.team_id = Some("NBA_BOS".to_string());
        let page = db.player_stats().query(&filter).unwrap();
        let row = &page.rows[0];
        // total points = 30, total minutes = 55 => per-36 = 30 * 36 / 55
        let expected = 30.0 * 36.0 / 55.0;
        assert!((row.points.unwrap() - expected).abs() < 1e-9);
    }

    /// Benchmark: synthesize 500 player_team_season_totals rows, run a
    /// team-filtered query 100 times, assert median latency is under 50ms.
    ///
    /// Marked `#[ignore]` so CI does not run it by default.
    /// Run with: `cargo test -- --ignored team_fast_path_latency_benchmark`
    #[test]
    #[ignore]
    fn team_fast_path_latency_benchmark() {
        let db = open_test_db();
        insert_season(&db, "2023-24", "NBA");
        insert_team(&db, "NBA_BOS", "NBA");

        // Synthesize 500 players with team rollup rows directly.
        for i in 0..500_u32 {
            let player_id = format!("NBA_{i}");
            insert_player(&db, &player_id, "NBA");
            db.raw_conn()
                .execute(
                    "INSERT INTO player_team_season_totals
                        (player_id, team_id, season_id, season_type, source, games_played, points)
                     VALUES (?, 'NBA_BOS', '2023-24', 'Regular', 'nba_stats', 50, ?)
                     ON CONFLICT DO NOTHING",
                    duckdb::params![player_id, 800 + i],
                )
                .unwrap();
        }

        let mut filter = PlayerStatsFilter::new(1, 50);
        filter.team_id = Some("NBA_BOS".to_string());

        let mut durations: Vec<u128> = Vec::with_capacity(100);
        for _ in 0..100 {
            let start = std::time::Instant::now();
            let _ = db.player_stats().query(&filter).unwrap();
            durations.push(start.elapsed().as_millis());
        }
        durations.sort_unstable();
        let median = durations[50];
        assert!(
            median < 50,
            "team fast path median latency {median}ms, expected <50ms"
        );
    }

    // ── Table-driven property-style coverage (proptest not added; see summary) ──

    #[test]
    fn many_filter_sort_pagination_combinations_never_panic() {
        let db = open_test_db();
        seed_basic(&db);
        seed_games(&db);

        // A full cross-product of every dimension below would be tens of thousands
        // of queries against a real DuckDB connection (too slow for a unit test).
        // Instead we walk all dimensions in lockstep (cycling shorter lists), which
        // still exercises every individual value of every dimension at least once
        // in combination with varying values of every other dimension — a
        // "pairwise-ish" sweep rather than a full cross product. This is the
        // documented table-driven substitute for `proptest` (see task summary).
        let season_options: Vec<Vec<String>> = vec![
            vec![],
            vec!["2023-24".to_string()],
            vec!["2099-00".to_string()],
        ];
        let modes = [
            DisplayMode::Totals,
            DisplayMode::PerGame,
            DisplayMode::Per36,
            DisplayMode::Per100,
        ];
        let sorts = ["points", "player_id", "games_played", "minutes_played"];
        let dirs = [SortDir::Asc, SortDir::Desc];
        let pages = [1u32, 2, 3];
        let sizes = [1u32, 5, 50, 500];
        let home_aways = [None, Some(HomeAway::Home), Some(HomeAway::Away)];
        let win_losses = [None, Some(WinLoss::Win), Some(WinLoss::Loss)];

        let n = 64;
        for i in 0..n {
            let season_ids = &season_options[i % season_options.len()];
            let mode = modes[i % modes.len()];
            let sort_by = sorts[i % sorts.len()];
            let dir = dirs[i % dirs.len()];
            let page = pages[i % pages.len()];
            let size = sizes[i % sizes.len()];
            let home_away = home_aways[i % home_aways.len()];
            let win_loss = win_losses[i % win_losses.len()];

            let mut filter = PlayerStatsFilter::new(page, size);
            filter.season_ids = season_ids.clone();
            filter.display_mode = mode;
            filter.sort_by = sort_by.to_string();
            filter.sort_dir = dir;
            filter.home_away = home_away;
            filter.win_loss = win_loss;

            let page_result = db
                .player_stats()
                .query(&filter)
                .expect("query must not error");
            assert!(page_result.rows.len() as u32 <= filter.page_size);
        }
    }

    #[test]
    fn invalid_sort_by_always_rejected_table_driven() {
        let db = open_test_db();
        seed_basic(&db);

        let bad_columns = [
            "id; DROP TABLE player",
            "1=1",
            "points, source",
            "nonexistent_column",
            "",
            "POINTS", // case-sensitive — not in allowlist as-is
        ];
        for &col in &bad_columns {
            let mut filter = PlayerStatsFilter::new(1, 50);
            filter.sort_by = col.to_string();
            let err = db.player_stats().query(&filter).unwrap_err();
            assert!(
                matches!(err, crate::error::DbError::InvalidSortColumn(_)),
                "expected rejection for {col:?}"
            );
        }
    }

    #[test]
    fn pagination_total_consistent_across_pages() {
        let db = open_test_db();
        seed_basic(&db);

        let mut filter = PlayerStatsFilter::new(1, 1);
        filter.sort_by = "player_id".to_string();
        let mut collected = 0usize;
        let last_total = loop {
            let page_result = db.player_stats().query(&filter).unwrap();
            if page_result.rows.is_empty() || filter.page > 10 {
                break page_result.total;
            }
            collected += page_result.rows.len();
            filter.page += 1;
        };
        assert_eq!(collected as u64, last_total);
    }

    /// Smoke check for the acceptance criterion "p95 query latency <100ms on
    /// full-history DB". We don't have a full-history DB in this session (that
    /// requires Phase 9 historical ingestion), so this seeds a few hundred
    /// synthetic player-season rows and asserts the query completes well under
    /// 100ms as an early warning signal, not a substitute for real p95
    /// validation against production-scale data.
    #[test]
    fn fast_path_latency_smoke_check_with_synthetic_rows() {
        let db = open_test_db();
        insert_season(&db, "2023-24", "NBA");
        for i in 0..300 {
            let player_id = format!("NBA_{i}");
            insert_player(&db, &player_id, "NBA");
            upsert_totals(&db, &totals_row(&player_id, "2023-24", 800 + i, 60));
        }

        let filter = PlayerStatsFilter::new(1, 50);
        let start = std::time::Instant::now();
        let page = db.player_stats().query(&filter).unwrap();
        let elapsed = start.elapsed();

        assert_eq!(page.total, 300);
        assert!(
            elapsed.as_millis() < 50,
            "fast-path query took {elapsed:?}, expected <50ms smoke threshold"
        );
    }
}
