use std::sync::Arc;

use axum::extract::{Query, State};
use axum::Json;
use utoipa::OpenApi;

use crate::error::ApiError;
use crate::models::{CoverageLabel, SeasonDto, SeasonListResponse, SeasonsQuery};
use crate::AppState;

/// List all seasons, with an optional `league_id` filter.
///
/// Results are ordered by `start_year` descending (most-recent first).
#[utoipa::path(
    get,
    path = "/seasons",
    params(
        ("league_id" = Option<String>, Query, description = "Filter by league id"),
    ),
    responses(
        (status = 200, description = "List of seasons", body = SeasonListResponse),
    ),
    tag = "seasons"
)]
pub async fn list_seasons(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SeasonsQuery>,
) -> Result<Json<SeasonListResponse>, ApiError> {
    let dtos = {
        let db = state.db.lock().expect("db mutex poisoned");
        let seasons = db.seasons().list(params.league_id.as_deref())?;
        seasons.into_iter().map(SeasonDto::from).collect::<Vec<_>>()
    };
    let total = dtos.len();
    Ok(Json(SeasonListResponse { data: dtos, total, coverage: CoverageLabel::Full }))
}

#[derive(OpenApi)]
#[openapi(paths(list_seasons), components(schemas(SeasonDto, SeasonListResponse)))]
pub struct SeasonApi;
