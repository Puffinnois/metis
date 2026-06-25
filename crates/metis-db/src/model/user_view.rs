use serde::{Deserialize, Serialize};

/// A saved filter/sort/column combination persisted in `user_view`.
///
/// `filters`, `sort_config`, and `columns` are opaque JSON blobs owned by the
/// frontend. The backend stores and returns them verbatim.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct UserView {
    /// Client-generated UUID.
    pub id: String,
    /// Human-readable display name.
    pub name: String,
    /// Optional longer description.
    pub description: Option<String>,
    /// Entity this view applies to: `"player"` or `"team"`.
    pub entity_type: String,
    /// Serialized filter state (season, team, date range, etc.).
    pub filters: String,
    /// Serialized sort configuration; `None` means use the default sort.
    pub sort_config: Option<String>,
    /// Serialized column visibility map; `None` means show all columns.
    pub columns: Option<String>,
    /// When `true`, this view loads automatically on app launch.
    pub is_default: bool,
    /// ISO-8601 creation timestamp.
    pub created_at: String,
    /// ISO-8601 last-update timestamp.
    pub updated_at: String,
}

/// Fields required to create a new saved view.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateUserView {
    /// Client-generated UUID.
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub entity_type: String,
    /// JSON blob; defaults to `"{}"` if omitted.
    pub filters: Option<String>,
    pub sort_config: Option<String>,
    pub columns: Option<String>,
    pub is_default: bool,
}

/// Fields that may be updated on an existing saved view.
///
/// Only `Some` fields are applied; `None` means "leave unchanged".
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UpdateUserView {
    pub name: Option<String>,
    pub description: Option<Option<String>>,
    pub filters: Option<String>,
    pub sort_config: Option<Option<String>>,
    pub columns: Option<Option<String>>,
    pub is_default: Option<bool>,
}
