// Prevents an additional console window from opening on Windows in release mode.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use tauri::Manager;

use metis_db::{Db, DisplayMode, GameLogFilter, HomeAway, PlayerStatsFilter, SortDir, WinLoss};

// ---------------------------------------------------------------------------
// DTOs — local serializable wrappers around metis-db model types
// ---------------------------------------------------------------------------

/// Serializable season record returned to the frontend.
#[derive(Debug, Serialize)]
struct SeasonDto {
    id: String,
    league_id: String,
    start_year: i16,
    end_year: i16,
}

/// Serializable team record returned to the frontend.
#[derive(Debug, Serialize)]
struct TeamDto {
    id: String,
    league_id: String,
    abbreviation: String,
    full_name: String,
    city: String,
}

/// Serializable player record returned to the frontend.
#[derive(Debug, Serialize)]
struct PlayerDto {
    id: String,
    league_id: String,
    first_name: String,
    last_name: String,
    birth_date: Option<String>,
}

/// Serializable player stats row returned to the frontend.
#[allow(clippy::struct_excessive_bools)]
#[derive(Debug, Serialize)]
struct PlayerStatsRowDto {
    player_id: String,
    season_id: String,
    season_type: String,
    source: String,
    games_played: i32,
    minutes_played: Option<f64>,
    points: Option<f64>,
    rebounds_offensive: Option<f64>,
    rebounds_defensive: Option<f64>,
    rebounds_total: Option<f64>,
    assists: Option<f64>,
    steals: Option<f64>,
    blocks: Option<f64>,
    turnovers: Option<f64>,
    personal_fouls: Option<f64>,
    field_goals_made: Option<f64>,
    field_goals_attempted: Option<f64>,
    three_pointers_made: Option<f64>,
    three_pointers_attempted: Option<f64>,
    free_throws_made: Option<f64>,
    free_throws_attempted: Option<f64>,
}

/// A single row of a player's game log returned to the frontend.
#[derive(Debug, Serialize)]
struct PlayerGameLogRowDto {
    game_id: String,
    game_date: String,
    season_id: String,
    season_type: String,
    home_team_id: String,
    away_team_id: String,
    home_score: Option<i16>,
    away_score: Option<i16>,
    player_id: String,
    team_id: String,
    source: String,
    starter: Option<bool>,
    minutes_played: Option<f64>,
    points: Option<i16>,
    rebounds_offensive: Option<i16>,
    rebounds_defensive: Option<i16>,
    rebounds_total: Option<i16>,
    assists: Option<i16>,
    steals: Option<i16>,
    blocks: Option<i16>,
    turnovers: Option<i16>,
    personal_fouls: Option<i16>,
    field_goals_made: Option<i16>,
    field_goals_attempted: Option<i16>,
    three_pointers_made: Option<i16>,
    three_pointers_attempted: Option<i16>,
    free_throws_made: Option<i16>,
    free_throws_attempted: Option<i16>,
    plus_minus: Option<i16>,
}

/// Query parameters for the `get_player_stats` Tauri command.
#[derive(Debug, Deserialize)]
struct PlayerStatsParams {
    season_id: Option<String>,
    season_type: Option<String>,
    player_id: Option<String>,
    team_id: Option<String>,
    home_away: Option<String>,
    win_loss: Option<String>,
    display_mode: Option<String>,
    sort_by: Option<String>,
    sort_dir: Option<String>,
    page: Option<u32>,
    page_size: Option<u32>,
}

/// Query parameters for the `get_player_game_log` Tauri command.
#[derive(Debug, Deserialize)]
struct GameLogParams {
    player_id: String,
    season_id: Option<String>,
    season_type: Option<String>,
    source: Option<String>,
    limit: Option<u32>,
    offset: Option<u32>,
}

/// Paginated player stats result.
#[derive(Debug, Serialize)]
struct PlayerStatsPage {
    rows: Vec<PlayerStatsRowDto>,
    total: u64,
    page: u32,
    page_size: u32,
}

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

/// App-wide shared database handle.
///
/// `Db` is not `Sync` because the underlying DuckDB `Connection` uses
/// interior mutability. We wrap it in `Mutex` so Tauri can share it across
/// command invocations.
type DbState = Arc<Mutex<Option<Db>>>;

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

/// Returns all seasons from the local database, ordered by `start_year` desc.
#[tauri::command]
fn get_seasons(state: tauri::State<'_, DbState>) -> Result<Vec<SeasonDto>, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("Database not available")?;
    let rows = db.seasons().list(None).map_err(|e| e.to_string())?;
    Ok(rows
        .into_iter()
        .map(|r| SeasonDto {
            id: r.id,
            league_id: r.league_id,
            start_year: r.start_year,
            end_year: r.end_year,
        })
        .collect())
}

/// Returns all teams from the local database, ordered by league then full name.
#[tauri::command]
fn get_teams(state: tauri::State<'_, DbState>) -> Result<Vec<TeamDto>, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("Database not available")?;
    let rows = db.teams().list(None).map_err(|e| e.to_string())?;
    Ok(rows
        .into_iter()
        .map(|t| TeamDto {
            id: t.id,
            league_id: t.league_id,
            abbreviation: t.abbreviation,
            full_name: t.full_name,
            city: t.city,
        })
        .collect())
}

/// Returns all players from the local database, ordered by last name then first name.
#[tauri::command]
fn get_players(state: tauri::State<'_, DbState>) -> Result<Vec<PlayerDto>, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("Database not available")?;
    let rows = db.players().list(None).map_err(|e| e.to_string())?;
    Ok(rows
        .into_iter()
        .map(|p| PlayerDto {
            id: p.id,
            league_id: p.league_id,
            first_name: p.first_name,
            last_name: p.last_name,
            birth_date: p.birth_date,
        })
        .collect())
}

/// Returns paginated player season statistics from the local database.
#[tauri::command]
fn get_player_stats(
    state: tauri::State<'_, DbState>,
    params: PlayerStatsParams,
) -> Result<PlayerStatsPage, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("Database not available")?;

    let sort_by = params
        .sort_by
        .unwrap_or_else(|| "points".to_string());
    if !metis_db::is_valid_sort_column(&sort_by) {
        return Err(format!("invalid sort_by: {sort_by}"));
    }

    let display_mode = match params.display_mode.as_deref() {
        None | Some("totals") => DisplayMode::Totals,
        Some("per_game") => DisplayMode::PerGame,
        Some("per_36") => DisplayMode::Per36,
        Some("per_100") => DisplayMode::Per100,
        Some(other) => return Err(format!("invalid display_mode: {other}")),
    };
    let home_away = match params.home_away.as_deref() {
        None => None,
        Some("home") => Some(HomeAway::Home),
        Some("away") => Some(HomeAway::Away),
        Some(other) => return Err(format!("invalid home_away: {other}")),
    };
    let win_loss = match params.win_loss.as_deref() {
        None => None,
        Some("win") => Some(WinLoss::Win),
        Some("loss") => Some(WinLoss::Loss),
        Some(other) => return Err(format!("invalid win_loss: {other}")),
    };
    let sort_dir = match params.sort_dir.as_deref() {
        None | Some("desc") => SortDir::Desc,
        Some("asc") => SortDir::Asc,
        Some(other) => return Err(format!("invalid sort_dir: {other}")),
    };

    let mut filter = PlayerStatsFilter::new(
        params.page.unwrap_or(1),
        params.page_size.unwrap_or(200),
    );
    filter.season_ids = params
        .season_id
        .as_deref()
        .map(|s| {
            s.split(',')
                .map(str::trim)
                .filter(|v| !v.is_empty())
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default();
    filter.season_type = params.season_type;
    filter.player_id = params.player_id;
    filter.team_id = params.team_id;
    filter.home_away = home_away;
    filter.win_loss = win_loss;
    filter.display_mode = display_mode;
    filter.sort_by = sort_by;
    filter.sort_dir = sort_dir;

    let result = db.player_stats().query(&filter).map_err(|e| e.to_string())?;
    let rows = result
        .rows
        .into_iter()
        .map(|r| PlayerStatsRowDto {
            player_id: r.player_id,
            season_id: r.season_id,
            season_type: r.season_type,
            source: r.source,
            games_played: r.games_played,
            minutes_played: r.minutes_played,
            points: r.points,
            rebounds_offensive: r.rebounds_offensive,
            rebounds_defensive: r.rebounds_defensive,
            rebounds_total: r.rebounds_total,
            assists: r.assists,
            steals: r.steals,
            blocks: r.blocks,
            turnovers: r.turnovers,
            personal_fouls: r.personal_fouls,
            field_goals_made: r.field_goals_made,
            field_goals_attempted: r.field_goals_attempted,
            three_pointers_made: r.three_pointers_made,
            three_pointers_attempted: r.three_pointers_attempted,
            free_throws_made: r.free_throws_made,
            free_throws_attempted: r.free_throws_attempted,
        })
        .collect();

    Ok(PlayerStatsPage {
        rows,
        total: result.total,
        page: filter.page,
        page_size: filter.page_size,
    })
}

/// Returns a player's game-by-game box score log enriched with game context.
#[tauri::command]
fn get_player_game_log(
    state: tauri::State<'_, DbState>,
    params: GameLogParams,
) -> Result<Vec<PlayerGameLogRowDto>, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    let db = guard.as_ref().ok_or("Database not available")?;

    let mut filter = GameLogFilter::for_player(&params.player_id);
    filter.season_id = params.season_id;
    filter.season_type = params.season_type;
    if let Some(src) = params.source {
        filter.source = src;
    }
    if let Some(lim) = params.limit {
        filter.limit = lim;
    }
    if let Some(off) = params.offset {
        filter.offset = off;
    }

    let rows = db
        .player_game_log()
        .find_by_player(&filter)
        .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|r| PlayerGameLogRowDto {
            game_id: r.game_id,
            game_date: r.game_date,
            season_id: r.season_id,
            season_type: r.season_type,
            home_team_id: r.home_team_id,
            away_team_id: r.away_team_id,
            home_score: r.home_score,
            away_score: r.away_score,
            player_id: r.player_id,
            team_id: r.team_id,
            source: r.source,
            starter: r.starter,
            minutes_played: r.minutes_played,
            points: r.points,
            rebounds_offensive: r.rebounds_offensive,
            rebounds_defensive: r.rebounds_defensive,
            rebounds_total: r.rebounds_total,
            assists: r.assists,
            steals: r.steals,
            blocks: r.blocks,
            turnovers: r.turnovers,
            personal_fouls: r.personal_fouls,
            field_goals_made: r.field_goals_made,
            field_goals_attempted: r.field_goals_attempted,
            three_pointers_made: r.three_pointers_made,
            three_pointers_attempted: r.three_pointers_attempted,
            free_throws_made: r.free_throws_made,
            free_throws_attempted: r.free_throws_attempted,
            plus_minus: r.plus_minus,
        })
        .collect())
}

// ---------------------------------------------------------------------------
// DB path resolution
// ---------------------------------------------------------------------------

/// Resolves the path to `metis.duckdb`.
///
/// 1. In dev (`cargo tauri dev`), the CWD is `crates/metis-tauri/`, so we
///    walk up two levels to reach the workspace root.
/// 2. In release, use the Tauri app data directory.
fn resolve_db_path(app: &tauri::AppHandle) -> PathBuf {
    // Release path: `<app-data>/metis.duckdb`
    if let Ok(data_dir) = app.path().app_data_dir() {
        let release_path = data_dir.join("metis.duckdb");
        // If the release path exists, prefer it (covers packaged app scenario).
        if release_path.exists() {
            return release_path;
        }
    }

    // Dev path: absolute path derived at compile time from CARGO_MANIFEST_DIR
    // (crates/metis-tauri/), walking up two levels to the workspace root.
    PathBuf::from(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../data/duckdb/metis.duckdb"
    ))
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let db_path = resolve_db_path(app.handle());

            let maybe_db = if db_path.exists() {
                match Db::open_with_migrations(
                    &db_path,
                    concat!(env!("CARGO_MANIFEST_DIR"), "/../../sql/migrations"),
                ) {
                    Ok(db) => {
                        if let Err(e) = db.migrate() {
                            eprintln!("metis-tauri: migration failed: {e}");
                        }
                        Some(db)
                    }
                    Err(e) => {
                        eprintln!("metis-tauri: failed to open DB at {db_path:?}: {e}");
                        None
                    }
                }
            } else {
                eprintln!(
                    "metis-tauri: DB not found at {db_path:?} — \
                     run ingestion first. Commands will return errors until the DB exists."
                );
                None
            };

            app.manage(Arc::new(Mutex::new(maybe_db)) as DbState);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_seasons,
            get_teams,
            get_players,
            get_player_stats,
            get_player_game_log
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
