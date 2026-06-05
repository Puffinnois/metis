/// A row from the `lineup_stint` fact table.
///
/// One row per maximal consecutive-possession block within a period where a team's
/// 5-player unit stays unchanged. `id` is DB-assigned; set to `0` for upsert.
///
/// `lineup_id` is the raw pbpstats hyphen-separated sorted numeric player ID string
/// (no `NBA_` prefix) and joins directly to `possession.offense_lineup_id` /
/// `possession.defense_lineup_id`. The individual `playerN_id` fields use the
/// `NBA_` prefix and reference the `player` dimension table.
#[derive(Debug, Clone, PartialEq)]
pub struct LineupStint {
    /// Surrogate BIGINT PK. Set to `0` when constructing a record for upsert.
    pub id: i64,
    pub game_id: String,
    pub period: i16,
    pub team_id: String,
    /// `None` when fewer than 5 players are tracked by the source.
    pub player1_id: Option<String>,
    pub player2_id: Option<String>,
    pub player3_id: Option<String>,
    pub player4_id: Option<String>,
    pub player5_id: Option<String>,
    /// Raw hyphen-separated sorted numeric IDs (no `NBA_` prefix).
    pub lineup_id: String,
    /// Seconds left in the period when the stint began. NOT NULL by schema design.
    pub start_time_remaining: f64,
    pub end_time_remaining: Option<f64>,
    pub duration_seconds: Option<f64>,
    pub possessions_offense: i16,
    pub possessions_defense: i16,
    pub points_for: i16,
    pub points_against: i16,
    /// `points_for − points_against`.
    pub plus_minus: i16,
    pub season_id: String,
    pub season_type: String,
    pub source: String,
    pub source_url: String,
    pub fetched_at: String,
    pub source_payload: String,
    pub ingested_at: Option<String>,
}
