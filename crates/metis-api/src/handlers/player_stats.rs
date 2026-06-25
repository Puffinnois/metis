use std::sync::Arc;

use axum::extract::{Query, State};
use axum::Json;
use metis_db::{DisplayMode, HomeAway, PlayerStatsFilter, SortDir, WinLoss};
use utoipa::OpenApi;

use crate::error::ApiError;
use crate::models::{CoverageLabel, PlayerStatsPageResponse, PlayerStatsQuery, PlayerStatsRowDto};
use crate::AppState;

/// Coverage thresholds from the CLAUDE.md stat coverage policy.
const NBA_STATS_MIN_SEASON: u16 = 1996;
const BREF_ADVANCED_MIN_SEASON: u16 = 1979; // per_36 / per_100 require advanced stats

/// Parse the start year from a season label like `"1975-76"` → `1975`.
/// Returns `None` if the label does not match the expected format.
fn parse_season_start(label: &str) -> Option<u16> {
    label.split('-').next()?.parse().ok()
}

/// Returns `Partial` when all requested seasons fall outside the source/mode
/// coverage window, signalling to the client that some stats will be `null`.
fn coverage_for_filter(filter: &PlayerStatsFilter) -> CoverageLabel {
    if filter.season_ids.is_empty() {
        // No season restriction → we return only what exists; coverage is full
        // relative to whatever data is present.
        return CoverageLabel::Full;
    }

    let source_min = if filter.source == "nba_stats" {
        NBA_STATS_MIN_SEASON
    } else {
        1946 // bref has data from the founding season
    };

    let effective_min = match filter.display_mode {
        // per_36 / per_100 are derived from advanced stats (bref 1979+)
        DisplayMode::Per36 | DisplayMode::Per100 => source_min.max(BREF_ADVANCED_MIN_SEASON),
        _ => source_min,
    };

    let any_before_min = filter.season_ids.iter().any(|id| {
        parse_season_start(id).is_none_or(|y| y < effective_min)
    });

    if any_before_min {
        CoverageLabel::Partial
    } else {
        CoverageLabel::Full
    }
}

fn parse_display_mode(raw: Option<&str>) -> Result<DisplayMode, ApiError> {
    match raw {
        None | Some("totals") => Ok(DisplayMode::Totals),
        Some("per_game") => Ok(DisplayMode::PerGame),
        Some("per_36") => Ok(DisplayMode::Per36),
        Some("per_100") => Ok(DisplayMode::Per100),
        Some(other) => Err(ApiError::BadRequest(format!(
            "invalid display_mode: {other} (expected totals, per_game, per_36, or per_100)"
        ))),
    }
}

fn parse_home_away(raw: Option<&str>) -> Result<Option<HomeAway>, ApiError> {
    match raw {
        None => Ok(None),
        Some("home") => Ok(Some(HomeAway::Home)),
        Some("away") => Ok(Some(HomeAway::Away)),
        Some(other) => Err(ApiError::BadRequest(format!(
            "invalid home_away: {other} (expected home or away)"
        ))),
    }
}

fn parse_win_loss(raw: Option<&str>) -> Result<Option<WinLoss>, ApiError> {
    match raw {
        None => Ok(None),
        Some("win") => Ok(Some(WinLoss::Win)),
        Some("loss") => Ok(Some(WinLoss::Loss)),
        Some(other) => Err(ApiError::BadRequest(format!(
            "invalid win_loss: {other} (expected win or loss)"
        ))),
    }
}

fn parse_sort_dir(raw: Option<&str>) -> Result<SortDir, ApiError> {
    match raw {
        None | Some("desc") => Ok(SortDir::Desc),
        Some("asc") => Ok(SortDir::Asc),
        Some(other) => Err(ApiError::BadRequest(format!(
            "invalid sort_dir: {other} (expected asc or desc)"
        ))),
    }
}

/// Builds a [`PlayerStatsFilter`] from validated query parameters.
///
/// `page_size` above the maximum is clamped (not rejected) by
/// [`PlayerStatsFilter::new`]. `sort_by` is validated against the allowlist here
/// and rejected with `400 Bad Request` before it ever reaches SQL.
fn build_filter(params: &PlayerStatsQuery) -> Result<PlayerStatsFilter, ApiError> {
    let sort_by = params
        .sort_by
        .clone()
        .unwrap_or_else(|| "points".to_string());
    if !metis_db::is_valid_sort_column(&sort_by) {
        return Err(ApiError::BadRequest(format!(
            "invalid sort_by: {sort_by} (allowed: {})",
            metis_db::SORT_COLUMN_ALLOWLIST.join(", ")
        )));
    }

    let mut filter = PlayerStatsFilter::new(
        params.page.unwrap_or(1),
        params.page_size.unwrap_or(metis_db::DEFAULT_PAGE_SIZE),
    );
    filter.season_ids = params
        .season_id
        .as_deref()
        .map(|s| {
            s.split(',')
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default();
    filter.season_type = params.season_type.clone();
    filter.player_id = params.player_id.clone();
    filter.team_id = params.team_id.clone();
    filter.date_from = params.date_from.clone();
    filter.date_to = params.date_to.clone();
    filter.home_away = parse_home_away(params.home_away.as_deref())?;
    filter.win_loss = parse_win_loss(params.win_loss.as_deref())?;
    filter.display_mode = parse_display_mode(params.display_mode.as_deref())?;
    if let Some(ref source) = params.source {
        filter.source = source.clone();
    }
    filter.sort_by = sort_by;
    filter.sort_dir = parse_sort_dir(params.sort_dir.as_deref())?;

    Ok(filter)
}

/// List player season statistics with filtering, sorting, and pagination.
///
/// Supports filtering by season(s), season type, team, date range, home/away,
/// and win/loss, plus four display modes (totals, per-game, per-36, per-100).
/// Date range / home-away / win-loss filters trigger on-the-fly aggregation of
/// `player_game_box`; all other combinations read from precomputed season
/// rollup tables.
#[utoipa::path(
    get,
    path = "/players/stats",
    params(
        ("season_id" = Option<String>, Query, description = "Comma-separated season labels, e.g. 2022-23,2023-24 (OR'd)"),
        ("season_type" = Option<String>, Query, description = "Filter by season type, e.g. Regular"),
        ("team_id" = Option<String>, Query, description = "Filter by player's team for the stint"),
        ("date_from" = Option<String>, Query, description = "Inclusive ISO-8601 lower bound on game date"),
        ("date_to" = Option<String>, Query, description = "Inclusive ISO-8601 upper bound on game date"),
        ("home_away" = Option<String>, Query, description = "\"home\" or \"away\""),
        ("win_loss" = Option<String>, Query, description = "\"win\" or \"loss\""),
        ("display_mode" = Option<String>, Query, description = "\"totals\", \"per_game\", \"per_36\", or \"per_100\""),
        ("source" = Option<String>, Query, description = "Ingest adapter name, defaults to nba_stats"),
        ("sort_by" = Option<String>, Query, description = "Stat column to sort by, defaults to points"),
        ("sort_dir" = Option<String>, Query, description = "\"asc\" or \"desc\", defaults to desc"),
        ("page" = Option<u32>, Query, description = "1-indexed page number, defaults to 1"),
        ("page_size" = Option<u32>, Query, description = "Page size, clamped to [1, 200], defaults to 50"),
    ),
    responses(
        (status = 200, description = "Paginated player season stats", body = PlayerStatsPageResponse),
        (status = 400, description = "Invalid filter, sort, or pagination parameter"),
    ),
    tag = "players"
)]
pub async fn list_player_stats(
    State(state): State<Arc<AppState>>,
    Query(params): Query<PlayerStatsQuery>,
) -> Result<Json<PlayerStatsPageResponse>, ApiError> {
    let filter = build_filter(&params)?;
    let coverage = coverage_for_filter(&filter);
    let (rows, page, page_size, total) = {
        let db = state.db.lock().expect("db mutex poisoned");
        let result = db.player_stats().query(&filter)?;
        let rows = result
            .rows
            .into_iter()
            .map(PlayerStatsRowDto::from)
            .collect::<Vec<_>>();
        (rows, filter.page, filter.page_size, result.total)
    };
    Ok(Json(PlayerStatsPageResponse {
        rows,
        coverage,
        page,
        page_size,
        total,
    }))
}

#[derive(OpenApi)]
#[openapi(
    paths(list_player_stats),
    components(schemas(PlayerStatsRowDto, PlayerStatsPageResponse))
)]
pub struct PlayerStatsApi;
