/// A row from the `player_game_box` fact table.
///
/// One row per player × game × ingest source. `id` is a DB-assigned surrogate key
/// (sequence); callers should set it to `0` when constructing a record for upsert.
/// Stats are `None` when the source does not report them.
#[derive(Debug, Clone, PartialEq)]
pub struct PlayerGameBox {
    /// Surrogate BIGINT PK. Set to `0` when constructing a record for upsert.
    pub id: i64,
    pub game_id: String,
    pub player_id: String,
    pub team_id: String,
    /// Season label, e.g. `"2023-24"`. Denormalized from `game` for filter performance.
    pub season_id: String,
    /// One of `"Regular"`, `"Playoffs"`, `"PlayIn"`, `"AllStar"`, `"Preseason"`.
    pub season_type: String,
    pub starter: Option<bool>,
    /// Fractional minutes, e.g. `32.5`.
    pub minutes_played: Option<f64>,
    pub points: Option<i16>,
    pub rebounds_offensive: Option<i16>,
    pub rebounds_defensive: Option<i16>,
    pub rebounds_total: Option<i16>,
    pub assists: Option<i16>,
    pub steals: Option<i16>,
    pub blocks: Option<i16>,
    pub turnovers: Option<i16>,
    pub personal_fouls: Option<i16>,
    pub field_goals_made: Option<i16>,
    pub field_goals_attempted: Option<i16>,
    pub three_pointers_made: Option<i16>,
    pub three_pointers_attempted: Option<i16>,
    pub free_throws_made: Option<i16>,
    pub free_throws_attempted: Option<i16>,
    pub plus_minus: Option<i16>,
    /// Adapter name, e.g. `"nba_stats"`.
    pub source: String,
    pub source_url: String,
    /// ISO-8601 datetime string of when the source was fetched (UTC).
    pub fetched_at: String,
    /// Full original JSON payload from the source.
    pub source_payload: String,
    /// ISO-8601 datetime string of when this row was ingested (UTC). DB-managed;
    /// set to `None` when constructing a record for upsert.
    pub ingested_at: Option<String>,
}
