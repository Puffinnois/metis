use std::sync::Arc;

use axum::extract::{Path, Query, State};
use axum::Json;
use utoipa::OpenApi;

use crate::error::ApiError;
use crate::models::{CoverageLabel, TeamDto, TeamItemResponse, TeamListResponse, TeamsQuery};
use crate::AppState;

/// List all teams, with an optional `league_id` filter.
#[utoipa::path(
    get,
    path = "/teams",
    params(
        ("league_id" = Option<String>, Query, description = "Filter by league id"),
    ),
    responses(
        (status = 200, description = "List of teams", body = TeamListResponse),
    ),
    tag = "teams"
)]
pub async fn list_teams(
    State(state): State<Arc<AppState>>,
    Query(params): Query<TeamsQuery>,
) -> Result<Json<TeamListResponse>, ApiError> {
    let dtos = {
        let db = state.db.lock().expect("db mutex poisoned");
        let teams = db.teams().list(params.league_id.as_deref())?;
        teams.into_iter().map(TeamDto::from).collect::<Vec<_>>()
    };
    let total = dtos.len();
    Ok(Json(TeamListResponse { data: dtos, total, coverage: CoverageLabel::Full }))
}

/// Get a single team by id.
#[utoipa::path(
    get,
    path = "/teams/{id}",
    params(
        ("id" = String, Path, description = "Team composite id, e.g. NBA_BOS"),
    ),
    responses(
        (status = 200, description = "Team found", body = TeamItemResponse),
        (status = 404, description = "Team not found"),
    ),
    tag = "teams"
)]
pub async fn get_team(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<TeamItemResponse>, ApiError> {
    let dto = {
        let db = state.db.lock().expect("db mutex poisoned");
        let team = db
            .teams()
            .find_by_id(&id)?
            .ok_or_else(|| ApiError::NotFound(format!("Team {id} not found")))?;
        TeamDto::from(team)
    };
    Ok(Json(TeamItemResponse { data: dto, coverage: CoverageLabel::Full }))
}

#[derive(OpenApi)]
#[openapi(
    paths(list_teams, get_team),
    components(schemas(TeamDto, TeamListResponse, TeamItemResponse))
)]
pub struct TeamApi;
