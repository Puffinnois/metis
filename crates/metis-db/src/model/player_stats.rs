/// Display mode for player season stats: controls whether counting stats are
/// returned as totals, per-game averages, per-36-minute rates, or per-100-possession
/// rates.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DisplayMode {
    Totals,
    PerGame,
    Per36,
    Per100,
}

/// Restricts results to games where the player's team was home or away.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HomeAway {
    Home,
    Away,
}

/// Restricts results to games the player's team won or lost.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WinLoss {
    Win,
    Loss,
}

/// Sort direction for `sort_by`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SortDir {
    Asc,
    Desc,
}

impl SortDir {
    /// Returns the SQL keyword (`"ASC"` or `"DESC"`) for this direction.
    pub fn as_sql(self) -> &'static str {
        match self {
            SortDir::Asc => "ASC",
            SortDir::Desc => "DESC",
        }
    }
}

/// Allowlist of column names that may be used in `sort_by`.
///
/// `sort_by` is interpolated directly into SQL (DuckDB does not support binding
/// identifiers via `?`), so every candidate value MUST be checked against this
/// list before being used. Never pass unchecked user input into SQL text.
pub const SORT_COLUMN_ALLOWLIST: &[&str] = &[
    "player_id",
    "season_id",
    "games_played",
    "minutes_played",
    "points",
    "rebounds_offensive",
    "rebounds_defensive",
    "rebounds_total",
    "assists",
    "steals",
    "blocks",
    "turnovers",
    "personal_fouls",
    "field_goals_made",
    "field_goals_attempted",
    "three_pointers_made",
    "three_pointers_attempted",
    "free_throws_made",
    "free_throws_attempted",
];

/// Returns `true` if `column` is in [`SORT_COLUMN_ALLOWLIST`].
pub fn is_valid_sort_column(column: &str) -> bool {
    SORT_COLUMN_ALLOWLIST.contains(&column)
}

/// Filter and pagination parameters for the player stats query.
///
/// Construct via [`PlayerStatsFilter::new`] (which applies defaults and clamps
/// pagination), then adjust fields as needed.
#[derive(Debug, Clone)]
pub struct PlayerStatsFilter {
    /// One or more season labels, OR'd together. Empty means "all seasons".
    pub season_ids: Vec<String>,
    /// `"Regular"`, `"Playoffs"`, `"PlayIn"`, or `"AllStar"`. `None` means all types.
    pub season_type: Option<String>,
    /// Restrict to a single player, e.g. `"NBA_2544"`. `None` means all players.
    pub player_id: Option<String>,
    /// Player's team for the stint, e.g. `"NBA_BOS"`.
    pub team_id: Option<String>,
    /// Inclusive ISO-8601 lower bound on `game.game_date`. Forces per-game aggregation.
    pub date_from: Option<String>,
    /// Inclusive ISO-8601 upper bound on `game.game_date`. Forces per-game aggregation.
    pub date_to: Option<String>,
    /// Restrict to games where the player's team was home or away. Forces per-game
    /// aggregation.
    pub home_away: Option<HomeAway>,
    /// Restrict to games the player's team won or lost. Forces per-game aggregation.
    pub win_loss: Option<WinLoss>,
    /// Which materialized/derived view to read stat values from.
    pub display_mode: DisplayMode,
    /// Ingest adapter name, e.g. `"nba_stats"`.
    pub source: String,
    /// Column to sort by. MUST be validated with [`is_valid_sort_column`] before
    /// constructing this struct from untrusted input.
    pub sort_by: String,
    pub sort_dir: SortDir,
    /// 1-indexed page number.
    pub page: u32,
    /// Page size, clamped to `[1, MAX_PAGE_SIZE]`.
    pub page_size: u32,
}

/// Maximum allowed `page_size`. Requests above this are clamped, not rejected.
pub const MAX_PAGE_SIZE: u32 = 200;
/// Default `page_size` when not specified.
pub const DEFAULT_PAGE_SIZE: u32 = 50;

impl PlayerStatsFilter {
    /// Builds a filter with sane defaults: all seasons, totals display mode,
    /// `"nba_stats"` source, sorted by `points` descending, page 1 of 50.
    ///
    /// `page` is clamped to a minimum of 1; `page_size` is clamped to
    /// `[1, MAX_PAGE_SIZE]`.
    pub fn new(page: u32, page_size: u32) -> Self {
        Self {
            season_ids: Vec::new(),
            season_type: None,
            player_id: None,
            team_id: None,
            date_from: None,
            date_to: None,
            home_away: None,
            win_loss: None,
            display_mode: DisplayMode::Totals,
            source: "nba_stats".to_string(),
            sort_by: "points".to_string(),
            sort_dir: SortDir::Desc,
            page: page.max(1),
            page_size: page_size.clamp(1, MAX_PAGE_SIZE),
        }
    }

    /// Returns `true` if any filter requires per-game aggregation rather than the
    /// precomputed season rollup tables (date range, home/away, win/loss).
    pub fn requires_per_game_aggregation(&self) -> bool {
        self.date_from.is_some()
            || self.date_to.is_some()
            || self.home_away.is_some()
            || self.win_loss.is_some()
    }

    /// `LIMIT` value for pagination.
    pub fn limit(&self) -> u32 {
        self.page_size
    }

    /// `OFFSET` value for pagination.
    pub fn offset(&self) -> u32 {
        (self.page - 1) * self.page_size
    }
}

/// A single row of the player stats result set.
///
/// Counting-stat fields are `f64` regardless of display mode so that totals,
/// per-game, per-36, and per-100 values can share one row type. For
/// [`DisplayMode::Totals`] these are whole numbers represented as `f64`.
#[derive(Debug, Clone, PartialEq)]
pub struct PlayerStatsRow {
    pub player_id: String,
    pub season_id: String,
    pub season_type: String,
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

/// A page of [`PlayerStatsRow`] plus the total row count across all pages.
#[derive(Debug, Clone, PartialEq)]
pub struct PlayerStatsPage {
    pub rows: Vec<PlayerStatsRow>,
    pub total: u64,
}
