use std::sync::Arc;

use axum::extract::{Path, Query, State};
use axum::Json;
use utoipa::OpenApi;

use crate::error::ApiError;
use crate::models::{CoverageLabel, PlayerDto, PlayerItemResponse, PlayerListResponse, PlayersQuery};
use crate::AppState;

/// List all players, with optional `league_id` and `search` filters.
#[utoipa::path(
    get,
    path = "/players",
    params(
        ("league_id" = Option<String>, Query, description = "Filter by league id"),
        ("search" = Option<String>, Query, description = "Case-insensitive name substring search"),
    ),
    responses(
        (status = 200, description = "List of players", body = PlayerListResponse),
    ),
    tag = "players"
)]
pub async fn list_players(
    State(state): State<Arc<AppState>>,
    Query(params): Query<PlayersQuery>,
) -> Result<Json<PlayerListResponse>, ApiError> {
    let dtos = {
        let db = state.db.lock().expect("db mutex poisoned");
        let repo = db.players();
        let players = if let Some(ref search) = params.search {
            repo.search(search, params.league_id.as_deref())?
        } else {
            repo.list(params.league_id.as_deref())?
        };
        players.into_iter().map(PlayerDto::from).collect::<Vec<_>>()
    };
    let total = dtos.len();
    Ok(Json(PlayerListResponse { data: dtos, total, coverage: CoverageLabel::Full }))
}

/// Get a single player by id.
#[utoipa::path(
    get,
    path = "/players/{id}",
    params(
        ("id" = String, Path, description = "Player composite id, e.g. NBA_2544"),
    ),
    responses(
        (status = 200, description = "Player found", body = PlayerItemResponse),
        (status = 404, description = "Player not found"),
    ),
    tag = "players"
)]
pub async fn get_player(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<PlayerItemResponse>, ApiError> {
    let dto = {
        let db = state.db.lock().expect("db mutex poisoned");
        let player = db
            .players()
            .find_by_id(&id)?
            .ok_or_else(|| ApiError::NotFound(format!("Player {id} not found")))?;
        PlayerDto::from(player)
    };
    Ok(Json(PlayerItemResponse { data: dto, coverage: CoverageLabel::Full }))
}

#[derive(OpenApi)]
#[openapi(
    paths(list_players, get_player),
    components(schemas(PlayerDto, PlayerListResponse, PlayerItemResponse))
)]
pub struct PlayerApi;
