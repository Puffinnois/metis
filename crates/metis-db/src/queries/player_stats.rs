//! Filter/sort/pagination query layer for player season statistics (T061).
//!
//! Three query paths:
//!
//! - **Fast path** (no team_id, no date range / home-away / win-loss filter):
//!   reads directly from the precomputed `player_season_totals` /
//!   `player_season_per_game` / `player_season_per_36` / `player_season_per_100`
//!   tables.
//! - **Team fast path** (`team_id` set, but no date range / home-away / win-loss):
//!   reads from `player_team_season_totals` and applies display-mode scaling in
//!   Rust. Avoids the expensive `player_game_box JOIN game` scan for the very
//!   common team-only filter (T062).
//! - **Aggregation path** (date range, home-away, or win-loss filter present):
//!   aggregates `player_game_box` joined to `game` on the fly, since those
//!   dimensions are not present in the season rollup tables. Per-36 / per-100
//!   conversions are then applied to the aggregated totals.
//!
//! `sort_by` is always validated against [`crate::model::player_stats::SORT_COLUMN_ALLOWLIST`]
//! before being interpolated into SQL — DuckDB does not support binding column
//! identifiers via `?`.

use duckdb::{Connection, Row};

use crate::error::Result;
use crate::model::player_stats::{
    is_valid_sort_column, DisplayMode, HomeAway, PlayerStatsFilter, PlayerStatsPage,
    PlayerStatsRow, WinLoss,
};

/// Counting-stat column names shared by all season rollup tables and the
/// per-game aggregation query. Order matters — it matches [`map_row`].
const STAT_COLUMNS: &[&str] = &[
    "minutes_played",
    "points",
    "rebounds_offensive",
    "rebounds_defensive",
    "rebounds_total",
    "assists",
    "steals",
    "blocks",
    "turnovers",
    "personal_fouls",
    "field_goals_made",
    "field_goals_attempted",
    "three_pointers_made",
    "three_pointers_attempted",
    "free_throws_made",
    "free_throws_attempted",
];

fn season_table_name(mode: DisplayMode) -> &'static str {
    match mode {
        DisplayMode::Totals => "player_season_totals",
        DisplayMode::PerGame => "player_season_per_game",
        DisplayMode::Per36 => "player_season_per_36",
        DisplayMode::Per100 => "player_season_per_100",
    }
}

fn map_row(row: &Row<'_>) -> duckdb::Result<PlayerStatsRow> {
    Ok(PlayerStatsRow {
        player_id: row.get(0)?,
        season_id: row.get(1)?,
        season_type: row.get(2)?,
        source: row.get(3)?,
        games_played: row.get(4)?,
        minutes_played: row.get(5)?,
        points: row.get(6)?,
        rebounds_offensive: row.get(7)?,
        rebounds_defensive: row.get(8)?,
        rebounds_total: row.get(9)?,
        assists: row.get(10)?,
        steals: row.get(11)?,
        blocks: row.get(12)?,
        turnovers: row.get(13)?,
        personal_fouls: row.get(14)?,
        field_goals_made: row.get(15)?,
        field_goals_attempted: row.get(16)?,
        three_pointers_made: row.get(17)?,
        three_pointers_attempted: row.get(18)?,
        free_throws_made: row.get(19)?,
        free_throws_attempted: row.get(20)?,
    })
}

/// Validates `filter.sort_by` against the allowlist. Returns the SQL `ORDER BY`
/// fragment (e.g. `"points DESC"`) on success.
fn validated_order_by(filter: &PlayerStatsFilter) -> Result<String> {
    if !is_valid_sort_column(&filter.sort_by) {
        return Err(crate::error::DbError::InvalidSortColumn(
            filter.sort_by.clone(),
        ));
    }
    Ok(format!("{} {}", filter.sort_by, filter.sort_dir.as_sql()))
}

/// Runs the filtered, sorted, paginated player stats query.
///
/// Dispatch order:
/// 1. Any date-range / home-away / win-loss filter → aggregation path.
/// 2. `team_id` set (no other complex filters) → team fast path.
/// 3. Otherwise → season rollup fast path.
pub fn query(conn: &Connection, filter: &PlayerStatsFilter) -> Result<PlayerStatsPage> {
    let order_by = validated_order_by(filter)?;
    if filter.requires_per_game_aggregation() {
        query_aggregated(conn, filter, &order_by)
    } else if filter.team_id.is_some() {
        query_team_fast_path(conn, filter, &order_by)
    } else {
        query_fast_path(conn, filter, &order_by)
    }
}

// ---------------------------------------------------------------------------
// Fast path: precomputed season rollup tables (no team_id filter)
// ---------------------------------------------------------------------------

fn query_fast_path(
    conn: &Connection,
    filter: &PlayerStatsFilter,
    order_by: &str,
) -> Result<PlayerStatsPage> {
    let table = season_table_name(filter.display_mode);

    let mut conditions = vec!["source = ?".to_string()];
    let mut params: Vec<Box<dyn duckdb::ToSql>> = vec![Box::new(filter.source.clone())];

    if !filter.season_ids.is_empty() {
        let placeholders = filter
            .season_ids
            .iter()
            .map(|_| "?")
            .collect::<Vec<_>>()
            .join(", ");
        conditions.push(format!("season_id IN ({placeholders})"));
        for s in &filter.season_ids {
            params.push(Box::new(s.clone()));
        }
    }
    if let Some(ref st) = filter.season_type {
        conditions.push("season_type = ?".to_string());
        params.push(Box::new(st.clone()));
    }
    if let Some(ref pid) = filter.player_id {
        conditions.push("player_id = ?".to_string());
        params.push(Box::new(pid.clone()));
    }

    let stat_cols = STAT_COLUMNS.join(", ");
    let where_clause = format!("WHERE {}", conditions.join(" AND "));

    let count_sql = format!("SELECT COUNT(*) FROM {table} {where_clause}");
    let total: i64 = {
        let mut stmt = conn.prepare(&count_sql)?;
        let param_refs: Vec<&dyn duckdb::ToSql> = params.iter().map(|b| b.as_ref()).collect();
        stmt.query_row(param_refs.as_slice(), |row| row.get(0))?
    };

    let select_sql = format!(
        "SELECT player_id, season_id, season_type, source, games_played, {stat_cols}
         FROM {table}
         {where_clause}
         ORDER BY {order_by}, player_id
         LIMIT ? OFFSET ?"
    );

    params.push(Box::new(filter.limit()));
    params.push(Box::new(filter.offset()));

    let mut stmt = conn.prepare(&select_sql)?;
    let param_refs: Vec<&dyn duckdb::ToSql> = params.iter().map(|b| b.as_ref()).collect();
    let rows = stmt.query_map(param_refs.as_slice(), map_row)?;
    let rows = rows.collect::<duckdb::Result<Vec<_>>>()?;

    Ok(PlayerStatsPage {
        rows,
        total: total.max(0) as u64,
    })
}

// ---------------------------------------------------------------------------
// Team fast path: precomputed player_team_season_totals
// ---------------------------------------------------------------------------

/// Fast path for team-filtered queries with no date-range / home-away / win-loss
/// predicates. Reads from `player_team_season_totals` (one row per
/// player+team+season) and applies display-mode scaling in Rust, avoiding a
/// full `player_game_box JOIN game` scan.
fn query_team_fast_path(
    conn: &Connection,
    filter: &PlayerStatsFilter,
    order_by: &str,
) -> Result<PlayerStatsPage> {
    let team_id = filter
        .team_id
        .as_deref()
        .expect("query_team_fast_path called with no team_id");

    let mut conditions = vec!["source = ?".to_string(), "team_id = ?".to_string()];
    let mut params: Vec<Box<dyn duckdb::ToSql>> = vec![
        Box::new(filter.source.clone()),
        Box::new(team_id.to_string()),
    ];

    if !filter.season_ids.is_empty() {
        let placeholders = filter
            .season_ids
            .iter()
            .map(|_| "?")
            .collect::<Vec<_>>()
            .join(", ");
        conditions.push(format!("season_id IN ({placeholders})"));
        for s in &filter.season_ids {
            params.push(Box::new(s.clone()));
        }
    }
    if let Some(ref st) = filter.season_type {
        conditions.push("season_type = ?".to_string());
        params.push(Box::new(st.clone()));
    }
    if let Some(ref pid) = filter.player_id {
        conditions.push("player_id = ?".to_string());
        params.push(Box::new(pid.clone()));
    }

    let stat_cols = STAT_COLUMNS.join(", ");
    let where_clause = format!("WHERE {}", conditions.join(" AND "));

    let count_sql =
        format!("SELECT COUNT(*) FROM player_team_season_totals {where_clause}");
    let total: i64 = {
        let mut stmt = conn.prepare(&count_sql)?;
        let param_refs: Vec<&dyn duckdb::ToSql> = params.iter().map(|b| b.as_ref()).collect();
        stmt.query_row(param_refs.as_slice(), |row| row.get(0))?
    };

    // Always read raw totals; apply display mode in Rust (same approach as the
    // aggregation path). This keeps the table schema simple — one totals table
    // covers all display modes.
    let select_sql = format!(
        "SELECT player_id, season_id, season_type, source, games_played, {stat_cols}
         FROM player_team_season_totals
         {where_clause}
         ORDER BY {order_by}, player_id
         LIMIT ? OFFSET ?"
    );

    params.push(Box::new(filter.limit()));
    params.push(Box::new(filter.offset()));

    let mut stmt = conn.prepare(&select_sql)?;
    let param_refs: Vec<&dyn duckdb::ToSql> = params.iter().map(|b| b.as_ref()).collect();
    let rows = stmt.query_map(param_refs.as_slice(), map_row)?;
    let totals = rows.collect::<duckdb::Result<Vec<_>>>()?;

    let rows = totals
        .into_iter()
        .map(|row| apply_display_mode(row, filter.display_mode))
        .collect();

    Ok(PlayerStatsPage {
        rows,
        total: total.max(0) as u64,
    })
}

// ---------------------------------------------------------------------------
// Aggregation path: player_game_box joined to game
// ---------------------------------------------------------------------------

fn query_aggregated(
    conn: &Connection,
    filter: &PlayerStatsFilter,
    order_by: &str,
) -> Result<PlayerStatsPage> {
    let mut conditions = vec!["pgb.source = ?".to_string()];
    let mut params: Vec<Box<dyn duckdb::ToSql>> = vec![Box::new(filter.source.clone())];

    if !filter.season_ids.is_empty() {
        let placeholders = filter
            .season_ids
            .iter()
            .map(|_| "?")
            .collect::<Vec<_>>()
            .join(", ");
        conditions.push(format!("pgb.season_id IN ({placeholders})"));
        for s in &filter.season_ids {
            params.push(Box::new(s.clone()));
        }
    }
    if let Some(ref st) = filter.season_type {
        conditions.push("pgb.season_type = ?".to_string());
        params.push(Box::new(st.clone()));
    }
    if let Some(ref team_id) = filter.team_id {
        conditions.push("pgb.team_id = ?".to_string());
        params.push(Box::new(team_id.clone()));
    }
    if let Some(ref pid) = filter.player_id {
        conditions.push("pgb.player_id = ?".to_string());
        params.push(Box::new(pid.clone()));
    }
    if let Some(ref from) = filter.date_from {
        conditions.push("g.game_date >= CAST(? AS DATE)".to_string());
        params.push(Box::new(from.clone()));
    }
    if let Some(ref to) = filter.date_to {
        conditions.push("g.game_date <= CAST(? AS DATE)".to_string());
        params.push(Box::new(to.clone()));
    }
    match filter.home_away {
        Some(HomeAway::Home) => conditions.push("pgb.team_id = g.home_team_id".to_string()),
        Some(HomeAway::Away) => conditions.push("pgb.team_id = g.away_team_id".to_string()),
        None => {}
    }
    match filter.win_loss {
        Some(WinLoss::Win) => conditions.push(
            "((pgb.team_id = g.home_team_id AND g.home_score > g.away_score) OR \
              (pgb.team_id = g.away_team_id AND g.away_score > g.home_score))"
                .to_string(),
        ),
        Some(WinLoss::Loss) => conditions.push(
            "((pgb.team_id = g.home_team_id AND g.home_score < g.away_score) OR \
              (pgb.team_id = g.away_team_id AND g.away_score < g.home_score))"
                .to_string(),
        ),
        None => {}
    }

    let where_clause = format!("WHERE {}", conditions.join(" AND "));

    let count_sql = format!(
        "SELECT COUNT(*) FROM (
            SELECT pgb.player_id
            FROM player_game_box pgb
            JOIN game g ON g.id = pgb.game_id
            {where_clause}
            GROUP BY pgb.player_id, pgb.season_id, pgb.season_type, pgb.source
         ) sub"
    );
    let total: i64 = {
        let mut stmt = conn.prepare(&count_sql)?;
        let param_refs: Vec<&dyn duckdb::ToSql> = params.iter().map(|b| b.as_ref()).collect();
        stmt.query_row(param_refs.as_slice(), |row| row.get(0))?
    };

    // Aggregate raw totals first; per-36/per-100 conversion is applied in Rust
    // below (mirrors metis_compute::formulas::per_36 / per_100 — metis-db cannot
    // depend on metis-compute, which depends on metis-db).
    let agg_sql = format!(
        "SELECT
            pgb.player_id,
            pgb.season_id,
            pgb.season_type,
            pgb.source,
            COUNT(*) AS games_played,
            SUM(pgb.minutes_played) AS minutes_played,
            SUM(pgb.points) AS points,
            SUM(pgb.rebounds_offensive) AS rebounds_offensive,
            SUM(pgb.rebounds_defensive) AS rebounds_defensive,
            SUM(pgb.rebounds_total) AS rebounds_total,
            SUM(pgb.assists) AS assists,
            SUM(pgb.steals) AS steals,
            SUM(pgb.blocks) AS blocks,
            SUM(pgb.turnovers) AS turnovers,
            SUM(pgb.personal_fouls) AS personal_fouls,
            SUM(pgb.field_goals_made) AS field_goals_made,
            SUM(pgb.field_goals_attempted) AS field_goals_attempted,
            SUM(pgb.three_pointers_made) AS three_pointers_made,
            SUM(pgb.three_pointers_attempted) AS three_pointers_attempted,
            SUM(pgb.free_throws_made) AS free_throws_made,
            SUM(pgb.free_throws_attempted) AS free_throws_attempted
         FROM player_game_box pgb
         JOIN game g ON g.id = pgb.game_id
         {where_clause}
         GROUP BY pgb.player_id, pgb.season_id, pgb.season_type, pgb.source
         ORDER BY {order_by}, pgb.player_id
         LIMIT ? OFFSET ?"
    );

    let mut select_params = params;
    select_params.push(Box::new(filter.limit()));
    select_params.push(Box::new(filter.offset()));

    let mut stmt = conn.prepare(&agg_sql)?;
    let param_refs: Vec<&dyn duckdb::ToSql> = select_params.iter().map(|b| b.as_ref()).collect();
    let rows = stmt.query_map(param_refs.as_slice(), map_row)?;
    let totals = rows.collect::<duckdb::Result<Vec<_>>>()?;

    let rows = totals
        .into_iter()
        .map(|row| apply_display_mode(row, filter.display_mode))
        .collect();

    Ok(PlayerStatsPage {
        rows,
        total: total.max(0) as u64,
    })
}

/// Applies the requested display mode to a row of raw totals.
///
/// Mirrors `metis_compute::formulas::per_36` / `per_100` (duplicated here since
/// `metis-db` cannot depend on `metis-compute`, which depends on `metis-db`).
fn apply_display_mode(row: PlayerStatsRow, mode: DisplayMode) -> PlayerStatsRow {
    match mode {
        DisplayMode::Totals => row,
        DisplayMode::PerGame => {
            let gp = f64::from(row.games_played);
            scale_row(row, |v| if gp > 0.0 { Some(v / gp) } else { None })
        }
        DisplayMode::Per36 => {
            let minutes = row.minutes_played;
            scale_row(row, move |v| match minutes {
                Some(m) if m > 0.0 => Some(v * 36.0 / m),
                _ => None,
            })
        }
        DisplayMode::Per100 => {
            // Estimated possessions = FGA + 0.44*FTA + TOV - ORB.
            let fga = row.field_goals_attempted.unwrap_or(0.0);
            let fta = row.free_throws_attempted.unwrap_or(0.0);
            let tov = row.turnovers.unwrap_or(0.0);
            let orb = row.rebounds_offensive.unwrap_or(0.0);
            let est_poss = fga + 0.44 * fta + tov - orb;
            scale_row(row, move |v| {
                if est_poss > 0.0 {
                    Some(v * 100.0 / est_poss)
                } else {
                    None
                }
            })
        }
    }
}

fn scale_row(row: PlayerStatsRow, f: impl Fn(f64) -> Option<f64>) -> PlayerStatsRow {
    PlayerStatsRow {
        player_id: row.player_id,
        season_id: row.season_id,
        season_type: row.season_type,
        source: row.source,
        games_played: row.games_played,
        minutes_played: row.minutes_played.and_then(&f),
        points: row.points.and_then(&f),
        rebounds_offensive: row.rebounds_offensive.and_then(&f),
        rebounds_defensive: row.rebounds_defensive.and_then(&f),
        rebounds_total: row.rebounds_total.and_then(&f),
        assists: row.assists.and_then(&f),
        steals: row.steals.and_then(&f),
        blocks: row.blocks.and_then(&f),
        turnovers: row.turnovers.and_then(&f),
        personal_fouls: row.personal_fouls.and_then(&f),
        field_goals_made: row.field_goals_made.and_then(&f),
        field_goals_attempted: row.field_goals_attempted.and_then(&f),
        three_pointers_made: row.three_pointers_made.and_then(&f),
        three_pointers_attempted: row.three_pointers_attempted.and_then(&f),
        free_throws_made: row.free_throws_made.and_then(&f),
        free_throws_attempted: row.free_throws_attempted.and_then(&f),
    }
}
