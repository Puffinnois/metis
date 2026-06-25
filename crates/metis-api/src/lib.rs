//! `metis-api` — axum HTTP server exposing Metis entity endpoints.
//!
//! # Usage
//!
//! ```rust,ignore
//! use std::sync::Arc;
//! use metis_db::Db;
//!
//! let db = Db::open("data/duckdb/metis.duckdb").expect("open db");
//! db.migrate().expect("migrate");
//! let app = metis_api::router(Arc::new(db));
//! metis_api::run(app, "127.0.0.1:8080").await.expect("server error");
//! ```

pub mod error;
pub mod handlers;
pub mod models;

use std::net::SocketAddr;
use std::sync::{Arc, Mutex};

use axum::Router;
use metis_db::Db;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

/// Shared application state — holds the open database handle.
///
/// `duckdb::Connection` (inside `Db`) is not `Sync`, so we protect it with a
/// `Mutex`. All handler accesses acquire the lock for the duration of the DB call.
pub struct AppState {
    pub db: Mutex<Db>,
}

/// Builds the axum [`Router`] for all Metis API endpoints.
///
/// The router has no TCP listener attached — callers bind their own listener or
/// use [`axum::Router::into_make_service`]. For convenience, use [`run`].
pub fn router(db: Db) -> Router {
    let state = Arc::new(AppState { db: Mutex::new(db) });

    let api_routes = Router::new()
        .route(
            "/players",
            axum::routing::get(handlers::players::list_players),
        )
        .route(
            "/players/stats",
            axum::routing::get(handlers::player_stats::list_player_stats),
        )
        .route(
            "/players/:id",
            axum::routing::get(handlers::players::get_player),
        )
        .route("/teams", axum::routing::get(handlers::teams::list_teams))
        .route("/teams/:id", axum::routing::get(handlers::teams::get_team))
        .route(
            "/seasons",
            axum::routing::get(handlers::seasons::list_seasons),
        )
        .route("/games", axum::routing::get(handlers::games::list_games))
        .route("/games/:id", axum::routing::get(handlers::games::get_game))
        .route(
            "/views",
            axum::routing::get(handlers::views::list_views)
                .post(handlers::views::create_view),
        )
        .route(
            "/views/:id",
            axum::routing::get(handlers::views::get_view)
                .patch(handlers::views::update_view)
                .delete(handlers::views::delete_view),
        )
        .with_state(state);

    // OpenAPI spec + Swagger UI.
    // SwaggerUi automatically serves the spec at /openapi.json (the URL we pass).
    let openapi = ApiDoc::openapi();
    Router::new()
        .merge(SwaggerUi::new("/swagger-ui").url("/openapi.json", openapi))
        .merge(api_routes)
}

/// Starts the axum server on `addr`, blocking until the server exits.
///
/// # Errors
///
/// Returns an error if the address cannot be bound or if the server encounters a
/// fatal I/O error.
pub async fn run(app: Router, addr: &str) -> std::io::Result<()> {
    let addr: SocketAddr = addr
        .parse()
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidInput, e))?;
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await
}

/// Root OpenAPI document, assembled from all handler sub-documents.
#[derive(OpenApi)]
#[openapi(
    info(
        title = "Metis NBA Stats API",
        version = "0.1.0",
        description = "Local-first NBA statistics API. All list responses include a `coverage` \
                       envelope field indicating whether the requested stats fall within the \
                       historical coverage window."
    ),
    paths(
        handlers::players::list_players,
        handlers::players::get_player,
        handlers::player_stats::list_player_stats,
        handlers::teams::list_teams,
        handlers::teams::get_team,
        handlers::seasons::list_seasons,
        handlers::games::list_games,
        handlers::games::get_game,
        handlers::views::list_views,
        handlers::views::get_view,
        handlers::views::create_view,
        handlers::views::update_view,
        handlers::views::delete_view,
    ),
    components(schemas(
        models::PlayerDto,
        models::TeamDto,
        models::SeasonDto,
        models::GameDto,
        models::PlayerStatsRowDto,
        models::UserViewDto,
        models::CoverageLabel,
        handlers::views::CreateUserViewDto,
        handlers::views::UpdateUserViewDto,
    )),
    tags(
        (name = "players", description = "Player dimension endpoints"),
        (name = "teams", description = "Team dimension endpoints"),
        (name = "seasons", description = "Season dimension endpoints"),
        (name = "games", description = "Game dimension endpoints"),
        (name = "views", description = "Saved filter/sort/column view endpoints"),
    )
)]
pub struct ApiDoc;
