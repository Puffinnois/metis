/// A row from the `player` dimension table.
///
/// `birth_date` is `None` when the source does not report it.
/// Timestamps (`created_at`, `updated_at`) are DB-managed and not included here.
#[derive(Debug, Clone, PartialEq)]
pub struct Player {
    /// Composite key: `{LEAGUE}_{source_player_id}`, e.g. `"NBA_2544"`.
    pub id: String,
    /// League identifier, e.g. `"NBA"`. Matches the `league.id` seed values.
    pub league_id: String,
    pub first_name: String,
    pub last_name: String,
    /// ISO-8601 date string (`"YYYY-MM-DD"`), or `None` when not reported.
    pub birth_date: Option<String>,
}
