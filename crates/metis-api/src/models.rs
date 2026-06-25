use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// Envelope types
// ---------------------------------------------------------------------------

/// Generic single-item response envelope.
///
/// The `coverage` field is always `"full"` for dimension entities (player, team,
/// game, season). Coverage markers on individual stat columns are introduced in
/// later stat endpoints.
#[derive(Debug, Serialize, ToSchema)]
pub struct ItemResponse<T: Serialize> {
    pub data: T,
    pub coverage: CoverageLabel,
}

impl<T: Serialize> ItemResponse<T> {
    /// Wraps `data` with full coverage.
    pub fn full(data: T) -> Self {
        Self {
            data,
            coverage: CoverageLabel::Full,
        }
    }
}

/// Generic list response envelope.
#[derive(Debug, Serialize, ToSchema)]
pub struct ListResponse<T: Serialize> {
    pub data: Vec<T>,
    pub total: usize,
    pub coverage: CoverageLabel,
}

impl<T: Serialize> ListResponse<T> {
    /// Wraps `data` with full coverage.
    pub fn full(data: Vec<T>) -> Self {
        let total = data.len();
        Self {
            data,
            total,
            coverage: CoverageLabel::Full,
        }
    }
}

/// Generic paginated list response envelope.
///
/// Used for endpoints that support `page` / `page_size` pagination over a
/// potentially large result set, as opposed to [`ListResponse`] which always
/// returns the full result set.
#[derive(Debug, Serialize, ToSchema)]
pub struct PagedResponse<T: Serialize> {
    pub data: Vec<T>,
    pub page: u32,
    pub page_size: u32,
    pub total: u64,
    pub coverage: CoverageLabel,
}

impl<T: Serialize> PagedResponse<T> {
    /// Wraps `data` with full coverage and the given pagination metadata.
    pub fn full(data: Vec<T>, page: u32, page_size: u32, total: u64) -> Self {
        Self {
            data,
            page,
            page_size,
            total,
            coverage: CoverageLabel::Full,
        }
    }
}

/// Coverage label attached to every response.
#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum CoverageLabel {
    /// All requested stats are available for the given query.
    Full,
    /// Some requested stats are unavailable (outside coverage window).
    Partial,
    /// No stats available for the given query.
    None,
}

// ---------------------------------------------------------------------------
// Entity response DTOs
// ---------------------------------------------------------------------------

/// Player entity as returned by the API.
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct PlayerDto {
    /// Composite key, e.g. `"NBA_2544"`.
    pub id: String,
    pub league_id: String,
    pub first_name: String,
    pub last_name: String,
    /// ISO-8601 date string, or `null` when not reported.
    pub birth_date: Option<String>,
}

impl From<metis_db::Player> for PlayerDto {
    fn from(p: metis_db::Player) -> Self {
        Self {
            id: p.id,
            league_id: p.league_id,
            first_name: p.first_name,
            last_name: p.last_name,
            birth_date: p.birth_date,
        }
    }
}

/// Team entity as returned by the API.
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct TeamDto {
    /// Composite key, e.g. `"NBA_BOS"`.
    pub id: String,
    pub league_id: String,
    pub abbreviation: String,
    pub full_name: String,
    pub city: String,
}

impl From<metis_db::Team> for TeamDto {
    fn from(t: metis_db::Team) -> Self {
        Self {
            id: t.id,
            league_id: t.league_id,
            abbreviation: t.abbreviation,
            full_name: t.full_name,
            city: t.city,
        }
    }
}

/// Season entity as returned by the API.
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SeasonDto {
    /// Season label, e.g. `"2023-24"`.
    pub id: String,
    pub league_id: String,
    pub start_year: i16,
    pub end_year: i16,
}

impl From<metis_db::SeasonRow> for SeasonDto {
    fn from(s: metis_db::SeasonRow) -> Self {
        Self {
            id: s.id,
            league_id: s.league_id,
            start_year: s.start_year,
            end_year: s.end_year,
        }
    }
}

/// Game entity as returned by the API.
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct GameDto {
    pub id: String,
    pub league_id: String,
    /// Season label, e.g. `"2023-24"`.
    pub season_id: String,
    /// One of `Regular`, `Playoffs`, `PlayIn`, `AllStar`, `Preseason`.
    pub season_type: String,
    /// ISO-8601 date string.
    pub game_date: String,
    pub home_team_id: String,
    pub away_team_id: String,
    /// `null` until the game is final.
    pub home_score: Option<i16>,
    /// `null` until the game is final.
    pub away_score: Option<i16>,
    /// One of `scheduled`, `live`, `final`.
    pub status: String,
}

impl From<metis_db::Game> for GameDto {
    fn from(g: metis_db::Game) -> Self {
        Self {
            id: g.id,
            league_id: g.league_id,
            season_id: g.season_id,
            season_type: g.season_type,
            game_date: g.game_date,
            home_team_id: g.home_team_id,
            away_team_id: g.away_team_id,
            home_score: g.home_score,
            away_score: g.away_score,
            status: g.status,
        }
    }
}

/// A row of player season statistics as returned by `GET /players/stats`.
///
/// Field semantics depend on the requested `display_mode`: for `totals` these
/// are season counting-stat sums; for `per_game` / `per_36` / `per_100` they are
/// the corresponding rate stats. `null` means the underlying source did not
/// report that stat (or, for rate stats, that the denominator was zero).
#[derive(Debug, Serialize, ToSchema)]
pub struct PlayerStatsRowDto {
    pub player_id: String,
    /// Season label, e.g. `"2023-24"`.
    pub season_id: String,
    pub season_type: String,
    /// Ingest adapter name, e.g. `"nba_stats"`.
    pub source: String,
    pub games_played: i32,
    pub minutes_played: Option<f64>,
    pub points: Option<f64>,
    pub rebounds_offensive: Option<f64>,
    pub rebounds_defensive: Option<f64>,
    pub rebounds_total: Option<f64>,
    pub assists: Option<f64>,
    pub steals: Option<f64>,
    pub blocks: Option<f64>,
    pub turnovers: Option<f64>,
    pub personal_fouls: Option<f64>,
    pub field_goals_made: Option<f64>,
    pub field_goals_attempted: Option<f64>,
    pub three_pointers_made: Option<f64>,
    pub three_pointers_attempted: Option<f64>,
    pub free_throws_made: Option<f64>,
    pub free_throws_attempted: Option<f64>,
}

impl From<metis_db::PlayerStatsRow> for PlayerStatsRowDto {
    fn from(r: metis_db::PlayerStatsRow) -> Self {
        Self {
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
        }
    }
}

/// A saved filter/sort/column combination as returned by `GET /views`.
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UserViewDto {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub entity_type: String,
    pub filters: String,
    pub sort_config: Option<String>,
    pub columns: Option<String>,
    pub is_default: bool,
    pub created_at: String,
    pub updated_at: String,
}

impl From<metis_db::UserView> for UserViewDto {
    fn from(v: metis_db::UserView) -> Self {
        Self {
            id: v.id,
            name: v.name,
            description: v.description,
            entity_type: v.entity_type,
            filters: v.filters,
            sort_config: v.sort_config,
            columns: v.columns,
            is_default: v.is_default,
            created_at: v.created_at,
            updated_at: v.updated_at,
        }
    }
}

// ---------------------------------------------------------------------------
// Query param structs
// ---------------------------------------------------------------------------

/// Query parameters for `GET /players`.
#[derive(Debug, Deserialize, ToSchema)]
pub struct PlayersQuery {
    /// Filter by league, e.g. `NBA`.
    pub league_id: Option<String>,
    /// Case-insensitive substring match on full name.
    pub search: Option<String>,
}

/// Query parameters for `GET /teams`.
#[derive(Debug, Deserialize, ToSchema)]
pub struct TeamsQuery {
    /// Filter by league, e.g. `NBA`.
    pub league_id: Option<String>,
}

/// Query parameters for `GET /seasons`.
#[derive(Debug, Deserialize, ToSchema)]
pub struct SeasonsQuery {
    /// Filter by league, e.g. `NBA`.
    pub league_id: Option<String>,
}

/// Query parameters for `GET /games`.
#[derive(Debug, Deserialize, ToSchema)]
pub struct GamesQuery {
    /// Filter by season label, e.g. `2023-24`.
    pub season_id: Option<String>,
    /// Filter by season type, e.g. `Regular` or `Playoffs`.
    pub season_type: Option<String>,
    /// Filter by team id (matches home or away), e.g. `NBA_BOS`.
    pub team_id: Option<String>,
}

/// Query parameters for `GET /players/stats`.
///
/// `season_id` accepts a comma-separated list (`?season_id=2022-23,2023-24`) to
/// OR multiple seasons together; omitted means "all seasons". A single value
/// (`?season_id=2023-24`) also works. Repeated query keys are NOT supported —
/// axum's `Query` extractor uses `serde_urlencoded`, which cannot deserialize
/// `Vec<T>` from repeated keys.
///
/// Pagination: `page` is 1-indexed (default `1`); `page_size` is clamped to
/// `[1, 200]` (default `50`) — out-of-range values are silently clamped, not
/// rejected.
///
/// `sort_by` must be one of [`metis_db::SORT_COLUMN_ALLOWLIST`]; anything else
/// returns `400 Bad Request`.
#[derive(Debug, Deserialize, ToSchema)]
pub struct PlayerStatsQuery {
    /// Comma-separated list of season labels, OR'd together, e.g.
    /// `2022-23,2023-24`. Omitted means "all seasons".
    pub season_id: Option<String>,
    /// Filter by season type, e.g. `Regular`, `Playoffs`, `PlayIn`, `AllStar`.
    pub season_type: Option<String>,
    /// Restrict to a single player, e.g. `NBA_2544`. Omitted means all players.
    pub player_id: Option<String>,
    /// Filter by the player's team for the stint, e.g. `NBA_BOS`.
    pub team_id: Option<String>,
    /// Inclusive ISO-8601 lower bound on game date. Forces per-game aggregation.
    pub date_from: Option<String>,
    /// Inclusive ISO-8601 upper bound on game date. Forces per-game aggregation.
    pub date_to: Option<String>,
    /// `"home"` or `"away"`. Forces per-game aggregation.
    pub home_away: Option<String>,
    /// `"win"` or `"loss"`. Forces per-game aggregation.
    pub win_loss: Option<String>,
    /// `"totals"`, `"per_game"`, `"per_36"`, or `"per_100"`. Defaults to `"totals"`.
    pub display_mode: Option<String>,
    /// Ingest adapter name. Defaults to `"nba_stats"`.
    pub source: Option<String>,
    /// Column to sort by. Must be in the sort column allowlist. Defaults to `"points"`.
    pub sort_by: Option<String>,
    /// `"asc"` or `"desc"`. Defaults to `"desc"`.
    pub sort_dir: Option<String>,
    /// 1-indexed page number. Defaults to `1`.
    pub page: Option<u32>,
    /// Page size, clamped to `[1, 200]`. Defaults to `50`.
    pub page_size: Option<u32>,
}
