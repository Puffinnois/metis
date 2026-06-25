use duckdb::Connection;

use crate::error::Result;
use crate::model::user_view::{CreateUserView, UpdateUserView, UserView};
use crate::queries;

/// Repository for the `user_view` table (saved filter/sort/column combinations).
///
/// Obtain via [`crate::Db::user_views`].
pub struct UserViewRepo<'conn> {
    conn: &'conn Connection,
}

impl<'conn> UserViewRepo<'conn> {
    pub(crate) fn new(conn: &'conn Connection) -> Self {
        Self { conn }
    }

    /// Returns all saved views, optionally filtered by `entity_type`.
    ///
    /// Default views come first, then most-recently-updated.
    pub fn list(&self, entity_type: Option<&str>) -> Result<Vec<UserView>> {
        queries::user_view::list(self.conn, entity_type)
    }

    /// Returns the view with the given `id`, or `None` if not found.
    pub fn find_by_id(&self, id: &str) -> Result<Option<UserView>> {
        queries::user_view::find_by_id(self.conn, id)
    }

    /// Creates a new saved view. The `id` must be a client-generated UUID.
    ///
    /// If `is_default` is `true`, all other views with the same `entity_type`
    /// have their `is_default` cleared.
    pub fn create(&self, view: &CreateUserView) -> Result<UserView> {
        queries::user_view::create(self.conn, view)
    }

    /// Applies a partial update to the view with the given `id`.
    ///
    /// Returns `None` if no view with that `id` exists. Only `Some` fields in
    /// `patch` are applied — `None` fields are left unchanged.
    pub fn update(&self, id: &str, patch: &UpdateUserView) -> Result<Option<UserView>> {
        queries::user_view::update(self.conn, id, patch)
    }

    /// Deletes the view with the given `id`.
    ///
    /// Returns `true` if a row was deleted, `false` if the id was not found.
    pub fn delete(&self, id: &str) -> Result<bool> {
        queries::user_view::delete(self.conn, id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helpers::open_test_db;

    fn sample(id: &str) -> CreateUserView {
        CreateUserView {
            id: id.to_string(),
            name: format!("View {id}"),
            description: None,
            entity_type: "player".to_string(),
            filters: Some(r#"{"season_id":"2023-24"}"#.to_string()),
            sort_config: None,
            columns: None,
            is_default: false,
        }
    }

    #[test]
    fn create_and_find_by_id() {
        let db = open_test_db();
        let repo = db.user_views();
        let created = repo.create(&sample("uuid-1")).unwrap();
        assert_eq!(created.id, "uuid-1");
        assert_eq!(created.name, "View uuid-1");
        assert!(!created.is_default);

        let found = repo.find_by_id("uuid-1").unwrap();
        assert_eq!(found.unwrap().id, "uuid-1");
    }

    #[test]
    fn find_by_id_missing_returns_none() {
        let db = open_test_db();
        let found = db.user_views().find_by_id("no-such-uuid").unwrap();
        assert!(found.is_none());
    }

    #[test]
    fn list_returns_all_and_default_first() {
        let db = open_test_db();
        let repo = db.user_views();
        repo.create(&sample("uuid-1")).unwrap();
        repo.create(&CreateUserView {
            is_default: true,
            ..sample("uuid-2")
        })
        .unwrap();
        repo.create(&sample("uuid-3")).unwrap();

        let views = repo.list(None).unwrap();
        assert_eq!(views.len(), 3);
        assert_eq!(views[0].id, "uuid-2"); // default first
    }

    #[test]
    fn list_filters_by_entity_type() {
        let db = open_test_db();
        let repo = db.user_views();
        repo.create(&sample("p1")).unwrap();
        repo.create(&CreateUserView {
            entity_type: "team".to_string(),
            ..sample("t1")
        })
        .unwrap();

        let player_views = repo.list(Some("player")).unwrap();
        assert_eq!(player_views.len(), 1);
        assert_eq!(player_views[0].id, "p1");

        let team_views = repo.list(Some("team")).unwrap();
        assert_eq!(team_views.len(), 1);
        assert_eq!(team_views[0].id, "t1");
    }

    #[test]
    fn create_default_clears_other_defaults() {
        let db = open_test_db();
        let repo = db.user_views();
        repo.create(&CreateUserView {
            is_default: true,
            ..sample("uuid-1")
        })
        .unwrap();
        repo.create(&CreateUserView {
            is_default: true,
            ..sample("uuid-2")
        })
        .unwrap();

        let views = repo.list(None).unwrap();
        // only the newest default should be true
        let defaults: Vec<_> = views.iter().filter(|v| v.is_default).collect();
        assert_eq!(defaults.len(), 1);
        assert_eq!(defaults[0].id, "uuid-2");
    }

    #[test]
    fn update_name_and_description() {
        let db = open_test_db();
        let repo = db.user_views();
        repo.create(&sample("uuid-1")).unwrap();

        let patched = repo
            .update(
                "uuid-1",
                &UpdateUserView {
                    name: Some("Renamed".to_string()),
                    description: Some(Some("A description".to_string())),
                    ..Default::default()
                },
            )
            .unwrap()
            .unwrap();

        assert_eq!(patched.name, "Renamed");
        assert_eq!(patched.description.as_deref(), Some("A description"));
    }

    #[test]
    fn update_missing_returns_none() {
        let db = open_test_db();
        let result = db
            .user_views()
            .update(
                "no-such-uuid",
                &UpdateUserView {
                    name: Some("x".to_string()),
                    ..Default::default()
                },
            )
            .unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn update_set_default_clears_others() {
        let db = open_test_db();
        let repo = db.user_views();
        repo.create(&CreateUserView {
            is_default: true,
            ..sample("uuid-1")
        })
        .unwrap();
        repo.create(&sample("uuid-2")).unwrap();

        repo.update(
            "uuid-2",
            &UpdateUserView {
                is_default: Some(true),
                ..Default::default()
            },
        )
        .unwrap();

        let v1 = repo.find_by_id("uuid-1").unwrap().unwrap();
        let v2 = repo.find_by_id("uuid-2").unwrap().unwrap();
        assert!(!v1.is_default);
        assert!(v2.is_default);
    }

    #[test]
    fn delete_removes_view() {
        let db = open_test_db();
        let repo = db.user_views();
        repo.create(&sample("uuid-1")).unwrap();
        assert!(repo.delete("uuid-1").unwrap());
        assert!(repo.find_by_id("uuid-1").unwrap().is_none());
    }

    #[test]
    fn delete_missing_returns_false() {
        let db = open_test_db();
        assert!(!db.user_views().delete("no-such-uuid").unwrap());
    }
}
