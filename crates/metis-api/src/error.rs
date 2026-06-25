use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;
use thiserror::Error;

/// Errors that handlers can return.
#[derive(Debug, Error)]
pub enum ApiError {
    /// The requested entity does not exist.
    #[error("not found: {0}")]
    NotFound(String),

    /// A database operation failed.
    #[error("database error: {0}")]
    Db(#[from] metis_db::DbError),

    /// The request was malformed (e.g. an invalid `sort_by` column).
    #[error("bad request: {0}")]
    BadRequest(String),

    /// The request body is structurally valid but semantically invalid.
    #[error("unprocessable entity: {0}")]
    UnprocessableEntity(String),
}

impl ApiError {
    /// Constructs a `NotFound` error with a formatted message.
    pub fn not_found(entity: &str, id: &str) -> Self {
        Self::NotFound(format!("{entity} '{id}' not found"))
    }

    /// Constructs an `UnprocessableEntity` error.
    pub fn unprocessable(msg: impl Into<String>) -> Self {
        Self::UnprocessableEntity(msg.into())
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        match self {
            ApiError::NotFound(msg) => (
                StatusCode::NOT_FOUND,
                Json(json!({
                    "error": "not_found",
                    "message": msg,
                })),
            )
                .into_response(),
            ApiError::Db(metis_db::DbError::InvalidSortColumn(col)) => (
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "error": "bad_request",
                    "message": format!("invalid sort column: {col}"),
                })),
            )
                .into_response(),
            ApiError::Db(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({
                    "error": "internal_error",
                    "message": e.to_string(),
                })),
            )
                .into_response(),
            ApiError::BadRequest(msg) => (
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "error": "bad_request",
                    "message": msg,
                })),
            )
                .into_response(),
            ApiError::UnprocessableEntity(msg) => (
                StatusCode::UNPROCESSABLE_ENTITY,
                Json(json!({
                    "error": "unprocessable_entity",
                    "message": msg,
                })),
            )
                .into_response(),
        }
    }
}
