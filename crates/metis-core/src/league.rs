use serde::{Deserialize, Serialize};

/// A basketball league supported (or planned) by Metis.
///
/// Only `NBA` is fully implemented in v1. All other variants will
/// `unimplemented!()` on calls to league-specific constants — the enum is
/// defined now so that no code outside this crate can hardcode league rules.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum League {
    NBA,
    WNBA,
    NCAAM,
    NCAAW,
    Euroleague,
}

impl League {
    /// Length of a single period in minutes.
    #[must_use]
    pub fn period_length_min(self) -> u8 {
        match self {
            League::NBA => 12,
            League::WNBA | League::NCAAM | League::NCAAW | League::Euroleague => {
                unimplemented!("period_length_min not yet implemented for {:?}", self)
            }
        }
    }

    /// Number of regulation periods per game.
    #[must_use]
    pub fn periods_per_game(self) -> u8 {
        match self {
            League::NBA => 4,
            League::WNBA | League::NCAAM | League::NCAAW | League::Euroleague => {
                unimplemented!("periods_per_game not yet implemented for {:?}", self)
            }
        }
    }

    /// Number of games in a standard regular season.
    #[must_use]
    pub fn regular_season_games(self) -> u16 {
        match self {
            League::NBA => 82,
            League::WNBA | League::NCAAM | League::NCAAW | League::Euroleague => {
                unimplemented!("regular_season_games not yet implemented for {:?}", self)
            }
        }
    }

    /// Total regulation minutes per game.
    #[must_use]
    pub fn regulation_minutes(self) -> u16 {
        u16::from(self.period_length_min()) * u16::from(self.periods_per_game())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nba_constants() {
        assert_eq!(League::NBA.period_length_min(), 12);
        assert_eq!(League::NBA.periods_per_game(), 4);
        assert_eq!(League::NBA.regular_season_games(), 82);
        assert_eq!(League::NBA.regulation_minutes(), 48);
    }

    #[test]
    fn league_variants_are_distinct() {
        assert_ne!(League::NBA, League::WNBA);
    }
}
