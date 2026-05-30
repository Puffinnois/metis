use serde::{Deserialize, Serialize};

use crate::Season;

/// Describes the historical coverage window for a stat.
///
/// `None` for `min_season` means "available from the earliest recorded season."
/// `None` for `max_season` means "available through the current season."
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Coverage {
    pub min_season: Option<Season>,
    pub max_season: Option<Season>,
}

impl Coverage {
    /// Coverage from `min` through the present.
    #[must_use]
    pub fn from(min: Season) -> Self {
        Self {
            min_season: Some(min),
            max_season: None,
        }
    }

    /// Coverage across the full recorded history.
    #[must_use]
    pub fn full() -> Self {
        Self {
            min_season: None,
            max_season: None,
        }
    }

    /// Returns `true` if `season` falls within this coverage window.
    #[must_use]
    pub fn covers(&self, season: Season) -> bool {
        let after_min = self.min_season.is_none_or(|min| season >= min);
        let before_max = self.max_season.is_none_or(|max| season <= max);
        after_min && before_max
    }
}

/// Identifies a computable statistic.
///
/// This is a stub enumeration that will grow as stat formulas are added in
/// `metis-compute`. It is defined here (in `metis-core`) so that coverage
/// metadata can be associated with stats without depending on the compute crate.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[non_exhaustive]
pub enum StatId {
    // --- Traditional box score ---
    Points,
    Rebounds,
    Assists,
    Steals,
    Blocks,
    Turnovers,
    PersonalFouls,
    MinutesPlayed,
    FieldGoalsMade,
    FieldGoalsAttempted,
    ThreePointersMade,
    ThreePointersAttempted,
    FreeThrowsMade,
    FreeThrowsAttempted,

    // --- Advanced (box-score derivable) ---
    TrueShootingPct,
    EffectiveFieldGoalPct,
    UsageRate,
    PlayerEfficiencyRating,
    BoxPlusMinus,
    ValueOverReplacementPlayer,
    WinShares,

    // --- Play-by-play derived ---
    PossessionsPlayed,

    // --- Tracking (2013+) ---
    AverageSpeed,
    Touches,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn full_coverage_covers_any_season() {
        let c = Coverage::full();
        assert!(c.covers(Season(1946)));
        assert!(c.covers(Season(2024)));
    }

    #[test]
    fn coverage_from_respects_min() {
        let c = Coverage::from(Season(1996));
        assert!(!c.covers(Season(1995)));
        assert!(c.covers(Season(1996)));
        assert!(c.covers(Season(2024)));
    }

    #[test]
    fn coverage_with_max() {
        let c = Coverage {
            min_season: None,
            max_season: Some(Season(2012)),
        };
        assert!(c.covers(Season(2012)));
        assert!(!c.covers(Season(2013)));
    }

    #[test]
    fn coverage_bounded_window() {
        let c = Coverage {
            min_season: Some(Season(1996)),
            max_season: Some(Season(2012)),
        };
        assert!(!c.covers(Season(1995)));
        assert!(c.covers(Season(1996)));
        assert!(c.covers(Season(2012)));
        assert!(!c.covers(Season(2013)));
    }
}
