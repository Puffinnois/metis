use std::sync::Arc;

use axum::extract::{Path, Query, State};
use axum::Json;
use utoipa::OpenApi;

use crate::error::ApiError;
use crate::models::{CoverageLabel, GameDto, GameItemResponse, GameListResponse, GamesQuery};
use crate::AppState;

/// List games with optional filters for `season_id`, `season_type`, and `team_id`.
#[utoipa::path(
    get,
    path = "/games",
    params(
        ("season_id" = Option<String>, Query, description = "Filter by season label, e.g. 2023-24"),
        ("season_type" = Option<String>, Query, description = "Filter by season type, e.g. Regular"),
        ("team_id" = Option<String>, Query, description = "Filter by team id (home or away)"),
    ),
    responses(
        (status = 200, description = "List of games", body = GameListResponse),
    ),
    tag = "games"
)]
pub async fn list_games(
    State(state): State<Arc<AppState>>,
    Query(params): Query<GamesQuery>,
) -> Result<Json<GameListResponse>, ApiError> {
    let dtos = {
        let db = state.db.lock().expect("db mutex poisoned");
        let games = db.games().list_filtered(
            params.season_id.as_deref(),
            params.season_type.as_deref(),
            params.team_id.as_deref(),
        )?;
        games.into_iter().map(GameDto::from).collect::<Vec<_>>()
    };
    let total = dtos.len();
    Ok(Json(GameListResponse { data: dtos, total, coverage: CoverageLabel::Full }))
}

/// Get a single game by id.
#[utoipa::path(
    get,
    path = "/games/{id}",
    params(
        ("id" = String, Path, description = "Game id, e.g. nba_stats_0022300001"),
    ),
    responses(
        (status = 200, description = "Game found", body = GameItemResponse),
        (status = 404, description = "Game not found"),
    ),
    tag = "games"
)]
pub async fn get_game(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<GameItemResponse>, ApiError> {
    let dto = {
        let db = state.db.lock().expect("db mutex poisoned");
        let game = db
            .games()
            .find_by_id(&id)?
            .ok_or_else(|| ApiError::NotFound(format!("Game {id} not found")))?;
        GameDto::from(game)
    };
    Ok(Json(GameItemResponse { data: dto, coverage: CoverageLabel::Full }))
}

#[derive(OpenApi)]
#[openapi(
    paths(list_games, get_game),
    components(schemas(GameDto, GameListResponse, GameItemResponse))
)]
pub struct GameApi;
