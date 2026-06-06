/// A row from the `possession` fact table.
///
/// One row per possession per ingest source. `id` is a DB-assigned surrogate key;
/// callers should set it to `0` when constructing a record for upsert.
#[derive(Debug, Clone, PartialEq)]
pub struct Possession {
    /// Surrogate BIGINT PK. Set to `0` when constructing a record for upsert.
    pub id: i64,
    pub game_id: String,
    /// 1–4 for regulation, 5+ for overtime periods.
    pub period: i16,
    /// Within-period counter assigned by pbpstats.
    pub possession_num: i16,
    /// Season-run ordering hint; resets on re-ingest.
    pub global_possession_num: i32,
    pub offense_team_id: String,
    /// `None` on jump balls or when team is unknown.
    pub defense_team_id: Option<String>,
    /// Seconds left in the period at possession start.
    pub start_time_remaining: Option<f64>,
    /// Seconds left in the period at possession end.
    pub end_time_remaining: Option<f64>,
    /// Derived: `start_time_remaining − end_time_remaining`.
    pub duration_seconds: Option<f64>,
    /// Offense team's lead at possession start; negative = trailing.
    pub score_margin: Option<i16>,
    /// e.g. `"LiveBallTurnover"`; `None` when unavailable.
    pub possession_start_type: Option<String>,
    /// Points scored by the offense this possession.
    pub points_scored: i16,
    /// Raw pbpstats hyphen-separated sorted numeric player IDs (no `NBA_` prefix).
    pub offense_lineup_id: Option<String>,
    pub defense_lineup_id: Option<String>,
    /// Number of PBP events comprising this possession.
    pub num_events: i16,
    /// Season label, e.g. `"2024-25"`.
    pub season_id: String,
    /// One of `"Regular"`, `"Playoffs"`, `"PlayIn"`.
    pub season_type: String,
    pub source: String,
    pub source_url: String,
    pub fetched_at: String,
    pub source_payload: String,
    pub ingested_at: Option<String>,
}
