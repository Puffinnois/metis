use thiserror::Error;

#[derive(Debug, Error)]
pub enum DbError {
    #[error("DuckDB: {0}")]
    DuckDb(#[from] duckdb::Error),
    #[error("I/O: {0}")]
    Io(#[from] std::io::Error),
    #[error("invalid sort column: {0}")]
    InvalidSortColumn(String),
}

pub type Result<T, E = DbError> = std::result::Result<T, E>;
