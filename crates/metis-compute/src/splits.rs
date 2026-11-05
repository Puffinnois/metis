use metis_core::Season;
use metis_db::Db;

use crate::error::ComputeError;

/// Computes clutch, by-quarter, and garbage-time splits for all players in
/// `season` and upserts the results into `player_game_splits`.
///
/// Reads from `possession` and `lineup_stint`. All season types present for the
/// given season are computed in one pass. Running this multiple times is safe —
/// subsequent calls overwrite the previous compute output.
///
/// Returns the number of `player_game_splits` rows inserted or updated.
///
/// # Errors
///
/// Returns [`ComputeError`] if the database query fails.
pub fn compute_game_splits(db: &Db, season: Season) -> Result<u64, ComputeError> {
    Ok(db.player_game_splits().compute_for_season(season)?)
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::*;
    use metis_db::{
        model::{lineup_stint::LineupStint, possession::Possession},
        Db,
    };

    // --- test helpers (mirrored from metis-db/src/test_helpers.rs) ---

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

    fn insert_team(db: &Db, id: &str, league_id: &str) {
        db.teams()
            .upsert(&metis_db::model::team::Team {
                id: id.to_string(),
                league_id: league_id.to_string(),
                abbreviation: id.split('_').next_back().unwrap_or(id).to_string(),
                full_name: id.to_string(),
                city: "Test City".to_string(),
            })
            .expect("insert test team");
    }

    fn insert_player(db: &Db, id: &str, league_id: &str) {
        db.players()
            .upsert(&metis_db::model::player::Player {
                id: id.to_string(),
                league_id: league_id.to_string(),
                first_name: "Test".to_string(),
                last_name: "Player".to_string(),
                birth_date: None,
            })
            .expect("insert test player");
    }

    fn insert_season(db: &Db, season_id: &str, league_id: &str) {
        let start_year: i16 = season_id
            .split('-')
            .next()
            .unwrap()
            .parse()
            .expect("valid start year");
        db.seasons()
            .upsert(season_id, league_id, start_year)
            .expect("insert test season");
    }

    fn insert_game(
        db: &Db,
        game_id: &str,
        league_id: &str,
        season_id: &str,
        home_team_id: &str,
        away_team_id: &str,
    ) {
        db.games()
            .upsert(&metis_db::model::game::Game {
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

    // ----------------------------------------------------------------

    fn setup(db: &metis_db::Db) {
        for team in ["NBA_LAL", "NBA_BOS"] {
            insert_team(db, team, "NBA");
        }
        for player in ["NBA_P1", "NBA_P2", "NBA_P3", "NBA_P4", "NBA_P5"] {
            insert_player(db, player, "NBA");
        }
        insert_season(db, "2024-25", "NBA");
        insert_game(db, "NBA_G001", "NBA", "2024-25", "NBA_LAL", "NBA_BOS");
    }

    fn make_possession(
        period: i16,
        start_time_remaining: f64,
        score_margin: i16,
        offense_lineup_id: &str,
        defense_lineup_id: &str,
        points_scored: i16,
        possession_num: i16,
    ) -> Possession {
        Possession {
            id: 0,
            game_id: "NBA_G001".to_string(),
            period,
            possession_num,
            global_possession_num: i32::from(possession_num),
            offense_team_id: "NBA_LAL".to_string(),
            defense_team_id: Some("NBA_BOS".to_string()),
            start_time_remaining: Some(start_time_remaining),
            end_time_remaining: Some(start_time_remaining - 10.0),
            duration_seconds: Some(10.0),
            score_margin: Some(score_margin),
            possession_start_type: None,
            points_scored,
            offense_lineup_id: Some(offense_lineup_id.to_string()),
            defense_lineup_id: Some(defense_lineup_id.to_string()),
            num_events: 1,
            season_id: "2024-25".to_string(),
            season_type: "Regular".to_string(),
            source: "pbpstats".to_string(),
            source_url: "https://pbpstats.com/game/NBA_G001".to_string(),
            fetched_at: "2024-12-01 10:00:00".to_string(),
            source_payload: "{}".to_string(),
            ingested_at: None,
        }
    }

    fn make_lineup_stint(
        period: i16,
        players: [&str; 5],
        lineup_id: &str,
        start: f64,
        possessions_offense: i16,
        possessions_defense: i16,
        points_for: i16,
        points_against: i16,
    ) -> LineupStint {
        LineupStint {
            id: 0,
            game_id: "NBA_G001".to_string(),
            period,
            team_id: "NBA_LAL".to_string(),
            player1_id: Some(players[0].to_string()),
            player2_id: Some(players[1].to_string()),
            player3_id: Some(players[2].to_string()),
            player4_id: Some(players[3].to_string()),
            player5_id: Some(players[4].to_string()),
            lineup_id: lineup_id.to_string(),
            start_time_remaining: start,
            end_time_remaining: Some(start - 120.0),
            duration_seconds: Some(120.0),
            possessions_offense,
            possessions_defense,
            points_for,
            points_against,
            plus_minus: points_for - points_against,
            season_id: "2024-25".to_string(),
            season_type: "Regular".to_string(),
            source: "pbpstats".to_string(),
            source_url: "https://pbpstats.com/game/NBA_G001".to_string(),
            fetched_at: "2024-12-01 10:00:00".to_string(),
            source_payload: "{}".to_string(),
            ingested_at: None,
        }
    }

    const PLAYERS: [&str; 5] = ["NBA_P1", "NBA_P2", "NBA_P3", "NBA_P4", "NBA_P5"];
    const LINEUP_A: &str = "NBA_P1-NBA_P2-NBA_P3-NBA_P4-NBA_P5";

    /// Insert one lineup stint so the possession join can resolve players.
    fn insert_lineup(db: &metis_db::Db, period: i16, lineup_id: &str, start: f64) {
        db.lineup_stints()
            .upsert(&make_lineup_stint(
                period, PLAYERS, lineup_id, start, 5, 5, 4, 3,
            ))
            .unwrap();
    }

    #[test]
    fn clutch_split_filters_correctly() {
        let db = open_test_db();
        setup(&db);

        // Clutch possession: Q4, margin=3, time=200
        insert_lineup(&db, 4, LINEUP_A, 300.0);
        db.possessions()
            .upsert(&make_possession(4, 200.0, 3, LINEUP_A, LINEUP_A, 2, 1))
            .unwrap();

        // Non-clutch possession: Q1, margin=3, time=200 (wrong period)
        insert_lineup(&db, 1, LINEUP_A, 700.0);
        db.possessions()
            .upsert(&make_possession(1, 200.0, 3, LINEUP_A, LINEUP_A, 2, 2))
            .unwrap();

        let n = compute_game_splits(&db, Season(2024)).unwrap();
        assert!(n > 0, "compute must produce at least one row");

        let rows = db
            .player_game_splits()
            .find_by_player_game("NBA_P1", "NBA_G001")
            .unwrap();

        let clutch_rows: Vec<_> = rows.iter().filter(|r| r.split_type == "clutch").collect();
        assert_eq!(
            clutch_rows.len(),
            1,
            "should have exactly one clutch row for NBA_P1"
        );
    }

    #[test]
    fn quarter_split_by_period() {
        let db = open_test_db();
        setup(&db);

        for (period, poss_num) in [(1i16, 1i16), (2, 2), (3, 3), (4, 4)] {
            insert_lineup(&db, period, LINEUP_A, 600.0);
            db.possessions()
                .upsert(&make_possession(
                    period, 400.0, 10, LINEUP_A, LINEUP_A, 2, poss_num,
                ))
                .unwrap();
        }

        compute_game_splits(&db, Season(2024)).unwrap();

        let rows = db
            .player_game_splits()
            .find_by_player_game("NBA_P1", "NBA_G001")
            .unwrap();

        for q in ["quarter_1", "quarter_2", "quarter_3", "quarter_4"] {
            assert!(
                rows.iter().any(|r| r.split_type == q),
                "missing split_type={q}"
            );
        }
    }

    #[test]
    fn garbage_time_filters_correctly() {
        let db = open_test_db();
        setup(&db);

        // Garbage time: time=60, margin=25
        insert_lineup(&db, 4, LINEUP_A, 300.0);
        db.possessions()
            .upsert(&make_possession(4, 60.0, 25, LINEUP_A, LINEUP_A, 2, 1))
            .unwrap();

        // Not garbage time: time=60, margin=10 (margin too small) — different possession_num
        db.possessions()
            .upsert(&make_possession(4, 60.0, 10, LINEUP_A, LINEUP_A, 2, 2))
            .unwrap();

        compute_game_splits(&db, Season(2024)).unwrap();

        let rows = db
            .player_game_splits()
            .find_by_player_game("NBA_P1", "NBA_G001")
            .unwrap();

        let gt_rows: Vec<_> = rows
            .iter()
            .filter(|r| r.split_type == "garbage_time")
            .collect();
        assert_eq!(
            gt_rows.len(),
            1,
            "should have exactly one garbage_time row for NBA_P1"
        );
    }

    #[test]
    fn idempotent() {
        let db = open_test_db();
        setup(&db);

        insert_lineup(&db, 4, LINEUP_A, 300.0);
        db.possessions()
            .upsert(&make_possession(4, 200.0, 3, LINEUP_A, LINEUP_A, 2, 1))
            .unwrap();

        let n1 = compute_game_splits(&db, Season(2024)).unwrap();
        let n2 = compute_game_splits(&db, Season(2024)).unwrap();
        assert_eq!(n1, n2, "second run must produce same row count as first");

        let rows = db
            .player_game_splits()
            .find_by_player_game("NBA_P1", "NBA_G001")
            .unwrap();
        let clutch_count = rows.iter().filter(|r| r.split_type == "clutch").count();
        assert_eq!(clutch_count, 1, "no duplicate rows after second compute");
    }
}
