use thiserror::Error;

/// Errors that can occur during a compute operation.
#[derive(Debug, Error)]
pub enum ComputeError {
    #[error("No player_game_box rows for season={season} source={data_source}. Did you forget: metis-cli load box-scores --season {start_year} --source {data_source}?")]
    NoSourceData {
        season: String,
        start_year: u16,
        data_source: String,
    },
    #[error(transparent)]
    Db(#[from] metis_db::DbError),
}
