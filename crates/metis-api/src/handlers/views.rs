use std::sync::Arc;

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;
use utoipa::ToSchema;

use crate::error::ApiError;
use crate::models::{ItemResponse, ListResponse, UserViewDto};
use crate::AppState;

/// Query parameters for `GET /views`.
#[derive(Debug, Deserialize, ToSchema)]
pub struct ViewsQuery {
    /// Filter by entity type: `player` or `team`.
    pub entity_type: Option<String>,
}

/// List all saved views, optionally filtered by `entity_type`.
#[utoipa::path(
    get,
    path = "/views",
    params(
        ("entity_type" = Option<String>, Query, description = "Filter by entity type: player or team"),
    ),
    responses(
        (status = 200, description = "List of saved views", body = inline(ListResponse<UserViewDto>)),
    ),
    tag = "views"
)]
pub async fn list_views(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ViewsQuery>,
) -> Result<Json<ListResponse<UserViewDto>>, ApiError> {
    let dtos = {
        let db = state.db.lock().expect("db mutex poisoned");
        db.user_views()
            .list(params.entity_type.as_deref())?
            .into_iter()
            .map(UserViewDto::from)
            .collect::<Vec<_>>()
    };
    Ok(Json(ListResponse::full(dtos)))
}

/// Retrieve a single saved view by id.
#[utoipa::path(
    get,
    path = "/views/{id}",
    params(("id" = String, Path, description = "Saved view UUID")),
    responses(
        (status = 200, description = "Saved view", body = inline(ItemResponse<UserViewDto>)),
        (status = 404, description = "Not found"),
    ),
    tag = "views"
)]
pub async fn get_view(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ItemResponse<UserViewDto>>, ApiError> {
    let view = {
        let db = state.db.lock().expect("db mutex poisoned");
        db.user_views().find_by_id(&id)?
    };
    match view {
        Some(v) => Ok(Json(ItemResponse::full(UserViewDto::from(v)))),
        None => Err(ApiError::not_found("view", &id)),
    }
}

/// Create a new saved view.
#[utoipa::path(
    post,
    path = "/views",
    request_body = CreateUserViewDto,
    responses(
        (status = 201, description = "Created view", body = inline(ItemResponse<UserViewDto>)),
        (status = 422, description = "Validation error"),
    ),
    tag = "views"
)]
pub async fn create_view(
    State(state): State<Arc<AppState>>,
    Json(body): Json<CreateUserViewDto>,
) -> Result<(StatusCode, Json<ItemResponse<UserViewDto>>), ApiError> {
    let create = body.into_create()?;
    let view = {
        let db = state.db.lock().expect("db mutex poisoned");
        db.user_views().create(&create)?
    };
    Ok((StatusCode::CREATED, Json(ItemResponse::full(UserViewDto::from(view)))))
}

/// Update an existing saved view (partial update — only supplied fields change).
#[utoipa::path(
    patch,
    path = "/views/{id}",
    params(("id" = String, Path, description = "Saved view UUID")),
    request_body = UpdateUserViewDto,
    responses(
        (status = 200, description = "Updated view", body = inline(ItemResponse<UserViewDto>)),
        (status = 404, description = "Not found"),
    ),
    tag = "views"
)]
pub async fn update_view(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(body): Json<UpdateUserViewDto>,
) -> Result<Json<ItemResponse<UserViewDto>>, ApiError> {
    let patch = body.into_patch();
    let view = {
        let db = state.db.lock().expect("db mutex poisoned");
        db.user_views().update(&id, &patch)?
    };
    match view {
        Some(v) => Ok(Json(ItemResponse::full(UserViewDto::from(v)))),
        None => Err(ApiError::not_found("view", &id)),
    }
}

/// Delete a saved view.
#[utoipa::path(
    delete,
    path = "/views/{id}",
    params(("id" = String, Path, description = "Saved view UUID")),
    responses(
        (status = 204, description = "Deleted"),
        (status = 404, description = "Not found"),
    ),
    tag = "views"
)]
pub async fn delete_view(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    let deleted = {
        let db = state.db.lock().expect("db mutex poisoned");
        db.user_views().delete(&id)?
    };
    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(ApiError::not_found("view", &id))
    }
}

// ---------------------------------------------------------------------------
// Request body types (API-layer only — not the DB model)
// ---------------------------------------------------------------------------

/// Request body for `POST /views`.
#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateUserViewDto {
    /// Client-generated UUID.
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    /// `"player"` or `"team"`.
    pub entity_type: String,
    /// Serialized filter state; defaults to `{}` if omitted.
    pub filters: Option<String>,
    pub sort_config: Option<String>,
    pub columns: Option<String>,
    #[serde(default)]
    pub is_default: bool,
}

impl CreateUserViewDto {
    fn into_create(self) -> Result<metis_db::CreateUserView, ApiError> {
        if self.entity_type != "player" && self.entity_type != "team" {
            return Err(ApiError::unprocessable(
                "entity_type must be 'player' or 'team'",
            ));
        }
        Ok(metis_db::CreateUserView {
            id: self.id,
            name: self.name,
            description: self.description,
            entity_type: self.entity_type,
            filters: self.filters,
            sort_config: self.sort_config,
            columns: self.columns,
            is_default: self.is_default,
        })
    }
}

/// Request body for `PATCH /views/:id`.
#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateUserViewDto {
    pub name: Option<String>,
    /// Pass `null` explicitly to clear the description.
    pub description: Option<Option<String>>,
    pub filters: Option<String>,
    /// Pass `null` explicitly to clear the sort config.
    pub sort_config: Option<Option<String>>,
    /// Pass `null` explicitly to clear the column config.
    pub columns: Option<Option<String>>,
    pub is_default: Option<bool>,
}

impl UpdateUserViewDto {
    fn into_patch(self) -> metis_db::UpdateUserView {
        metis_db::UpdateUserView {
            name: self.name,
            description: self.description,
            filters: self.filters,
            sort_config: self.sort_config,
            columns: self.columns,
            is_default: self.is_default,
        }
    }
}
